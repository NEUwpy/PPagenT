import { getCandidate } from "../_review-refresh/components.mjs?v=6";

const candidate = getCandidate("layered-iceberg-depth-006");
export const visualComponent = candidate.visualComponent;
export const previewParameters = candidate.previewParameters;
export const resolvePreviewParameters = candidate.resolvePreviewParameters;
