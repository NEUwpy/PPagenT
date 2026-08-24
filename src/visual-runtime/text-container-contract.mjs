const POINT_RENDERING = new Set(["merged-body", "separate-slots"]);
const BODY_CONTAINER_MODE = new Set(["single-flow", "fixed-regions"]);

export function resolveTextContainerContract(textCapacity = {}, contentContract = {}) {
  const pointRendering = textCapacity.pointRendering ?? "merged-body";
  const bodyContainerMode = textCapacity.bodyContainerMode ?? "single-flow";
  if (!POINT_RENDERING.has(pointRendering)) throw new Error(`pointRendering 非法：${pointRendering}`);
  if (!BODY_CONTAINER_MODE.has(bodyContainerMode)) throw new Error(`bodyContainerMode 非法：${bodyContainerMode}`);
  if (pointRendering === "separate-slots" && bodyContainerMode !== "fixed-regions") {
    throw new Error("独立分点槽必须显式使用 bodyContainerMode=fixed-regions");
  }
  return {
    pointRendering,
    bodyContainerMode,
    itemTitleRequired: textCapacity.itemTitleRequired === true,
    itemBodyRequired: textCapacity.itemBodyRequired === true,
    itemBodySourceField: textCapacity.itemBodySourceField
      ?? (contentContract.points === "forbidden" ? "body" : "support"),
    itemBodyTextMode: textCapacity.itemBodyTextMode ?? "flow",
    itemBodyListPolicy: textCapacity.itemBodyListPolicy ?? "inline",
  };
}

export function assertResolvedTextContainerSlots(slots, textCapacity = {}, componentId = "HTML Component") {
  const contract = resolveTextContainerContract(textCapacity);
  const flowSlots = slots.filter((slot) => slot.role === "item-content" || slot.contentType === "text-flow");
  const flowByRegion = new Map();
  for (const slot of flowSlots) {
    const itemId = slot.itemId || slot.id;
    const regionId = slot.regionId || "main";
    const key = `${itemId}::${regionId}`;
    flowByRegion.set(key, (flowByRegion.get(key) ?? 0) + 1);
  }
  const duplicatedFlow = [...flowByRegion.entries()].find(([, count]) => count > 1);
  if (duplicatedFlow) {
    throw new Error(`${componentId} 的 ${duplicatedFlow[0]} 重复声明 TextFlow；每个连续文字区域只能有一个内容容器`);
  }
  for (const flowSlot of flowSlots) {
    const itemId = flowSlot.itemId || flowSlot.id;
    const regionId = flowSlot.regionId || "main";
    const split = slots.some((slot) => (
      (slot.itemId || slot.id) === itemId
      && (slot.regionId || "main") === regionId
      && new Set(["item-title", "item-body", "item-point"]).has(slot.role)
    ));
    if (split) {
      throw new Error(`${componentId} 的 ${itemId}::${regionId} 已使用 TextFlow，不能在同一连续区域再声明独立标题、正文或分点容器`);
    }
  }
  const pointSlots = slots.filter((slot) => slot.role === "item-point");
  if (contract.pointRendering === "merged-body" && pointSlots.length) {
    throw new Error(`${componentId} 默认采用整块正文容器，不能声明独立 item-point 槽`);
  }

  if (contract.bodyContainerMode === "single-flow") {
    const countByItem = new Map();
    for (const slot of slots.filter((item) => item.role === "item-body")) {
      const key = slot.itemId || slot.id;
      countByItem.set(key, (countByItem.get(key) ?? 0) + 1);
    }
    const duplicated = [...countByItem.entries()].find(([, count]) => count > 1);
    if (duplicated) {
      throw new Error(`${componentId} 的 ${duplicated[0]} 被切成多个正文槽；默认制度要求每项一个完整正文容器`);
    }
  }
  return contract;
}
