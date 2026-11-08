import { describe, expect, it } from 'vitest';
import { resolveArtifactsWithAux, type AuxResolveRequest } from '../../../../src/modules/context';
import { ArtifactKind, MessageRole, type StoredArtifact } from '../../../../src/modules/conversation-store';
import {
  AuxRouterResolver,
  classifyIntent,
  IntentRouter,
  IntentSource,
  parseAuxRouteReply,
  RequestIntent,
  type IntentInput,
  type RouterAuxCall,
  type RouterAuxModel,
} from '../../../../src/modules/routing';

const BASE: IntentInput = { text: '', slash: true, reviewFlag: false, imageCount: 0, designCount: 0, refCount: 0 };
const AUX_REQUEST: AuxResolveRequest = {
  question: 'q', recentTurns: [], timeoutMs: 1500,
  registry: [{ alias: 'A1', kind: ArtifactKind.C4_SPEC, owner: MessageRole.ASSISTANT, turn: 1, label: 'C4 container · Đặt vé' }],
};

function fakeAux(answer: string | (() => Promise<string>)): RouterAuxModel & { calls: RouterAuxCall[] } {
  const calls: RouterAuxCall[] = [];
  return {
    name: 'fake/aux',
    calls,
    complete: async (call) => { calls.push(call); return typeof answer === 'string' ? answer : answer(); },
  };
}

describe('intent rules (note 05 §2)', () => {
  const LONG_STATEMENT = `Đề bài: Xây dựng hệ thống bán hàng. Khách hàng có thể xem sản phẩm, thêm sản phẩm vào giỏ, đánh giá sản phẩm đã mua, ${'và nhiều chức năng khác '.repeat(10)}`;
  const table: Array<[string, Partial<IntentInput>, RequestIntent, IntentSource]> = [
    ['/c4 + problem photo', { text: '', imageCount: 2 }, RequestIntent.C4_GENERATE, IntentSource.RULE],
    ['/c4 typed statement', { text: 'Hệ thống đặt vé xem phim, thanh toán VNPay' }, RequestIntent.C4_GENERATE, IntentSource.RULE],
    ['problem + my design + "nhận xét"', { text: 'nhận xét design này', imageCount: 2 }, RequestIntent.C4_REVIEW, IntentSource.RULE],
    ['"thiết kế bạn vẽ" is a reference, not a draw command', { text: 'nhận xét thiết kế bạn vẽ lúc nãy', designCount: 1 }, RequestIntent.C4_REVIEW, IntentSource.RULE],
    ['"chấm" an existing design', { text: 'chấm bài thiết kế lúc nãy', designCount: 1 }, RequestIntent.C4_REVIEW, IntentSource.RULE],
    ['"vẽ … rồi đánh giá"', { text: 'Vẽ C4 cho đề này rồi đánh giá', imageCount: 1 }, RequestIntent.C4_GENERATE_AND_REVIEW, IntentSource.RULE],
    ['"sửa … thêm Redis" with a design', { text: 'sửa diagram: thêm Redis cache', designCount: 1 }, RequestIntent.C4_REVISE, IntentSource.RULE],
    ['"thêm" without any design = part of a statement', { text: 'thêm chức năng đặt vé', designCount: 0 }, RequestIntent.C4_GENERATE, IntentSource.RULE],
    ['command words deep in a pasted statement are features', { text: LONG_STATEMENT, designCount: 1 }, RequestIntent.C4_GENERATE, IntentSource.RULE],
    ['accent-free "sua thiet ke"', { text: 'sua thiet ke them redis', designCount: 1 }, RequestIntent.C4_REVISE, IntentSource.RULE],
    ['--review with a design', { reviewFlag: true, designCount: 1 }, RequestIntent.C4_REVIEW, IntentSource.FLAG],
    ['--review with nothing drawn yet', { reviewFlag: true, text: 'Hệ thống đặt vé' }, RequestIntent.C4_GENERATE_AND_REVIEW, IntentSource.FLAG],
    ['explicit intent wins', { explicitIntent: RequestIntent.C4_REVISE, text: 'nhận xét' }, RequestIntent.C4_REVISE, IntentSource.EXPLICIT],
    ['chat path: a question', { slash: false, text: 'giải thích container vs component' }, RequestIntent.QA, IntentSource.RULE],
  ];
  it.each(table)('%s', (_name, input, intent, source) => {
    expect(classifyIntent({ ...BASE, ...input })).toMatchObject({ intent, source });
  });

  it.each([
    ['revise words + new problem photos', { text: 'thêm Redis cache', designCount: 1, imageCount: 1 }],
    ['review + revise words with a design', { text: 'nhận xét và sửa thiết kế', designCount: 1 }],
    ['explicit refs without a command word', { text: '[A7] cho mình bản sequence', refCount: 1, designCount: 1 }],
  ])('undecided → aux: %s', (_name, input) => {
    expect(classifyIntent({ ...BASE, ...input })).toBeNull();
  });
});

