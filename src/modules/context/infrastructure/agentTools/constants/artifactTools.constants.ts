/** Tool results are capped like other agent tools: the model can ask for one level or part instead. */
export const ARTIFACT_TOOL_MAX_CHARS = 12_000;
export const ARTIFACT_TOOL_TRUNCATED = '\n…[truncated — ask for one level or part]';

export const LIST_ARTIFACTS_DESCRIPTION = 'List the artifacts of THIS conversation (images, C4 specs/diagrams/PlantUML, design notes, reviews): id alias, kind, turn, owner, version and label. Use it before get_artifact when unsure which design the user means.';
export const GET_ARTIFACT_DESCRIPTION = 'Read one artifact of THIS conversation by its alias (e.g. "A7"). Optional part: spec | puml | ocr | all; optional level (context | container | component | sequence) to read one C4 level only. Images come back as caption + OCR text.';

export const NO_CONVERSATION = 'This request has no stored conversation: there are no artifacts.';
export const NO_ARTIFACTS = 'This conversation has no artifacts yet.';
export function unknownArtifact(id: string): string {
  return `Artifact "${id}" not found in this conversation. Call list_artifacts to see the ids.`;
}
