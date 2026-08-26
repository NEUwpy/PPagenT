import { getCandidate } from "../_review-refresh/components.mjs?v=8";

const candidate = getCandidate("layered-iceberg-depth-006");
export const visualComponent = Object.freeze({ ...candidate.visualComponent, cssFile: "component.css" });
export const previewParameters = candidate.previewParameters;
export const resolvePreviewParameters = candidate.resolvePreviewParameters;
