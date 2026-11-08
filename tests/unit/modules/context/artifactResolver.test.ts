import { describe, it, expect } from 'vitest';
import {
  ArtifactResolverMode,
  DEFAULT_CONTEXT_SETTINGS,
  RESOLVER_WEIGHTS,
  TemporalCue,
  assembleContext,
  extractSignals,
  mentions,
  needsQueryRewrite,
  resolveArtifacts,
  resolveArtifactsWithAux,
  type AuxResolveRequest,
  type AuxResolver,
} from '../../../../src/modules/context';
import { ArtifactKind, MessageKind, MessageRole, ResolvedRefSource, type ConversationSnapshot, type StoredArtifact, type StoredMessage } from '../../../../src/modules/conversation-store';

const S = DEFAULT_CONTEXT_SETTINGS;

function msg(seq: number): StoredMessage {
  return { id: `m${seq}`, seq, role: seq % 2 ? MessageRole.USER : MessageRole.ASSISTANT, kind: MessageKind.CHAT, text: `t${seq}` };
}

function spec(ordinal: number, seq: number, systemName: string, levels: string[], extra: Partial<StoredArtifact> = {}): StoredArtifact {
  return {
    id: `a${ordinal}`, ordinal, kind: ArtifactKind.C4_SPEC, messageId: `m${seq}`, messageSeq: seq, objectKey: null, mime: null, caption: null, ocrText: null,
    dataJson: { systemName, requirements: [{ id: 'R1', text: 'đặt vé' }], levels: levels.map((level) => ({ level, title: level, spec: { elements: [{ name: `${level}-element` }] } })) },
    label: `C4 ${levels.join('+')} · ${systemName}`, level: levels.join('+'), owner: MessageRole.ASSISTANT, version: 1, ...extra,
  };
}

function file(ordinal: number, kind: ArtifactKind, seq: number, extra: Partial<StoredArtifact> = {}): StoredArtifact {
  return {
    id: `a${ordinal}`, ordinal, kind, messageId: `m${seq}`, messageSeq: seq, objectKey: `conversations/c/a${ordinal}.png`, mime: 'image/png',
    caption: null, ocrText: null, dataJson: null, label: null, level: null, owner: kind === ArtifactKind.USER_IMAGE ? MessageRole.USER : MessageRole.ASSISTANT, version: 1, ...extra,
  };
}

function snap(artifacts: StoredArtifact[], turns = 4): ConversationSnapshot {
  const messages = Array.from({ length: turns * 2 }, (_, i) => msg(i + 1));
  return { id: 'c', title: 't', summary: null, summaryUptoSeq: 0, state: {}, deletedAt: null, lastSeq: messages.length, messages, artifacts, artifactCount: artifacts.length };
}

describe('word matching (note 17 §3.1: Unicode word boundary + NFC)', () => {
  it('"nó" does not match "nói"; "đề" does not match "vấn đề"; NFD input is normalized', () => {
    expect(needsQueryRewrite('nói rõ hơn đi', true)).toBe(false);
    expect(needsQueryRewrite('giải thích nó kỹ hơn', true)).toBe(true);
    expect(mentions('nói rõ hơn về vấn đề này', ['đề'])).toBe(false);
    expect(mentions('đề bài nói gì', ['đề'])).toBe(true);
    expect(mentions('đề bài'.normalize('NFD'), ['đề'])).toBe(true);
    expect(mentions('mô hình OSI', ['hình'])).toBe(false);
  });
});

