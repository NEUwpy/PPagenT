function markdownSections(rawMarkdown) {
  const matches = [...String(rawMarkdown ?? "").matchAll(/^##\s+(.+)$/gm)];
  return matches.map((match, index) => ({
    heading: match[1].trim(),
    body: String(rawMarkdown).slice(match.index + match[0].length, matches[index + 1]?.index).trim(),
  }));
}

function paragraphContaining(section, pattern) {
  return section.body.split(/\n\s*\n/).find((paragraph) => pattern.test(paragraph))?.trim() ?? "";
}

function repeatedBoldRoles(section) {
  const lines = section.body.split(/\r?\n/).filter((line) => (
    /^>\s*\*\*.+?。?\*\*/.test(line.trim()) && line.includes("负责")
  ));
  return lines.length >= 3 ? lines.join("\n") : "";
}

function repeatedRoleCount(source) {
  return source.split(/\r?\n/).filter((line) => (
    /^>\s*\*\*.+?。?\*\*/.test(line.trim()) && line.includes("负责")
  )).length;
}

function colonEnumeration(section) {
  for (const paragraph of section.body.split(/\n\s*\n/)) {
    const tail = paragraph.split(/[：:]/).slice(1).join("：");
    if (!tail) continue;
    const clauses = tail.split(/[，,]/).map((item) => item.trim()).filter(Boolean);
    const decisionClauses = clauses.filter((item) => /怎么|多少|什么|哪里|何时|什么时候|是否|哪些|如何|谁/.test(item));
    if (clauses.length >= 4 && decisionClauses.length >= 3) return paragraph.trim();
  }
  return "";
}

function semicolonEnumeration(section) {
  for (const paragraph of section.body.split(/\n\s*\n/)) {
    const clauses = paragraph.split(/[；;]/).map((item) => item.trim()).filter(Boolean);
    if (clauses.length >= 3) return paragraph.trim();
  }
  return "";
}

function singleBoldThesis(section) {
  const lines = section.body.split(/\r?\n/).filter((line) => /^>\s*\*\*.+?\*\*/.test(line.trim()));
  return lines.length === 1 ? lines[0].trim() : "";
}

function transformationAnchors(source) {
  const endpoints = String(source).match(/从(?:一件|一个|一种)?([^，。；]{1,8}?)变成(?:一件|一个|一种)?([^，。；]{1,8})/);
  if (!endpoints) return [];
  const middle = String(source).match(/(?:这些|其中)([^，。；]{1,8}?)(?:被)?提炼/)
    ?? String(source).match(/([^，。；]{1,8}?)被提炼/)
    ?? String(source).match(/提炼(?:这些|其中)?([^，。；]{1,8})/);
  const titles = [endpoints[1], middle?.[1], endpoints[2]]
    .map((value) => String(value ?? "").replace(/[，。；]/g, "").trim());
  return titles.every(Boolean) ? titles : [];
}

function transformationPointCount(source) {
  const context = String(source).split(/\n\s*\n/)[0] ?? "";
  const tail = context.split(/[：:]/).slice(1).join("：");
  if (!tail) return 0;
  return Math.min(4, tail.split(/[，,]/).map((item) => item.trim()).filter(Boolean).length);
}

export function detectStructuralCues(rawMarkdown) {
  const cues = [];
  markdownSections(rawMarkdown).forEach((section, sectionIndex) => {
    const idPrefix = `section-${sectionIndex + 1}`;
    const sectionParagraphs = section.body.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
    const roles = repeatedBoldRoles(section);
    if (roles) {
      cues.push({
        cueId: `${idPrefix}-roles`,
        sectionHeading: section.heading,
        type: "role-sequence",
        relation: "sequence",
        source: roles,
      });
      return;
    }

    if (/比.+更|与.+(?:对比|比较)|和.+(?:对比|比较)/.test(`${section.heading}\n${section.body}`)) {
      cues.push({
        cueId: `${idPrefix}-comparison`,
        sectionHeading: section.heading,
        type: "direct-comparison",
        relation: "comparison",
        source: `## ${section.heading}\n\n${section.body}`,
      });
      return;
    }

    const transformation = paragraphContaining(section, /从.+?变成.+/);
    const transformationTitles = transformationAnchors(transformation);
    if (transformation && Array.from(transformation).length <= 180 && transformationTitles.length === 3) {
      const paragraphs = section.body.split(/\n\s*\n/);
      const index = paragraphs.indexOf(transformation);
      const context = [paragraphs[index - 1], transformation].filter(Boolean).join("\n\n");
      cues.push({
        cueId: `${idPrefix}-transformation`,
        sectionHeading: section.heading,
        type: "sequence-transformation",
        relation: "sequence",
        source: context,
        anchorTitles: transformationTitles,
        supportingPointCount: transformationPointCount(context),
      });
      return;
    }

    const colon = sectionParagraphs.length <= 2 ? colonEnumeration(section) : "";
    if (colon) {
      cues.push({
        cueId: `${idPrefix}-enumeration`,
        sectionHeading: section.heading,
        type: "parallel-enumeration",
        relation: "parallel",
        source: colon,
      });
      return;
    }

    const semicolon = sectionParagraphs.length <= 2 ? semicolonEnumeration(section) : "";
    if (semicolon) {
      cues.push({
        cueId: `${idPrefix}-enumeration`,
        sectionHeading: section.heading,
        type: "parallel-enumeration",
        relation: "parallel",
        source: semicolon,
      });
      return;
    }

    if (/少数人[\s\S]{0,180}(?:但|而)更多的人/.test(section.body)) {
      cues.push({
        cueId: `${idPrefix}-categories`,
        sectionHeading: section.heading,
        type: "category-contrast",
        relation: "parallel",
        source: section.body,
      });
      return;
    }

    const thesis = singleBoldThesis(section);
    if (thesis) {
      cues.push({
        cueId: `${idPrefix}-thesis`,
        sectionHeading: section.heading,
        type: "single-thesis",
        relation: "none",
        source: `${thesis}\n\n${section.body}`,
      });
    }
  });
  return cues;
}

function cueTask(cue) {
  if (cue.type === "role-sequence") {
    return "逐行提取重复声明的角色或职责，保持原有先后次序。每一行恰好对应一个 atom；换一种说法、总结和背景不得成为 atom。";
  }
  if (cue.type === "sequence-transformation") {
    return "提取转化主骨架：初始产物、中间规律或机制、最终能力或结果，必须恰好三个 atoms。atoms 只能是主节点；前文冒号后的表达、容量、变化、禁忌等枚举不是阶段，必须作为中间 atom 的 points，绝不能提升为同级 atom。";
  }
  if (cue.type === "direct-comparison") {
    return "从标题或核心结论中提取被直接比较的 A、B 双方，必须恰好两个 atoms。使用场景、结论和价值不能取代双方；双方 body 分别保留来源支持的区别，并按原稿明确倾向填写 polarity 与 emphasis。这里只确定对比双方，不输出 points；组内分几条由后续视觉导演依据 Logic 契约决定。";
  }
  if (cue.type === "category-contrast") return "提取来源中两个不同处境或角色类别，必须恰好两个 atoms。它们是并列类别，不是优劣方案；背景和产品结论不得成为第三项。";
  if (cue.type === "single-thesis") return "提取加粗引文表达的唯一核心判断，必须恰好一个 atom；其余段落只用于压缩说明该判断，不得拆成同级项。";
  return "提取枚举中全部子句所表达的同级决策维度或承诺维度。每个子句必须且只能进入一个 sourceFragments；语义上属于同一个维度的相邻子句应合并，不能遗漏，也不能输出总括词。";
}

function itemRangeForCue(cue) {
  if (cue.type === "role-sequence") {
    const count = repeatedRoleCount(cue.source);
    return { minItems: count, maxItems: count };
  }
  if (cue.type === "direct-comparison") return { minItems: 2, maxItems: 2 };
  if (cue.type === "category-contrast") return { minItems: 2, maxItems: 2 };
  if (cue.type === "single-thesis") return { minItems: 1, maxItems: 1 };
  if (cue.type === "sequence-transformation") return { minItems: 3, maxItems: 3 };
  const hasColon = cue.source.includes("：");
  const tail = hasColon ? cue.source.split("：").slice(1).join("：") : cue.source;
  const clauseCount = tail.split(hasColon ? /[，,]/ : /[；;]/).map((item) => item.trim()).filter(Boolean).length;
  return {
    minItems: Math.min(clauseCount, Math.max(3, Math.ceil(clauseCount * 0.7))),
    maxItems: Math.min(7, clauseCount),
  };
}

function outputSchema(cue) {
  const maxBodyChars = cue.relation === "sequence" ? 18 : 32;
  const visualBindingOwnsPoints = cue.type === "direct-comparison";
  const atom = {
    type: "object",
    additionalProperties: false,
    required: ["title", "body", "sourceFragments"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 10 },
      body: { type: "string", minLength: 1, maxLength: maxBodyChars },
      sourceFragments: {
        type: "array",
        minItems: 1,
        items: { type: "string", minLength: 1 },
      },
      ...(!visualBindingOwnsPoints ? { points: {
        type: "array",
        maxItems: 4,
        items: { type: "string", minLength: 1, maxLength: 8 },
        uniqueItems: true,
      } } : {}),
      polarity: { enum: ["positive", "negative", "neutral"] },
      emphasis: { type: "boolean" },
    },
  };
  const itemRange = itemRangeForCue(cue);
  return {
    name: `ppagent_structural_cue_${cue.cueId.replaceAll("-", "_")}`,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["atoms"],
      properties: { atoms: { type: "array", ...itemRange, items: atom } },
    },
  };
}

