import { extractPlantUmlBlocks, normalizePlantUmlSource, plantUmlC4Level } from '../../../shared/text';
import { ArtifactKind, MessageRole, type StoredArtifact } from '../../conversation-store';
import type { RecordedArtifact } from '../application/interfaces/conversationTurn.interface';
import { levelsOf, systemNameOf } from './artifactMetadata';

/** A chat answer rarely holds more than one diagram; more are ignored (memory stays small). */
const MAX_CHAT_PUML_ARTIFACTS = 3;
const PUML_MIME = 'text/plain';
/** Kinds that identify the design a chat edit is based on. */
const DESIGN_BASE_KINDS = new Set<ArtifactKind>([ArtifactKind.C4_SPEC, ArtifactKind.C4_PUML, ArtifactKind.C4_PNG]);

function pumlOf(artifact: StoredArtifact): string | undefined {
  const data = artifact.dataJson as { puml?: unknown } | null | undefined;
  return typeof data?.puml === 'string' ? normalizePlantUmlSource(data.puml) : undefined;
}

/**
 * PlantUML blocks of a chat answer as `c4_puml` artifacts of the assistant message (same dataJson shape as the
 * C4 recorder: `{ puml, level? }`), so a later "hình vừa sửa" resolves to them. When the turn was about an
 * existing design (resolver picked a c4_spec/c4_puml/c4_png), the block continues its chain: version = base + 1,
 * same system name. A block identical to a picked PUML (an unchanged echo) is not stored again. Pure.
 */
export function chatPlantUmlArtifacts(answerText: string, picked: readonly StoredArtifact[] = []): RecordedArtifact[] {
  const blocks = extractPlantUmlBlocks(answerText);
  if (blocks.length === 0) return [];
  const bases = picked.filter((a) => DESIGN_BASE_KINDS.has(a.kind));
  const known = new Set(bases.map(pumlOf).filter((p): p is string => !!p));
  const base = [...bases].sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0];
  const systemName = bases.map((a) => systemNameOf(a)).find(Boolean);
  const seen = new Set<string>();
  const artifacts: RecordedArtifact[] = [];
  for (const block of blocks) {
    const puml = normalizePlantUmlSource(block);
    if (seen.has(puml) || known.has(puml)) continue;
    seen.add(puml);
    const level = plantUmlC4Level(puml) ?? (base && bases.length === 1 ? levelsOf(base)[0] : undefined);
    artifacts.push({
      kind: ArtifactKind.C4_PUML,
      owner: MessageRole.ASSISTANT,
      bytes: Buffer.from(puml, 'utf-8'),
      mime: PUML_MIME,
      caption: `PlantUML ${level ?? 'diagram'} — sửa trong chat${systemName ? ` · ${systemName}` : ''}`,
      dataJson: { puml, ...(level ? { level } : {}) },
      ...(level ? { level } : {}),
      ...(systemName ? { systemName } : {}),
      ...(base ? { version: (base.version ?? 1) + 1, parentArtifactId: base.id } : {}),
    });
    if (artifacts.length >= MAX_CHAT_PUML_ARTIFACTS) break;
  }
  return artifacts;
}