describe('signals → score (§3.1–3.2)', () => {
  it('extracts kind, level, owner, temporal, alias and entity words', () => {
    const s = extractSignals('hình container bạn vẽ trước đó cho hệ thống đặt vé, xem A7');
    expect(s.drawn).toBe(true);
    expect(s.kinds).toContain(ArtifactKind.C4_SPEC);
    expect(s.levels).toEqual(['container']);
    expect(s.owner).toBe(MessageRole.ASSISTANT);
    expect(s.temporal).toBe(TemporalCue.PREVIOUS);
    expect(s.aliases).toEqual(['A7']);
    expect(s.entityTokens).toEqual(expect.arrayContaining(['đặt', 'vé']));
    expect(extractSignals('thiết kế của tôi').owner).toBe(MessageRole.USER);
    expect(extractSignals('thiết kế của tôi').kinds).toContain(ArtifactKind.USER_IMAGE);
    expect(extractSignals('mutex là gì')).toMatchObject({ kinds: [], levels: [], owner: null, temporal: null, reference: false });
  });

  it('scores = weights of the matched signals; owner mismatch is a strong penalty', () => {
    const a = spec(1, 2, 'Hệ thống đặt vé', ['container']);
    const userImage = file(2, ArtifactKind.USER_IMAGE, 3);
    const r = resolveArtifacts({ question: 'thiết kế container của tôi', artifacts: [a, userImage] });
    const bySpec = r.candidates.find((c) => c.alias === 'A1')!;
    expect(bySpec.breakdown).toMatchObject({ kind: RESOLVER_WEIGHTS.kind, level: RESOLVER_WEIGHTS.level, owner: RESOLVER_WEIGHTS.ownerMismatch });
    expect(r.picked.map((x) => x.id)).toEqual(['a2']);
  });

  it('UI refs win over every other signal; unknown refs are ignored', () => {
    const artifacts = [spec(1, 2, 'A', ['container']), spec(2, 4, 'B', ['container'])];
    const r = resolveArtifacts({ question: 'thiết kế mới nhất', artifacts, refIds: ['A1', 'A99'] });
    expect(r).toMatchObject({ source: ResolvedRefSource.UI, ambiguous: false });
    expect(r.picked.map((a) => a.id)).toEqual(['a1']);
  });

  it('no signal → no resolve; mode off → no resolve', () => {
    const artifacts = [spec(1, 2, 'Hệ thống đặt vé', ['container'])];
    expect(resolveArtifacts({ question: 'mutex là gì', artifacts }).source).toBe(ResolvedRefSource.NONE);
    expect(resolveArtifacts({ question: 'thiết kế container', artifacts, settings: { mode: ArtifactResolverMode.OFF } }).source).toBe(ResolvedRefSource.NONE);
  });
});

describe('aux resolver hook (§3.3)', () => {
  const ambiguous = [spec(1, 2, 'Hệ thống đặt vé', ['container']), spec(3, 4, 'Hệ thống đặt vé', ['container'])];

  class FakeAux implements AuxResolver {
    calls: AuxResolveRequest[] = [];
    constructor(private readonly reply: () => Promise<{ refs: string[]; confidence: number } | null>) {}
    async resolve(request: AuxResolveRequest) {
      this.calls.push(request);
      return this.reply();
    }
  }

  it('one design → 0 aux calls (budget)', async () => {
    const aux = new FakeAux(async () => ({ refs: ['A1'], confidence: 1 }));
    const r = await resolveArtifactsWithAux({ question: 'thiết kế container bạn làm trước đó', artifacts: [ambiguous[0]] }, aux);
    expect(r.source).toBe(ResolvedRefSource.RULE);
    expect(aux.calls).toHaveLength(0);
  });

  it('ambiguous → aux settles it; ids it invents are dropped; low confidence / timeout / error stay ambiguous', async () => {
    const good = new FakeAux(async () => ({ refs: ['A1', 'A42'], confidence: 0.9 }));
    const settled = await resolveArtifactsWithAux({ question: 'thiết kế container', artifacts: ambiguous }, good);
    expect(settled).toMatchObject({ source: ResolvedRefSource.AUX, ambiguous: false });
    expect(settled.picked.map((a) => a.id)).toEqual(['a1']);
    expect(good.calls[0].registry.map((e) => e.alias)).toEqual(['A1', 'A3']);

    const unsure = await resolveArtifactsWithAux({ question: 'thiết kế container', artifacts: ambiguous }, new FakeAux(async () => ({ refs: ['A1'], confidence: 0.3 })));
    expect(unsure.source).toBe(ResolvedRefSource.AMBIGUOUS);
    const slow = await resolveArtifactsWithAux(
      { question: 'thiết kế container', artifacts: ambiguous, settings: { auxTimeoutMs: 10 } },
      new FakeAux(() => new Promise((resolve) => setTimeout(() => resolve({ refs: ['A1'], confidence: 1 }), 200))),
    );
    expect(slow.source).toBe(ResolvedRefSource.AMBIGUOUS);
    const broken = await resolveArtifactsWithAux({ question: 'thiết kế container', artifacts: ambiguous }, new FakeAux(async () => { throw new Error('boom'); }));
    expect(broken.source).toBe(ResolvedRefSource.AMBIGUOUS);
  });

  it('rules mode never calls the aux resolver', async () => {
    const aux = new FakeAux(async () => ({ refs: ['A1'], confidence: 1 }));
    const r = await resolveArtifactsWithAux({ question: 'thiết kế container', artifacts: ambiguous, settings: { mode: ArtifactResolverMode.RULES } }, aux);
    expect(r.source).toBe(ResolvedRefSource.AMBIGUOUS);
    expect(aux.calls).toHaveLength(0);
  });
});

