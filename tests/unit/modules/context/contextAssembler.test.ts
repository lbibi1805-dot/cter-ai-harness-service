import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONTEXT_SETTINGS,
  assembleContext,
  ensureArtifactRefs,
  needsQueryRewrite,
  planCompaction,
  registryLine,
} from '../../../../src/modules/context';
import { ArtifactKind, MessageKind, MessageRole, type ConversationSnapshot, type StoredArtifact, type StoredMessage } from '../../../../src/modules/conversation-store';
import { PromptPreparer, RagAvailability } from '../../../../src/modules/ai';
import { PromptCacheLayout } from '../../../../src/modules/ai/domain/enums/promptLayout.enums';
import { CitationPromptBuilder } from '../../../../src/modules/retrieval';

const S = DEFAULT_CONTEXT_SETTINGS;

function msg(seq: number, text: string, kind = MessageKind.CHAT): StoredMessage {
  return { id: `m${seq}`, seq, role: seq % 2 ? MessageRole.USER : MessageRole.ASSISTANT, kind, text };
}

function art(ordinal: number, kind: ArtifactKind, messageSeq: number, extra: Partial<StoredArtifact> = {}): StoredArtifact {
  return { id: `a${ordinal}`, ordinal, kind, messageId: `m${messageSeq}`, messageSeq, objectKey: kind === ArtifactKind.USER_IMAGE ? `conversations/c/a${ordinal}.png` : null, mime: 'image/png', caption: null, ocrText: null, dataJson: null, ...extra };
}

function snap(messages: StoredMessage[], artifacts: StoredArtifact[] = [], summary: string | null = null, summaryUptoSeq = 0): ConversationSnapshot {
  return { id: 'c', title: 't', summary, summaryUptoSeq, state: {}, deletedAt: null, lastSeq: messages.at(-1)?.seq ?? 0, messages, artifacts, artifactCount: artifacts.length };
}

describe('Context Assembler: layers', () => {
  it('② summary + ③ registry go to memory; ④ history keeps image ids and captions', () => {
    const s = snap(
      [msg(1, 'Đây là đề bài'), msg(2, 'Đã đọc đề'), msg(3, 'Câu khác'), msg(4, 'Trả lời')],
      [art(1, ArtifactKind.USER_IMAGE, 1, { caption: 'Đề bài hệ thống đặt vé, 5 NFR' })],
      'Mục tiêu: ôn C4',
      0,
    );
    const ctx = assembleContext({ snapshot: s, question: 'tiếp tục', currentImageCount: 0, currentImageNotes: [], settings: S });
    expect(ctx.memory).toContain('## CONVERSATION MEMORY');
    expect(ctx.memory.indexOf('Mục tiêu: ôn C4')).toBeLessThan(ctx.memory.indexOf('[A1] user_image · turn 1 · "Đề bài hệ thống đặt vé, 5 NFR"'));
    expect(ctx.history[0]).toEqual({ role: 'user', text: 'Đây là đề bài\n[ảnh đính kèm: A1 — Đề bài hệ thống đặt vé, 5 NFR]' });
    expect(ctx.history).toHaveLength(4);
  });

  it('a new conversation has no memory, no history, the plain question as RAG query', () => {
    const ctx = assembleContext({ snapshot: null, question: 'mutex là gì', currentImageCount: 0, currentImageNotes: [], settings: S });
    expect(ctx).toEqual({ history: [], memory: '', summary: '', registry: '', jitText: '', jitImages: [], hotWindow: [], retrievalQuery: 'mutex là gì', retrievalHints: [], resolvedRefs: null });
  });

  it('registry is capped to the newest lines', () => {
    const artifacts = Array.from({ length: 50 }, (_, i) => art(i + 1, ArtifactKind.C4_PNG, 2));
    const ctx = assembleContext({ snapshot: snap([msg(1, 'q'), msg(2, 'a')], artifacts), question: 'x', currentImageCount: 0, currentImageNotes: [], settings: S });
    expect(ctx.memory).not.toContain('[A10] ');
    expect(ctx.memory).toContain('[A11] ');
    expect(ctx.memory).toContain('[A50] ');
  });
});

