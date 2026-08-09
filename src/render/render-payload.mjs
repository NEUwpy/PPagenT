function splitPoints(value) {
  return String(value ?? "")
    .split(/\r?\n|；|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mapping(sourceItemId, parameterPath) {
  return { sourceItemId, parameterPath };
}

function requireItem(content, id) {
  const item = content.items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`${content.pageId} 缺少内容项：${id}`);
  return item;
}

function renderPayload(intent, assetId, parameters, mappings, omissions = []) {
  return {
    schemaVersion: "1.0",
    intentId: intent.intentId,
    assetId,
    parameters,
    mappings,
    omissions,
  };
}

export function mapRenderPayload(content, intent, decision) {
  const assetId = decision.selectedAssetId;
  if (!assetId) throw new Error(`${content.pageId} 没有可渲染的 selectedAssetId`);

  if (assetId === "northeastern-university-cover-001") {
    const presenter = requireItem(content, "presenter");
    const date = requireItem(content, "date");
    return renderPayload(intent, assetId, {
      title: content.title,
      presenter: presenter.body || presenter.title,
      date: date.body || date.title,
    }, [
      mapping(presenter.id, "presenter"),
      mapping(date.id, "date"),
    ]);
  }

  if (assetId === "northeastern-university-closing-001") {
    return renderPayload(intent, assetId, {
      text: content.notes || content.title,
    }, []);
  }

  if (assetId === "radial-hub-001") {
    return renderPayload(intent, assetId, {
      title: content.title,
      center: content.notes || content.title,
      items: content.items.map((item) => item.title || item.body),
    }, content.items.map((item, index) => mapping(item.id, `items[${index}]`)));
  }

  if (assetId === "comparison-structure-001") {
    const [left, right] = content.items;
    if (!left || !right) throw new Error(`${content.pageId} 的双向对比需要两个内容组`);
    return renderPayload(intent, assetId, {
      title: content.title,
      left: { title: left.title, items: splitPoints(left.body) },
      right: { title: right.title, items: splitPoints(right.body) },
      centerLabel: content.notes || "对比",
    }, [
      mapping(left.id, "left"),
      mapping(right.id, "right"),
    ]);
  }

  if (assetId === "sequential-process-001") {
    return renderPayload(intent, assetId, {
      title: content.title,
      steps: content.items.map((item) => ({ title: item.title, body: item.body })),
    }, content.items.map((item, index) => mapping(item.id, `steps[${index}]`)));
  }

  if (assetId === "cycle-loop-001") {
    return renderPayload(intent, assetId, {
      title: content.title,
      center: content.notes || content.title,
      steps: content.items.map((item) => item.title || item.body),
    }, content.items.map((item, index) => mapping(item.id, `steps[${index}]`)));
  }

  if (assetId === "layered-architecture-001") {
    const sources = content.items.filter((item) => item.id.startsWith("source-"));
    const apps = content.items.filter((item) => item.id.startsWith("app-"));
    const platform = requireItem(content, "platform");
    return renderPayload(intent, assetId, {
      title: content.title,
      sources: sources.map((item) => item.title || item.body),
      platform: platform.title || platform.body,
      apps: apps.map((item) => item.title || item.body),
    }, [
      ...sources.map((item, index) => mapping(item.id, `sources[${index}]`)),
      mapping(platform.id, "platform"),
      ...apps.map((item, index) => mapping(item.id, `apps[${index}]`)),
    ]);
  }

  throw new Error(`尚无 RenderPayload 映射器：${assetId}`);
}