describe('JIT with the resolver (§3.4, §4)', () => {
  it('spec is cut per level, asked level first, then its PUML; the budget cuts the least relevant part', () => {
    const s = spec(1, 2, 'Hệ thống đặt vé', ['context', 'container']);
    const pumlContext = file(2, ArtifactKind.C4_PUML, 2, { objectKey: null, level: 'context', dataJson: { level: 'context', puml: 'PUML-CONTEXT' } });
    const pumlContainer = file(3, ArtifactKind.C4_PUML, 2, { objectKey: null, level: 'container', dataJson: { level: 'container', puml: 'PUML-CONTAINER' } });
    const ctx = assembleContext({ snapshot: snap([s, pumlContext, pumlContainer]), question: 'thiết kế container', currentImageCount: 0, currentImageNotes: [], settings: S });
    const order = ['level container ---', 'PUML-CONTAINER', 'level context ---', 'PUML-CONTEXT'].map((x) => ctx.jitText.indexOf(x));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(ctx.resolvedRefs).toMatchObject({ ids: ['A1'], source: ResolvedRefSource.RULE });
  });

  it('"hình bạn vẽ" attaches the C4 PNG, never the user\'s exam image', () => {
    const exam = file(1, ArtifactKind.USER_IMAGE, 1, { caption: 'Đề bài' });
    const s = spec(2, 2, 'Hệ thống đặt vé', ['container']);
    const png = file(3, ArtifactKind.C4_PNG, 2, { level: 'container' });
    const ctx = assembleContext({ snapshot: snap([exam, s, png], 5), question: 'hình bạn vẽ lúc nãy có gì?', currentImageCount: 0, currentImageNotes: [], settings: S });
    expect(ctx.jitImages.map((a) => a.id)).toEqual(['a3']);
  });

  it('ambiguous: max 2 compact choices + ask-back instruction, default = newest, its content inlined', () => {
    const v1 = spec(1, 2, 'Hệ thống đặt vé', ['container']);
    const v2 = spec(2, 4, 'Hệ thống đặt vé', ['container'], { label: 'C4 container · Hệ thống đặt vé · v2', version: 2, parentArtifactId: 'a1' });
    const ctx = assembleContext({ snapshot: snap([v1, v2]), question: 'thiết kế container', currentImageCount: 0, currentImageNotes: [], settings: S });
    expect(ctx.jitText).toContain('[AMBIGUOUS REFERENCE]');
    expect(ctx.jitText).toContain('1. [A1] C4 container · Hệ thống đặt vé (turn 1)');
    expect(ctx.jitText).toContain('2. [A2] C4 container · Hệ thống đặt vé · v2 (turn 2)');
    expect(ctx.jitText).toContain('tạm trả lời theo (2) [A2]');
    expect(ctx.jitText).toContain('--- [A2] c4_spec');
    expect(ctx.jitText).not.toContain('--- [A1] c4_spec');
    expect(ctx.resolvedRefs).toMatchObject({ ids: ['A1', 'A2'], source: ResolvedRefSource.AMBIGUOUS });
  });

  it('mode off keeps the 04 behaviour (latest spec on a design word)', () => {
    const settings = { ...S, resolver: { ...S.resolver, mode: ArtifactResolverMode.OFF } };
    const ctx = assembleContext({ snapshot: snap([spec(1, 2, 'A', ['container']), spec(2, 4, 'B', ['container'])]), question: 'thiết kế container', currentImageCount: 0, currentImageNotes: [], settings });
    expect(ctx.jitText).toContain('--- [A2] c4_spec');
    expect(ctx.jitText).not.toContain('--- [A1] c4_spec');
  });
});
