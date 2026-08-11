function splitPoints(value) {
  return String(value ?? "")
    .split(/\r?\n|；|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mapping(sourceItemId, parameterPath) {
  return { sourceItemId, parameterPath };
}

function roleAndStage(title, index) {
  const value = String(title ?? "").trim();
  const responsible = value.match(/^(.+?)负责(.+)$/);
  if (responsible) return { role: responsible[1].trim(), stage: responsible[2].trim() };
  const separated = value.match(/^(.+?)[：:\-—](.+)$/);
  if (separated) return { role: separated[1].trim(), stage: separated[2].trim() };
  return { role: `角色 ${index + 1}`, stage: value || `阶段 ${index + 1}` };
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
    const presenter = content.items.find((item) => item.id === "presenter");
    const date = content.items.find((item) => item.id === "date");
    const subtitle = content.items.find((item) => !["presenter", "date"].includes(item.id));
    return renderPayload(intent, assetId, {
      title: content.title,
      presenter: presenter ? presenter.body || presenter.title : "",
      date: date ? date.body || date.title : "",
      subtitle: subtitle ? subtitle.body || subtitle.title : "",
    }, [
      ...(presenter ? [mapping(presenter.id, "presenter")] : []),
      ...(date ? [mapping(date.id, "date")] : []),
      ...(subtitle ? [mapping(subtitle.id, "subtitle")] : []),
    ]);
  }

  if (assetId === "northeastern-university-closing-001") {
    const conclusion = content.items.find((item) => item.emphasis) ?? content.items.at(-1);
    const mission = content.items.find((item) => item !== conclusion);
    return renderPayload(intent, assetId, {
      text: [
        mission ? [mission.title, mission.body].filter(Boolean).join("，") : "",
        conclusion?.body || conclusion?.title,
      ].filter(Boolean).join("\n"),
    }, [
      ...(mission ? [mapping(mission.id, "text")] : []),
      ...(conclusion ? [mapping(conclusion.id, "text")] : []),
    ]);
  }

  if (assetId === "northeastern-university-body-001") {
    return renderPayload(intent, assetId, {
      title: content.title,
      compositionOnly: true,
    }, content.items.map((item) => mapping(item.id, "composition")));
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
      left: { title: left.title, items: splitPoints(left.body), emphasis: Boolean(left.emphasis) },
      right: { title: right.title, items: splitPoints(right.body), emphasis: Boolean(right.emphasis) },
      centerLabel: content.notes || "对比",
    }, [mapping(left.id, "left"), mapping(right.id, "right")]);
  }

  if (assetId === "sequential-process-001") {
    return renderPayload(intent, assetId, {
      title: content.title,
      steps: content.items.map((item) => ({
        title: item.title,
        body: item.body,
        emphasis: Boolean(item.emphasis),
        ...(item.emphasis
          ? { emphasisLabel: item.title.includes("？") ? "关键追问" : item.id.includes("outcome") ? "能力结果" : "结论 / 结果" }
          : {}),
      })),
    }, content.items.map((item, index) => mapping(item.id, `steps[${index}]`)));
  }

  if (assetId === "swimlane-process-001") {
    const conclusion = content.items.find((item) => item.emphasis);
    const roles = content.items.filter((item) => item !== conclusion);
    if (roles.length < 2 || roles.length > 3) throw new Error(`${content.pageId} 的泳道流程需要 2–3 个角色`);
    const parsed = roles.map((item, index) => roleAndStage(item.title, index));
    return renderPayload(intent, assetId, {
      title: content.title,
      lanes: parsed.map((item) => item.role),
      stages: parsed.map((item) => item.stage),
      tasks: roles.map((item, index) => ({ lane: index, stage: index, label: item.body || item.title })),
      conclusion: conclusion ? conclusion.body || conclusion.title : "",
    }, [
      ...roles.map((item, index) => mapping(item.id, `tasks[${index}]`)),
      ...(conclusion ? [mapping(conclusion.id, "conclusion")] : []),
    ]);
  }

  if (assetId === "problem-improvement-001") {
    if (content.items.length !== 4) throw new Error(`${content.pageId} 的问题—改进资产需要四个内容项`);
    const problems = content.items.slice(0, 2);
    const improvements = content.items.slice(2);
    return renderPayload(intent, assetId, {
      title: content.title,
      problemTitle: "现状与缺口",
      improvementTitle: "系统介入与结果",
      problems: problems.map((item) => ({ title: item.title, body: item.body })),
      improvements: improvements.map((item) => ({ title: item.title, body: item.body, emphasis: Boolean(item.emphasis) })),
    }, [
      ...problems.map((item, index) => mapping(item.id, `problems[${index}]`)),
      ...improvements.map((item, index) => mapping(item.id, `improvements[${index}]`)),
    ]);
  }

  if (assetId === "organization-tree-001") {
    const hierarchy = content.structuredData;
    if (hierarchy?.type !== "hierarchy" || !hierarchy.root) {
      throw new Error(`${content.pageId} 的三层组织树需要版式中立的 hierarchy structuredData`);
    }
    const departments = hierarchy.root.children ?? [];
    if (departments.length < 2 || departments.length > 4) {
      throw new Error(`${content.pageId} 的三层组织树需要 2–4 个二级节点`);
    }
    return renderPayload(intent, assetId, {
      title: content.title,
      leader: { name: hierarchy.root.label, role: hierarchy.root.role ?? "" },
      departments: departments.map((department) => ({
        name: department.label,
        head: department.role ?? "",
        members: (department.children ?? []).map((member) => ({
          name: member.label,
          role: member.role ?? "",
        })),
      })),
    }, [mapping(hierarchy.root.id, "leader"), ...departments.map((department, index) => (
      mapping(department.id, `departments[${index}]`)
    ))]);
  }

  if (assetId === "cycle-loop-001") {
    return renderPayload(intent, assetId, {
      title: content.title,
      center: content.notes || content.title,
      steps: content.items.map((item) => item.title || item.body),
    }, content.items.map((item, index) => mapping(item.id, `steps[${index}]`)));
  }

  if (assetId === "layered-architecture-001") {
    const sourceCount = intent.structure.dimensions?.sourceCount;
    const applicationCount = intent.structure.dimensions?.applicationCount;
    if (!Number.isInteger(sourceCount) || sourceCount < 1
      || !Number.isInteger(applicationCount) || applicationCount < 1
      || sourceCount + applicationCount + 1 !== content.items.length) {
      throw new Error(`${content.pageId} 的分层架构需要在 PageIntent 中声明 sourceCount 和 applicationCount`);
    }
    const sources = content.items.slice(0, sourceCount);
    const platform = content.items[sourceCount];
    const apps = content.items.slice(sourceCount + 1);
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
