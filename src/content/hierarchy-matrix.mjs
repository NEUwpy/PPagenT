function copyNode(node) {
  const result = { id: String(node?.id ?? ""), label: String(node?.label ?? "") };
  for (const key of ["role", "groupLabel", "portrait"]) {
    if (node?.[key] != null && String(node[key]).trim()) result[key] = String(node[key]);
  }
  return result;
}

export function multiplyBooleanMatrices(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || !right.length) {
    throw new Error("布尔矩阵乘法需要两个非空矩阵");
  }
  const inner = left[0]?.length ?? 0;
  if (!inner || right.length !== inner || left.some((row) => row.length !== inner)) {
    throw new Error("布尔矩阵乘法维度不匹配");
  }
  const columns = right[0]?.length ?? 0;
  if (!columns || right.some((row) => row.length !== columns)) throw new Error("布尔矩阵列数不一致");
  return left.map((row) => Array.from({ length: columns }, (_, column) => (
    row.some((value, index) => value === 1 && right[index][column] === 1) ? 1 : 0
  )));
}

export function nestedHierarchyToMatrix(root) {
  if (!root) throw new Error("hierarchy.root 不能为空");
  const layers = [];
  const originals = [];
  const queue = [{ node: root, depth: 0 }];
  while (queue.length) {
    const { node, depth } = queue.shift();
    layers[depth] ??= [];
    originals[depth] ??= [];
    layers[depth].push(copyNode(node));
    originals[depth].push(node);
    for (const child of node.children ?? []) queue.push({ node: child, depth: depth + 1 });
  }
  const adjacency = layers.slice(0, -1).map((_, depth) => {
    const children = originals[depth + 1];
    return originals[depth].map((parent) => children.map((child) => (parent.children ?? []).includes(child) ? 1 : 0));
  });
  return { layers, adjacency };
}

export function hierarchyMatrixFromStructuredData(structuredData) {
  if (structuredData?.type !== "hierarchy") return null;
  if (Array.isArray(structuredData.layers)) {
    return {
      layers: structuredData.layers.map((layer) => layer.map(copyNode)),
      adjacency: structuredData.adjacency.map((matrix) => matrix.map((row) => [...row])),
    };
  }
  return nestedHierarchyToMatrix(structuredData.root);
}

export function composeHierarchyPathMatrices(adjacency) {
  if (!Array.isArray(adjacency) || !adjacency.length) return [];
  const result = [adjacency[0].map((row) => [...row])];
  for (let index = 1; index < adjacency.length; index += 1) {
    result.push(multiplyBooleanMatrices(result[index - 1], adjacency[index]));
  }
  return result;
}

export function hierarchyMatrixIssues(topology) {
  const issues = [];
  const layers = topology?.layers;
  const adjacency = topology?.adjacency;
  if (!Array.isArray(layers) || layers.length < 2 || layers.length > 5) {
    return [{ field: "structuredData.layers", code: "INVALID_HIERARCHY_LAYER_COUNT" }];
  }
  if (layers[0]?.length !== 1) issues.push({ field: "structuredData.layers[0]", code: "INVALID_HIERARCHY_ROOT_COUNT" });
  const ids = layers.flatMap((layer) => layer.map((node) => node.id));
  const seen = new Set();
  const duplicates = [...new Set(ids.filter((id) => seen.has(id) || !seen.add(id)))];
  if (duplicates.length) issues.push({ field: "structuredData.layers", code: "DUPLICATE_HIERARCHY_NODE_ID", ids: duplicates });
  if (!Array.isArray(adjacency) || adjacency.length !== layers.length - 1) {
    issues.push({ field: "structuredData.adjacency", code: "INVALID_HIERARCHY_MATRIX_COUNT" });
    return issues;
  }
  adjacency.forEach((matrix, depth) => {
    const parentCount = layers[depth].length;
    const childCount = layers[depth + 1].length;
    if (!Array.isArray(matrix) || matrix.length !== parentCount || matrix.some((row) => (
      !Array.isArray(row) || row.length !== childCount || row.some((value) => value !== 0 && value !== 1)
    ))) {
      issues.push({ field: `structuredData.adjacency[${depth}]`, code: "INVALID_HIERARCHY_MATRIX_SHAPE" });
      return;
    }
    for (let childIndex = 0; childIndex < childCount; childIndex += 1) {
      const parentCountForChild = matrix.reduce((sum, row) => sum + row[childIndex], 0);
      if (parentCountForChild !== 1) {
        issues.push({ field: `structuredData.adjacency[${depth}][*][${childIndex}]`, code: "INVALID_HIERARCHY_PARENT_COUNT", ids: [layers[depth + 1][childIndex].id] });
      }
    }
  });
  if (!issues.length) {
    const paths = composeHierarchyPathMatrices(adjacency);
    paths.forEach((matrix, depth) => {
      if (matrix[0].some((value) => value !== 1)) issues.push({ field: `structuredData.adjacency[0..${depth}]`, code: "UNREACHABLE_HIERARCHY_NODE" });
    });
  }
  return issues;
}

