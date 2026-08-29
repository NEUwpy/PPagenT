import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import { hierarchyMatrixFromStructuredData } from "../../../src/content/hierarchy-matrix.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

export function mapPageContent(content, intent) {
  const topology = hierarchyMatrixFromStructuredData(content?.structuredData);
  if (!topology) {
    throw new Error("深层归属树要求 PageContent.structuredData.type=hierarchy");
  }

  const parameters = {
    topology: {
      layers: topology.layers.map((layer) => layer.map((node) => ({
        key: node.id,
        title: node.label,
      }))),
      adjacency: topology.adjacency.map((matrix) => matrix.map((row) => [...row])),
    },
  };
  const mappings = topology.layers.flatMap((layer, depth) => layer.map((node, index) => (
    mapping(node.id, `topology.layers[${depth}][${index}]`)
  )));

  return renderPayload(intent, "hierarchy-goal-cascade-006", parameters, mappings);
}
