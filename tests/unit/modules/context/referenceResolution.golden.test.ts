import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  DEFAULT_CONTEXT_SETTINGS,
  DEFAULT_PINNED_KINDS,
  DEFAULT_RESOLVER_SETTINGS,
  artifactLabel,
  resolveArtifacts,
  selectJit,
} from '../../../../src/modules/context';
import { ArtifactKind, MessageKind, MessageRole, type ConversationSnapshot, type StoredArtifact, type StoredMessage } from '../../../../src/modules/conversation-store';

/**
 * Golden set of note 17 §6, offline: metadata-only fake conversations, rules only (no aux, no tokens).
 * The snapshot is cut like `load` does (newest 40 artifacts + pinned design kinds).
 */
interface ShortArtifact {
  a: number;
  kind: ArtifactKind;
  turn: number;
  system?: string;
  levels?: string[];
  elements?: string[];
  caption?: string;
  owner?: MessageRole;
  parent?: number;
  version?: number;
}

interface GoldenCase {
  id: string;
  group: string;
  question: string;
  conversation: { turns: number; artifacts: ShortArtifact[]; fill?: { c4Runs: number; images: number } };
  ref_ids?: string[];
  expected_refs?: string[];
  expect_ambiguous?: boolean;
  expected_choices?: string[];
  expect_images?: string[];
  expect_first_level?: string;
}