describe('IntentRouter + combined aux call', () => {
  it('decided by rules = no aux call', async () => {
    const aux = fakeAux('{}');
    const router = new IntentRouter(aux, { timeoutMs: 1500 });
    const input = { ...BASE, text: 'sửa: thêm Redis', designCount: 1 };
    const session = router.session(input);
    expect(await router.route(input, session, AUX_REQUEST)).toMatchObject({ intent: RequestIntent.C4_REVISE, source: IntentSource.RULE });
    expect(aux.calls).toHaveLength(0);
  });

  it('undecided: ONE aux call answers the intent and, cached, the artifact refs', async () => {
    const aux = fakeAux('{"intent":"c4_revise","confidence":0.85,"refs":["A1","A99"],"reason":"thêm cache"}');
    const router = new IntentRouter(aux, { timeoutMs: 1500 });
    const input = { ...BASE, text: 'thêm Redis cache', designCount: 1, imageCount: 1 };
    const session = router.session(input)!;
    expect(await router.route(input, session, AUX_REQUEST)).toMatchObject({ intent: RequestIntent.C4_REVISE, source: IntentSource.AUX, confidence: 0.85 });
    expect(await session.resolve(AUX_REQUEST)).toEqual({ refs: ['A1'], confidence: 0.85, reason: 'thêm cache' });  // A99 is not in the registry
    expect(aux.calls).toHaveLength(1);
    expect(aux.calls[0].maxOutputTokens).toBeLessThanOrEqual(512);
    expect(aux.calls[0].timeoutMs).toBe(1500);
    expect(aux.calls[0].text).toContain('A1 · c4_spec');
  });

  it('a low-confidence, invalid or failed aux answer falls back to the rules default', async () => {
    const input = { ...BASE, text: 'thêm Redis cache', designCount: 1, imageCount: 1 };
    for (const answer of ['{"intent":"c4_review","confidence":0.3,"refs":[]}', 'not json', '{"intent":"dance","confidence":1}']) {
      const router = new IntentRouter(fakeAux(answer), { timeoutMs: 1500 });
      expect(await router.route(input, router.session(input), AUX_REQUEST)).toMatchObject({ intent: RequestIntent.C4_REVISE, source: IntentSource.DEFAULT });
    }
    const failing = new IntentRouter(fakeAux(async () => { throw new Error('quota'); }), { timeoutMs: 1500 });
    expect(await failing.route(input, failing.session(input), AUX_REQUEST)).toMatchObject({ source: IntentSource.DEFAULT });
    const none = new IntentRouter(null, { timeoutMs: 1500 });
    expect(none.session(input)).toBeNull();
    expect(await none.route(input, null, AUX_REQUEST)).toMatchObject({ source: IntentSource.DEFAULT });
  });

  it('/c4 never becomes plain Q&A', async () => {
    const router = new IntentRouter(fakeAux('{"intent":"qa","confidence":0.9,"refs":[]}'), { timeoutMs: 1500 });
    const input = { ...BASE, text: 'nhận xét và sửa', designCount: 1 };
    expect((await router.route(input, router.session(input), AUX_REQUEST)).intent).toBe(RequestIntent.C4_GENERATE);
  });

  it('parseAuxRouteReply validates intent and refs', () => {
    expect(parseAuxRouteReply('```json\n{"intent":"C4_REVIEW","confidence":2,"refs":["[a1]"]}\n```', ['A1'])).toEqual({ intent: RequestIntent.C4_REVIEW, confidence: 1, refs: ['A1'] });
    expect(parseAuxRouteReply('{"intent":"x","refs":"A1"}', ['A1'])).toEqual({ intent: null, confidence: 0, refs: [] });
  });
});

describe('chat path: the aux resolver is step ③ of the artifact resolver', () => {
  function spec(ordinal: number, label: string): StoredArtifact {
    return {
      id: `00000000-0000-4000-8000-00000000000${ordinal}`, ordinal, kind: ArtifactKind.C4_SPEC, messageId: `m${ordinal}`, messageSeq: ordinal * 2,
      objectKey: null, mime: null, caption: null, ocrText: null, dataJson: { systemName: 'Đặt vé', levels: [{ level: 'container' }] },
      label, level: 'container', owner: MessageRole.ASSISTANT, parentArtifactId: null, version: 1,
    };
  }

  it('ambiguous rules → one aux call settles the refs; one design → no call', async () => {
    const aux = fakeAux('{"intent":"qa","confidence":0.9,"refs":["A1"]}');
    const resolver = new AuxRouterResolver(aux, 1500);
    const two = [spec(1, 'C4 container · Đặt vé · v1'), spec(2, 'C4 container · Đặt vé · v1 (b)')];
    const resolved = await resolveArtifactsWithAux({ question: 'thiết kế container', artifacts: two }, resolver);
    expect(resolved).toMatchObject({ source: 'aux', ambiguous: false });
    expect(resolved.picked.map((a) => a.ordinal)).toEqual([1]);
    expect(aux.calls).toHaveLength(1);

    await resolveArtifactsWithAux({ question: 'thiết kế container', artifacts: [two[0]] }, resolver);
    expect(aux.calls).toHaveLength(1);
  });
});