function compactStructuralBody(value) {
  return String(value ?? "").replace(/PowerPoint/gi, "PPT");
}

function pageForHint(pageContents, hint) {
  const headingLine = `## ${hint.sectionHeading}`;
  return pageContents.find((page) => String(page.sourceText ?? "").includes(headingLine))
    ?? pageContents.find((page) => String(page.title ?? "").includes(hint.sectionHeading));
}

export function applyStructuralHints(contentOutput, hints) {
  if (!hints?.length) return contentOutput;
  const output = structuredClone(contentOutput);
  for (const hint of hints) {
    const page = pageForHint(output.pageContents, hint);
    if (!page) continue;
    if (["problem-solution", "matrix"].includes(page.structuredData?.type)) continue;
    page.items = hint.atoms.map((atom, index) => ({
      id: `${page.pageId}-structure-${index + 1}`,
      title: atom.title,
      body: compactStructuralBody(atom.body),
      ...(atom.points?.length ? { points: atom.points } : {}),
      ...(atom.polarity ? { polarity: atom.polarity } : {}),
      ...(atom.emphasis ? { emphasis: true } : {}),
    }));
    const relationNote = `PPagenT主关系=${hint.relation}`;
    const granularityNote = hint.type === "sequence-transformation"
      ? "PPagenT节点接口=semantic-node+points"
      : "";
    page.notes = [page.notes, relationNote, granularityNote].filter(Boolean).join("；");
    if (page.structuredData && hint.relation !== "hierarchy") delete page.structuredData;
  }
  return output;
}

