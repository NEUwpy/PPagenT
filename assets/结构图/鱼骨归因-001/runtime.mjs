import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

// Dashboard runtime modules are cache-busted, while their static review import
// may belong to an older long-running process. Let the dashboard use its fresh
// review module; ordinary generation imports still receive the formal export.
export const fishboneVisualComponent = new URL(import.meta.url).searchParams.has("dashboard")
  ? undefined
  : visualComponent;

function componentItems(content, compositionPage) {
  const ids = new Set(compositionPage?.componentItemIds ?? []);
  return ids.size ? content.items.filter((item) => ids.has(item.id)) : content.items;
}

function bindingEntries(compositionPage, itemId) {
  return (compositionPage?.componentBindings ?? [])
    .find((binding) => binding.bindingId === "cause-factors" && binding.sourceItemId === itemId)
    ?.entries?.map((entry) => entry.text).filter(Boolean) ?? [];
}

function fallbackFactors(item) {
  const points = (item.points ?? []).map((point) => point?.text ?? point).filter(Boolean);
  return (points.length ? points : [item.body]).filter(Boolean).slice(0, 3);
}

function effectTitle(content, compositionPage) {
  return (compositionPage?.componentText ?? [])
    .find((entry) => entry.sourceField === "page-title" && entry.targetRole === "center-title")
    ?.text ?? content.title;
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const items = componentItems(content, compositionPage);
  return renderPayload(intent, "causal-fishbone-attribution-001", {
    effect: { title: effectTitle(content, compositionPage), body: "" },
    causes: items.map((item) => {
      const adapted = bindingEntries(compositionPage, item.id);
      return {
        key: item.id,
        title: item.title,
        factors: adapted.length ? adapted : fallbackFactors(item),
      };
    }),
  }, items.map((item, index) => mapping(item.id, `causes[${index}]`)));
}
