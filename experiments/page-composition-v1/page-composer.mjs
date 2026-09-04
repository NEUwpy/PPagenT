function requirePositiveFrame(frame, label) {
  if (!frame || ["left", "top", "width", "height"].some((key) => !Number.isFinite(frame[key]))) {
    throw new Error(`${label} must be a finite frame`);
  }
  if (frame.width <= 0 || frame.height <= 0) throw new Error(`${label} must have positive size`);
}

function normalizedFrame(frame, within) {
  return {
    left: (frame.left - within.left) / within.width,
    top: (frame.top - within.top) / within.height,
    width: frame.width / within.width,
    height: frame.height / within.height,
  };
}

export function composeStructureWithAside({
  pageBrief,
  bodyFrame,
  structureFootprint,
  gap = 24,
  asideMinimumWidth = 200,
  verticalPadding = 36,
}) {
  requirePositiveFrame(bodyFrame, "bodyFrame");
  requirePositiveFrame({ left: 0, top: 0, ...structureFootprint }, "structureFootprint");
  if (!pageBrief?.pageId || !pageBrief?.structure?.sourceItemIds?.length || !pageBrief?.aside?.sourceItemIds?.length) {
    throw new Error("pageBrief must bind both structure and aside content");
  }

  const availableAsideWidth = bodyFrame.width - structureFootprint.width - gap;
  if (availableAsideWidth < asideMinimumWidth) {
    return {
      accepted: false,
      reason: "structure-footprint-leaves-no-usable-aside",
      requiredWidth: structureFootprint.width + gap + asideMinimumWidth,
      availableWidth: bodyFrame.width,
    };
  }
  if (structureFootprint.height > bodyFrame.height) {
    return {
      accepted: false,
      reason: "structure-footprint-exceeds-body-height",
      requiredHeight: structureFootprint.height,
      availableHeight: bodyFrame.height,
    };
  }

  const componentFrame = {
    left: bodyFrame.left,
    top: bodyFrame.top + (bodyFrame.height - structureFootprint.height) / 2,
    width: structureFootprint.width,
    height: structureFootprint.height,
  };
  const asideFrame = {
    left: componentFrame.left + componentFrame.width + gap,
    top: bodyFrame.top + verticalPadding,
    width: availableAsideWidth,
    height: bodyFrame.height - verticalPadding * 2,
  };

  return {
    accepted: true,
    schemaVersion: "0.1",
    pageId: pageBrief.pageId,
    pageJob: pageBrief.pageJob,
    rhythm: pageBrief.rhythm ?? "dense",
    focalRegion: "structure",
    readingOrder: ["structure", "aside"],
    regions: [
      {
        regionId: "structure",
        role: "structure",
        frame: componentFrame,
        sourceContentIds: pageBrief.structure.sourceItemIds,
        carrierType: "structure-skill",
        skillId: pageBrief.structure.skillId,
        visualWeight: "primary",
      },
      {
        regionId: "aside",
        role: "text",
        frame: asideFrame,
        sourceContentIds: pageBrief.aside.sourceItemIds,
        carrierType: "editorial-aside",
        skillId: "text/editorial-aside",
        visualWeight: "support",
      },
    ],
    layout: {
      id: "dynamic-structure-aside-right",
      silhouette: "natural-structure-left-editorial-right",
      requiresComponent: true,
      componentResizeMode: "natural-crop",
      allowedAssetKinds: ["component"],
      slots: [
        { id: "component", role: "component", frame: normalizedFrame(componentFrame, bodyFrame) },
        { id: "aside", role: "text", frame: normalizedFrame(asideFrame, bodyFrame) },
      ],
    },
    textSlots: [
      { slotId: "aside", sourceItemIds: pageBrief.aside.sourceItemIds, contentMode: "full" },
    ],
  };
}
