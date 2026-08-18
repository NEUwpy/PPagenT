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
