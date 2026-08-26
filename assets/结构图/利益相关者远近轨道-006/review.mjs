import { getHubCandidate } from "../_hub-review/components.mjs?v=1";

const candidate = getHubCandidate("hub-orbit-priority-006");
export const visualComponent = candidate.visualComponent;
export const previewParameters = candidate.previewParameters;
export const resolvePreviewParameters = candidate.resolvePreviewParameters;
