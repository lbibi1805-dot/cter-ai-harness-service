import { AgentToolName as AgentToolNameValue, type AgentTool, type AgentToolName, type ToolResult } from '../../../agent/domain';
import { ArtifactKind, type ConversationSnapshot, type StoredArtifact } from '../../../conversation-store';
import { artifactAlias, levelsOf, ownerOf, specLevels } from '../../domain/artifactMetadata';
import { registryLine } from '../../domain/contextAssembler';
import { ArtifactPart, ArtifactToolName } from '../../domain/enums/context.enums';
import {
  ARTIFACT_TOOL_MAX_CHARS,
  ARTIFACT_TOOL_TRUNCATED,
  GET_ARTIFACT_DESCRIPTION,
  LIST_ARTIFACTS_DESCRIPTION,
  NO_ARTIFACTS,
  NO_CONVERSATION,
  unknownArtifact,
} from './constants/artifactTools.constants';

/** The conversation snapshot of the CURRENT request (read once by `turns.begin`). */
export type ArtifactSnapshotProvider = () => ConversationSnapshot | null | undefined | Promise<ConversationSnapshot | null | undefined>;

const PARTS = Object.values(ArtifactPart) as string[];

/** `ArtifactToolName` values mirror `AgentToolName.LIST_ARTIFACTS` / `GET_ARTIFACT`. */
function toolName(name: ArtifactToolName): AgentToolName {
  return name === ArtifactToolName.LIST_ARTIFACTS ? AgentToolNameValue.LIST_ARTIFACTS : AgentToolNameValue.GET_ARTIFACT;
}

function clip(text: string): string {
  return text.length > ARTIFACT_TOOL_MAX_CHARS ? `${text.slice(0, ARTIFACT_TOOL_MAX_CHARS)}${ARTIFACT_TOOL_TRUNCATED}` : text;
}

function stringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function describe(a: StoredArtifact, all: StoredArtifact[]): string {
  const parent = a.parentArtifactId ? all.find((x) => x.id === a.parentArtifactId) : undefined;
  const levels = levelsOf(a);
  return [
    registryLine(a),
    `owner ${ownerOf(a)}`,
    levels.length ? `levels ${levels.join('+')}` : '',
    (a.version ?? 1) > 1 ? `v${a.version}${parent ? ` (previous: ${artifactAlias(parent)})` : ''}` : '',
  ].filter(Boolean).join(' · ');
}

function pumlParts(a: StoredArtifact, all: StoredArtifact[], level: string | undefined): string[] {
  const pumls = a.kind === ArtifactKind.C4_PUML ? [a]
    : a.kind === ArtifactKind.C4_SPEC ? all.filter((x) => x.kind === ArtifactKind.C4_PUML && x.messageId === a.messageId) : [];
  const parts: string[] = [];
  for (const p of pumls) {
    if (level && !levelsOf(p).includes(level)) continue;
    const puml = (p.dataJson as { puml?: unknown } | null)?.puml;
    if (typeof puml === 'string') parts.push(`--- ${artifactAlias(p)} PlantUML ${levelsOf(p).join('+')} ---\n${puml}`);
  }
  return parts;
}

function readParts(a: StoredArtifact, all: StoredArtifact[], part: ArtifactPart, level: string | undefined): string[] {
  const parts: string[] = [];
  const wants = (p: ArtifactPart) => part === ArtifactPart.ALL || part === p;
  if (a.caption && wants(ArtifactPart.OCR)) parts.push(`Caption: ${a.caption}`);
  if (a.ocrText && wants(ArtifactPart.OCR)) parts.push(`OCR:\n${a.ocrText}`);
  if (a.kind === ArtifactKind.C4_SPEC && wants(ArtifactPart.SPEC)) {
    const levels = specLevels(a).filter((l) => !level || l.level === level);
    parts.push(levels.length ? levels.map((l) => JSON.stringify(l)).join('\n') : JSON.stringify(a.dataJson));
  } else if (a.kind !== ArtifactKind.C4_PUML && a.dataJson && wants(ArtifactPart.SPEC)) {
    parts.push(JSON.stringify(a.dataJson));
  }
  if (wants(ArtifactPart.PUML)) parts.push(...pumlParts(a, all, level));
  return parts;
}

/** Discovery only: conversation artifacts are not vault files, so no citable sources. */
export class ListArtifactsTool implements AgentTool {
  readonly name = toolName(ArtifactToolName.LIST_ARTIFACTS);
  readonly description = LIST_ARTIFACTS_DESCRIPTION;
  readonly parameters = { type: 'object', properties: {}, additionalProperties: false };

  constructor(private readonly snapshot: ArtifactSnapshotProvider) {}

  async execute(): Promise<ToolResult> {
    const snapshot = await this.snapshot();
    if (!snapshot) return { content: NO_CONVERSATION, sources: [] };
    if (snapshot.artifacts.length === 0) return { content: NO_ARTIFACTS, sources: [] };
    return { content: clip(snapshot.artifacts.map((a) => describe(a, snapshot.artifacts)).join('\n')), sources: [] };
  }
}

export class GetArtifactTool implements AgentTool {
  readonly name = toolName(ArtifactToolName.GET_ARTIFACT);
  readonly description = GET_ARTIFACT_DESCRIPTION;
  readonly parameters = {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Artifact alias such as "A7" (from the registry or list_artifacts).' },
      part: { type: 'string', enum: PARTS, description: 'Which part to read (default all).' },
      level: { type: 'string', description: 'C4 level to read from a spec (context, container, component, sequence).' },
    },
    required: ['id'],
    additionalProperties: false,
  };

  constructor(private readonly snapshot: ArtifactSnapshotProvider) {}

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const snapshot = await this.snapshot();
    if (!snapshot) return { content: NO_CONVERSATION, sources: [] };
    const id = (stringArg(args, 'id') ?? '').replace(/^\[|\]$/g, '').toUpperCase();
    const artifact = snapshot.artifacts.find((a) => artifactAlias(a) === id || a.id.toUpperCase() === id);
    if (!artifact) return { content: unknownArtifact(id), sources: [] };
    const requested = stringArg(args, 'part') ?? '';
    const part = PARTS.includes(requested) ? (requested as ArtifactPart) : ArtifactPart.ALL;
    const level = stringArg(args, 'level')?.toLowerCase();
    return { content: clip([describe(artifact, snapshot.artifacts), ...readParts(artifact, snapshot.artifacts, part, level)].join('\n\n')), sources: [] };
  }
}

/**
 * `list_artifacts` + `get_artifact` for agent mode (note 17 step 8). Create them per
 * request: `createArtifactTools(() => turn.snapshot)`. Read-only, no DB access: they read
 * the snapshot `turns.begin` already loaded.
 */
export function createArtifactTools(snapshot: ArtifactSnapshotProvider): AgentTool[] {
  return [new ListArtifactsTool(snapshot), new GetArtifactTool(snapshot)];
}