export async function readStructuralCues(rawMarkdown, model, { maxCues = 8 } = {}) {
  if (!model || typeof model.generateJson !== "function") return [];
  const cues = detectStructuralCues(rawMarkdown).slice(0, maxCues);
  const hints = await Promise.all(cues.map(async (cue) => {
    const range = itemRangeForCue(cue);
    const maxBodyChars = cue.relation === "sequence" ? 18 : 32;
    const request = (extra = "") => model.generateJson({
      role: "PPagenT 视觉结构线索解析器",
      task: `${cueTask(cue)} 标题 2–8 个汉字，正文 12–${maxBodyChars} 个汉字。只处理给定 source。${extra}`,
      context: {
        cueId: cue.cueId,
        sectionHeading: cue.sectionHeading,
        source: cue.source,
        ...(cue.anchorTitles?.length ? { requiredNodeTitles: cue.anchorTitles } : {}),
        ...(cue.supportingPointCount ? { requiredMiddlePointCount: cue.supportingPointCount } : {}),
      },
      outputSchema: outputSchema(cue),
    });
    let output = await request();
    const outputInvalid = (value) => (
      value.atoms.length < range.minItems
      || value.atoms.length > range.maxItems
      || value.atoms.some((atom) => Array.from(compactStructuralBody(atom.body)).length > maxBodyChars)
      || value.atoms.some((atom) => (atom.points?.length ?? 0) > 4)
      || value.atoms.some((atom) => (atom.points ?? []).some((point) => Array.from(point).length > 8))
      || (cue.type === "sequence-transformation"
        && ((value.atoms[0]?.points?.length ?? 0) > 0 || (value.atoms[2]?.points?.length ?? 0) > 0))
      || (cue.type === "sequence-transformation" && cue.supportingPointCount > 0
        && (value.atoms[1]?.points?.length ?? 0) !== cue.supportingPointCount)
    );
    if (outputInvalid(output)) {
      output = await request(` 本次 atoms 数量必须在 ${range.minItems} 到 ${range.maxItems} 之间，且每项正文不得超过 ${maxBodyChars} 个汉字。转化结构只有中间 atom 可以含 points，起点和终点的 points 必须为空；中间 atom 必须包含 ${cue.supportingPointCount || 0} 个来源支持的 points；上一结果不合格。`);
    }
    if (outputInvalid(output)) {
      return null;
    }
    const atoms = cue.anchorTitles?.length === output.atoms.length
      ? output.atoms.map((atom, index) => ({ ...atom, title: cue.anchorTitles[index] }))
      : output.atoms;
    return { ...cue, atoms };
  }));
  return hints.filter(Boolean);
}