const GOLDEN_PATH = join(process.cwd(), 'evals', 'golden', 'reference-resolution.jsonl');
const CASES: GoldenCase[] = readFileSync(GOLDEN_PATH, 'utf-8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as GoldenCase);
const FILL_SYSTEMS = ['Hệ thống đặt vé', 'Hệ thống thư viện'];
const IMAGE_FILES = new Set<ArtifactKind>([ArtifactKind.USER_IMAGE, ArtifactKind.C4_PNG]);

function expand(c: GoldenCase['conversation']): ShortArtifact[] {
  const artifacts = [...c.artifacts];
  if (!c.fill) return artifacts;
  let a = artifacts.length;
  for (let k = 0; k < c.fill.c4Runs; k++) {
    const system = FILL_SYSTEMS[k] ?? `Hệ thống mẫu ${k + 1}`;
    const elements = ['Web App', `Service ${k + 1}`];
    artifacts.push({ a: ++a, kind: ArtifactKind.C4_SPEC, turn: k + 1, system, levels: ['container'], elements });
    artifacts.push({ a: ++a, kind: ArtifactKind.C4_PNG, turn: k + 1, system, levels: ['container'] });
    artifacts.push({ a: ++a, kind: ArtifactKind.C4_PUML, turn: k + 1, system, levels: ['container'] });
  }
  for (let i = 0; i < c.fill.images; i++) artifacts.push({ a: ++a, kind: ArtifactKind.USER_IMAGE, turn: c.fill.c4Runs + 1 + i, caption: `Ảnh ${i + 1}` });
  return artifacts;
}

function toStored(s: ShortArtifact): StoredArtifact {
  const owner = s.owner ?? (s.kind === ArtifactKind.USER_IMAGE ? MessageRole.USER : MessageRole.ASSISTANT);
  const seq = owner === MessageRole.USER ? s.turn * 2 - 1 : s.turn * 2;
  const levels = s.levels ?? [];
  const dataJson = s.kind === ArtifactKind.C4_SPEC
    ? { systemName: s.system, levels: levels.map((level) => ({ level, title: s.system, spec: { elements: (s.elements ?? []).map((name) => ({ name })) } })) }
    : s.kind === ArtifactKind.DESIGN_NOTE ? { systemName: s.system, elements: (s.elements ?? []).map((name) => ({ name })), decisions: [] }
      : s.kind === ArtifactKind.C4_PUML ? { level: levels[0], puml: '@startuml\n@enduml' } : null;
  return {
    id: `a${s.a}`, ordinal: s.a, kind: s.kind, messageId: `m${seq}`, messageSeq: seq,
    objectKey: IMAGE_FILES.has(s.kind) ? `conversations/c/a${s.a}.png` : null, mime: 'image/png',
    caption: s.caption ?? null, ocrText: null, dataJson,
    label: artifactLabel({ kind: s.kind, systemName: s.system, levels, version: s.version, turn: s.turn }),
    level: levels.length ? levels.join('+') : null, owner,
    parentArtifactId: s.parent ? `a${s.parent}` : null, version: s.version ?? 1,
  };
}

/** Same window as `ConversationStore.load`: newest N + pinned kinds. */
function snapshotOf(c: GoldenCase['conversation']): ConversationSnapshot {
  const all = expand(c).map(toStored).sort((x, y) => x.ordinal - y.ordinal);
  const keep = new Set(all.slice(-DEFAULT_CONTEXT_SETTINGS.maxLoadArtifacts).map((a) => a.id));
  for (const a of all.filter((x) => DEFAULT_PINNED_KINDS.includes(x.kind)).slice(-DEFAULT_CONTEXT_SETTINGS.maxPinnedArtifacts)) keep.add(a.id);
  const messages: StoredMessage[] = Array.from({ length: c.turns * 2 }, (_, i) => ({
    id: `m${i + 1}`, seq: i + 1, role: i % 2 === 0 ? MessageRole.USER : MessageRole.ASSISTANT, kind: MessageKind.CHAT, text: `t${i + 1}`,
  }));
  return { id: 'c', title: 't', summary: null, summaryUptoSeq: 0, state: {}, deletedAt: null, lastSeq: messages.length, messages, artifacts: all.filter((a) => keep.has(a.id)), artifactCount: all.length };
}

const sorted = (xs: string[]) => [...xs].sort();
const same = (a: string[], b: string[]) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

function run(c: GoldenCase): { ok: boolean; got: string } {
  const snapshot = snapshotOf(c.conversation);
  const resolution = resolveArtifacts({ question: c.question, artifacts: snapshot.artifacts, messages: snapshot.messages, refIds: c.ref_ids, settings: DEFAULT_RESOLVER_SETTINGS });
  const selection = selectJit(snapshot, c.question, DEFAULT_CONTEXT_SETTINGS, resolution);
  const picked = resolution.picked.map((a) => `A${a.ordinal}`);
  const choices = resolution.candidates.map((x) => x.alias);
  const images = selection.images.map((a) => `A${a.ordinal}`);
  const got = `${resolution.source} picked=[${picked}] choices=[${resolution.ambiguous ? choices : ''}] images=[${images}] level=${selection.sections[0]?.level ?? '-'}`;
  if (c.expect_ambiguous) return { ok: resolution.ambiguous && (!c.expected_choices || same(choices, c.expected_choices)), got };
  let ok = !resolution.ambiguous && same(picked, c.expected_refs ?? []);
  if (c.expect_images) ok &&= same(images, c.expect_images);
  if (c.expect_first_level) ok &&= selection.sections[0]?.level === c.expect_first_level;
  return { ok, got };
}

describe('golden set: artifact reference resolution (note 17 §6)', () => {
  const results = CASES.map((c) => ({ c, ...run(c) }));

  it('covers every group of §6 with at least 20 cases', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(20);
    for (const group of ['1 design', '2 hệ thống', 'Version', 'Diễn đạt', 'Owner', 'Chat design', 'Dài', 'Mơ hồ', 'Âm tính']) {
      expect(CASES.some((c) => c.group === group), group).toBe(true);
    }
  });

  // `REF_EVAL_OUT=<file>` dumps per-case results (used by the eval report notebooks in evals/reports/).
  if (process.env.REF_EVAL_OUT) {
    writeFileSync(process.env.REF_EVAL_OUT, JSON.stringify(results.map((r) => ({
      id: r.c.id, group: r.c.group, question: r.c.question, ambiguousExpected: !!r.c.expect_ambiguous, ok: r.ok, got: r.got,
      source: r.got.split(' ')[0], artifacts: expand(r.c.conversation).length,
    })), null, 2));
  }

  it('ref accuracy ≥ 95% on non-ambiguous cases, ambiguity recall ≥ 90%', () => {
    const plain = results.filter((r) => !r.c.expect_ambiguous);
    const ambiguous = results.filter((r) => r.c.expect_ambiguous);
    const accuracy = plain.filter((r) => r.ok).length / plain.length;
    const recall = ambiguous.filter((r) => r.ok).length / ambiguous.length;
    const failures = results.filter((r) => !r.ok).map((r) => `${r.c.id} [${r.c.group}] "${r.c.question}" → ${r.got}`);
    // eslint-disable-next-line no-console
    console.info(`[golden] reference resolution: accuracy ${(accuracy * 100).toFixed(1)}% (${plain.length} cases), ambiguity recall ${(recall * 100).toFixed(1)}% (${ambiguous.length} cases)${failures.length ? `\n${failures.join('\n')}` : ''}`);
    expect(accuracy, failures.join('\n')).toBeGreaterThanOrEqual(0.95);
    expect(recall, failures.join('\n')).toBeGreaterThanOrEqual(0.9);
  });

  it.each(CASES.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const r = run(c);
    expect(r.ok, r.got).toBe(true);
  });
});