describe('Context Assembler: just-in-time artifacts', () => {
  const old = snap(
    [msg(1, 'đề đây'), msg(2, 'ok'), msg(3, 'hỏi khác'), msg(4, 'đáp'), msg(5, 'hỏi nữa'), msg(6, 'đáp')],
    [art(1, ArtifactKind.USER_IMAGE, 1, { ocrText: 'Hệ thống đặt vé xem phim' })],
  );

  it('an image from an older turn is NOT re-attached for an unrelated question', () => {
    const ctx = assembleContext({ snapshot: old, question: 'mutex là gì', currentImageCount: 0, currentImageNotes: [], settings: S });
    expect(ctx.jitImages).toEqual([]);
    expect(ctx.jitText).toBe('');
  });

  it('"đề lúc nãy" re-attaches it, labels it after the current images, and adds its OCR to the RAG query', () => {
    const ctx = assembleContext({ snapshot: old, question: 'đề lúc nãy yêu cầu gì?', currentImageCount: 1, currentImageNotes: [], settings: S });
    expect(ctx.jitImages.map((a) => a.id)).toEqual(['a1']);
    expect(ctx.jitText).toContain('#2 = [A1] user_image · turn 1');
    expect(ctx.retrievalQuery).toBe('hỏi nữa\nđề lúc nãy yêu cầu gì?\nHệ thống đặt vé xem phim');
  });

  it('images of the last two user turns are always re-attached; at most jitMaxImages', () => {
    const recent = snap(
      [msg(1, 'a'), msg(2, 'b'), msg(3, 'c'), msg(4, 'd')],
      [art(1, ArtifactKind.USER_IMAGE, 1), art(2, ArtifactKind.USER_IMAGE, 1), art(3, ArtifactKind.USER_IMAGE, 3), art(4, ArtifactKind.USER_IMAGE, 3)],
    );
    const ctx = assembleContext({ snapshot: recent, question: 'tiếp', currentImageCount: 0, currentImageNotes: [], settings: { ...S, hotWindowTurns: 0 } });
    expect(ctx.jitImages.map((a) => a.ordinal)).toEqual([2, 3, 4]);
  });

  it('a design question inlines the latest C4 spec + its PUML (within the size budget)', () => {
    const s = snap([msg(1, '/c4 vé'), msg(2, 'Đã vẽ', MessageKind.C4)], [
      art(1, ArtifactKind.C4_SPEC, 2, { dataJson: { systemName: 'Ticketing', levels: [{ spec: { elements: [{ name: 'Message Queue' }] } }] } }),
      art(2, ArtifactKind.C4_PNG, 2),
      art(3, ArtifactKind.C4_PUML, 2, { dataJson: { puml: '@startuml\nContainer(mq, "Message Queue")\n@enduml' } }),
    ]);
    const ctx = assembleContext({ snapshot: s, question: 'vì sao dùng message queue?', currentImageCount: 0, currentImageNotes: [], settings: { ...S, jitMaxChars: 200 } });
    expect(ctx.jitText).toContain('[CONVERSATION ARTIFACTS]');
    expect(ctx.jitText).toContain('Message Queue');
    expect(ctx.jitText).toContain('--- [A1] c4_spec');
    expect(ctx.jitText).toContain('--- [A3] c4_puml');
    expect(ctx.jitText.length).toBeLessThan(200 + 400);
  });

  it('an explicit [A2] reference attaches that artifact', () => {
    const s = snap([msg(1, 'q'), msg(2, 'a'), msg(3, 'q'), msg(4, 'a'), msg(5, 'q'), msg(6, 'a')], [art(1, ArtifactKind.USER_IMAGE, 1), art(2, ArtifactKind.USER_IMAGE, 1)]);
    const ctx = assembleContext({ snapshot: s, question: 'giải thích A2', currentImageCount: 0, currentImageNotes: [], settings: S });
    expect(ctx.jitImages.map((a) => a.ordinal)).toEqual([2]);
  });

  it('an image-only question searches with the OCR of the image', () => {
    const ctx = assembleContext({ snapshot: null, question: '', currentImageCount: 1, currentImageNotes: [{ caption: 'code', ocrText: 'pthread_mutex_lock' }], settings: S });
    expect(ctx.retrievalQuery).toBe('pthread_mutex_lock');
  });
});

