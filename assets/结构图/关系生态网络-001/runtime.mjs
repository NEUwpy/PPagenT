import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function selectedItems(content, compositionPage) {
  const ids = new Set(compositionPage?.componentItemIds ?? []);
  return ids.size ? content.items.filter((item) => ids.has(item.id)) : content.items;
}

function actor(item) {
  return {
    key: item.id,
    title: item.title,
    body: item.body,
  };
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const structured = content?.structuredData;
  if (structured?.type !== "internal-external-ecosystem") {
    throw new Error("内外协同生态网络要求 PageContent.structuredData.type=internal-external-ecosystem");
  }
  const selected = new Map(selectedItems(content, compositionPage).map((item) => [item.id, item]));
  const internalNodes = structured.internalIds.map((id) => selected.get(id)).filter(Boolean).map(actor);
  const externalNodes = structured.externalIds.map((id) => selected.get(id)).filter(Boolean).map(actor);
  if (internalNodes.length < 2 || internalNodes.length > 4) {
    throw new Error("内外协同生态网络要求选择 2–4 个内部主体");
  }
  if (externalNodes.length < 2 || externalNodes.length > 4) {
    throw new Error("内外协同生态网络要求选择 2–4 个外部伙伴");
  }
  const selectedIds = new Set([...internalNodes, ...externalNodes].map((item) => item.key));
  const links = structured.links
    .filter((link) => selectedIds.has(link.from) && selectedIds.has(link.to))
    .map((link) => ({ from: link.from, to: link.to }));
  return renderPayload(intent, "network-internal-external-ecosystem-001", {
    core: structured.core,
    internal: { title: structured.internalTitle, nodes: internalNodes },
    external: { title: structured.externalTitle, nodes: externalNodes },
    links,
  }, [...internalNodes, ...externalNodes].map((item, index) => mapping(item.key, index < internalNodes.length
    ? `internal.nodes[${index}]`
    : `external.nodes[${index - internalNodes.length}]`)));
}