describe('auto-compact planning', () => {
  const settings = { ...S, compactMaxTurns: 4, keepRecentTurns: 2, compactThresholdTokens: 1_000_000 };

  it('nothing to do under the thresholds', () => {
    expect(planCompaction(0, [msg(1, 'q'), msg(2, 'a')], [], settings)).toBeNull();
  });

  it('folds all but the newest keepRecentTurns turns and requires every older artifact id', () => {
    const messages = Array.from({ length: 10 }, (_, i) => msg(i + 1, `t${i + 1}`));
    const plan = planCompaction(0, messages, [art(1, ArtifactKind.USER_IMAGE, 1), art(2, ArtifactKind.C4_SPEC, 8)], settings)!;
    expect(plan.toSummarize.map((m) => m.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plan.uptoSeq).toBe(6);
    expect(plan.requiredRefs).toEqual(['A1']);
  });

  it('the token threshold triggers too', () => {
    const big = 'x'.repeat(4 * 200);
    const messages = Array.from({ length: 6 }, (_, i) => msg(i + 1, big));
    expect(planCompaction(0, messages, [], { ...S, compactThresholdTokens: 500, keepRecentTurns: 1 })!.uptoSeq).toBe(4);
  });

  it('a summary never loses an artifact id', () => {
    expect(ensureArtifactRefs('🎯 Mục tiêu: ôn\n🔗 Artifact refs: A1 đề', ['A1', 'A12'])).toBe('🎯 Mục tiêu: ôn\n🔗 Artifact refs: A1 đề\n\n🔗 Artifact refs: A12');
    expect(ensureArtifactRefs('mentions A1 and A12', ['A1', 'A12'])).toBe('mentions A1 and A12');
  });
});

describe('follow-up detection', () => {
  it('rewrites short pronoun follow-ups only', () => {
    expect(needsQueryRewrite('giải thích nó kỹ hơn', true)).toBe(true);
    expect(needsQueryRewrite('explain that again', true)).toBe(true);
    expect(needsQueryRewrite('giải thích nó kỹ hơn', false)).toBe(false);
    expect(needsQueryRewrite('mutex và semaphore khác nhau thế nào', true)).toBe(false);
  });

  it('registry line format', () => {
    expect(registryLine(art(3, ArtifactKind.USER_IMAGE, 3, { caption: 'Đề bài' }))).toBe('[A3] user_image · turn 2 · "Đề bài"');
  });
});

describe('PromptPreparer: layout V1 (PROMPT_CACHE_LAYOUT=v1, rollback)', () => {
  it('system prompt (static) → memory; JIT before RAG context before the question', async () => {
    const rag = new RagAvailability();
    const retrieve = async (q: string) => [{ chunkId: 'c', text: `ctx for ${q}`, source: 's.md', heading: 'H', parentHeading: '', tokenCount: 1 }];
    rag.markReady({ retriever: { retrieve }, builder: new CitationPromptBuilder() });
    const prepared = await new PromptPreparer('STATIC SYSTEM', '', rag, PromptCacheLayout.V1).prepare({
      textContent: 'QUESTION', imageBuffers: [], history: [], memory: 'MEMORY', jitContext: 'JIT', retrievalQuery: 'REWRITTEN',
    });
    expect(prepared.systemPrompt.startsWith('STATIC SYSTEM')).toBe(true);
    expect(prepared.systemPrompt.endsWith('MEMORY')).toBe(true);
    const user = prepared.content.textContent;
    expect(user.indexOf('JIT')).toBeLessThan(user.indexOf('ctx for REWRITTEN'));
    expect(user.indexOf('ctx for REWRITTEN')).toBeLessThan(user.indexOf('QUESTION'));
  });

  it('the static prefix is byte-identical whatever the memory (cacheable)', async () => {
    const p = new PromptPreparer('STATIC', 'KB', new RagAvailability(), PromptCacheLayout.V1);
    const a = await p.prepare({ textContent: 'q', imageBuffers: [], memory: 'm1' });
    const b = await p.prepare({ textContent: 'q', imageBuffers: [], memory: 'other memory' });
    expect(a.systemPrompt.slice(0, 6)).toBe(b.systemPrompt.slice(0, 6));
    expect(a.content.textContent).toContain('KB');
  });
});

describe('Context Assembler: hot window (note 18 step 5)', () => {
  const png = (ordinal: number, seq: number) => art(ordinal, ArtifactKind.C4_PNG, seq, { objectKey: `conversations/c/a${ordinal}.png` });
  // 4 pairs: user images in turns 1 and 3, a C4 PNG drawn by the assistant in turn 4.
  const messages = [msg(1, 'đề 1'), msg(2, 'ok 1'), msg(3, 'hỏi 2'), msg(4, 'ok 2'), msg(5, 'đề 3'), msg(6, 'ok 3'), msg(7, '/c4 vẽ'), msg(8, 'đã vẽ', MessageKind.C4)];
  const artifacts = [art(1, ArtifactKind.USER_IMAGE, 1), art(2, ArtifactKind.USER_IMAGE, 5), art(3, ArtifactKind.USER_IMAGE, 5), png(4, 8)];
  const assemble = (settings: typeof S, question = 'tiếp', current = 0, snapshot = snap(messages, artifacts)) =>
    assembleContext({ snapshot, question, currentImageCount: current, currentImageNotes: [], settings });

  it('K=2 picks the images of the last 2 pairs only, in place: user images on the user turn, the PNG on the assistant turn', () => {
    const ctx = assemble({ ...S, hotWindowTurns: 2 });
    expect(ctx.hotWindow.map((s) => [s.turnIndex, s.artifacts.map((a) => a.ordinal)])).toEqual([[4, [2, 3]], [7, [4]]]);
    expect(ctx.history[4].text).toContain('đề 3');
    expect(ctx.history[7].role).toBe('assistant');
  });

  it('a picked image already in the window is not re-attached in the tail (dedupe by artifact id)', () => {
    const off = assemble({ ...S, hotWindowTurns: 0 });
    expect(off.jitImages.map((a) => a.ordinal)).toEqual([2, 3]);           // the last two user turns' images (old rule)
    const on = assemble({ ...S, hotWindowTurns: 2 });
    expect(on.jitImages).toEqual([]);
    expect(on.jitText).toContain('[A2] user_image');
    expect(on.jitText).toContain('already shown in place');
    expect(on.jitText).not.toContain('re-attached from earlier turns');
  });

  it('images outside the window keep the JIT behaviour', () => {
    const ctx = assemble({ ...S, hotWindowTurns: 1 }, 'ảnh [A1] nói gì?');
    expect(ctx.hotWindow.map((s) => s.artifacts.map((a) => a.ordinal))).toEqual([[4]]);
    expect(ctx.jitImages.map((a) => a.ordinal)).toContain(1);
  });

  it('K=0 is the old output exactly', () => {
    const off = assemble({ ...S, hotWindowTurns: 0 });
    expect(off.hotWindow).toEqual([]);
    const { hotWindow: _ignored, ...rest } = off;
    const legacy = assemble({ ...S, hotWindowTurns: 0, maxPromptImages: 0 });  // the cap only applies to the window
    expect({ ...legacy, hotWindow: undefined }).toEqual({ ...rest, hotWindow: undefined });
    expect(off.history.every((t) => !('images' in t))).toBe(true);
  });

  it('total images are capped: the oldest window images go first, resolver picks last', () => {
    const ctx = assemble({ ...S, hotWindowTurns: 2, maxPromptImages: 4 }, 'tiếp', 2);
    expect(ctx.hotWindow.flatMap((s) => s.artifacts.map((a) => a.ordinal))).toEqual([2, 3]);  // A4 (not picked) dropped… 
    expect(ctx.jitImages).toEqual([]);
    const tight = assemble({ ...S, hotWindowTurns: 2, maxPromptImages: 3 }, 'tiếp', 2);
    expect(tight.hotWindow.flatMap((s) => s.artifacts.map((a) => a.ordinal))).toEqual([3]);
  });

  it('the turns before the window are byte-identical between turn n and n+1 (cacheable prefix)', () => {
    const turnN = assemble({ ...S, hotWindowTurns: 2 });
    const more = [...messages, msg(9, 'tiếp nữa'), msg(10, 'ok 5')];
    const turnN1 = assemble({ ...S, hotWindowTurns: 2 }, 'tiếp', 0, snap(more, artifacts));
    const startN = turnN.history.length - 4;
    expect(JSON.stringify(turnN1.history.slice(0, startN))).toBe(JSON.stringify(turnN.history.slice(0, startN)));
    expect(turnN.history.slice(0, startN).every((t) => !('images' in t))).toBe(true);
    // The window slid: turn n's user image pair is now outside it, the drawing is still inside.
    expect(turnN1.hotWindow.map((s) => s.turnIndex)).toEqual([7]);
  });
});
