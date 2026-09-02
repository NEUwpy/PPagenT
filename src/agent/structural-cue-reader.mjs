import { extractManuscriptSections } from "../content/manuscript-sections.mjs";

function paragraphContaining(section, pattern) {
  return section.body.split(/\n\s*\n/).find((paragraph) => pattern.test(paragraph))?.trim() ?? "";
}

function repeatedBoldRoles(section) {
  const lines = section.body.split(/\r?\n/).filter((line) => (
    /^>\s*\*\*.+?。?\*\*/.test(line.trim()) && line.includes("负责")
  ));
  return lines.length >= 3 ? lines.join("\n") : "";
}

function responsibilitySequence(section) {
  return section.body.split(/\n\s*\n/).find((paragraph) => (
    (paragraph.match(/负责/g) ?? []).length >= 3
  ))?.trim() ?? "";
}

function responsibilityAtoms(source) {
  const clean = String(source).replace(/[>*_]/g, "").trim();
  return [...clean.matchAll(/(?:^|[，。；])\s*([A-Za-z\u4e00-\u9fff]{1,8})\s*负责([^，。；]+)/g)]
    .map((match) => ({
      title: match[1].trim(),
      body: match[2].trim(),
      sourceFragments: [match[0].replace(/^[，。；]\s*/, "").trim()],
    }));
}

function mermaidArchitecture(section) {
  if (!section.body.includes("```mermaid")) return null;
  const groups = [...section.body.matchAll(/subgraph\s+\S+\["([^"]+)"\]/g)].map((match) => match[1]);
  if (groups.length < 2 || !section.body.includes("核心资产库")) return null;
  return {
    source: section.body,
    atoms: [
      {
        title: groups[0].replace(/线$/, ""), body: "建设并确认表达能力", sourceFragments: [groups[0]],
        points: ["优秀参考", "提炼逻辑规律", "扩展复用能力", "用户确认"],
      },
      {
        title: "核心资产", body: "保存已经确认的能力", sourceFragments: ["核心资产库"],
        points: ["用户确认", "只读调用"],
      },
      {
        title: groups[1].replace(/线$/, ""), body: "按稿件稳定调用能力", sourceFragments: [groups[1]],
        points: ["AI理解编排", "选择合法能力", "确定性编译", "原生可编辑PPT"],
      },
    ],
  };
}

function repeatedRoleCount(source) {
  return source.split(/\r?\n/).filter((line) => (
    /^>\s*\*\*.+?。?\*\*/.test(line.trim()) && line.includes("负责")
  )).length;
}

function colonEnumeration(section, { requireDecisionWords = false } = {}) {
  for (const paragraph of section.body.split(/\n\s*\n/)) {
    const sentence = paragraph.split(/[。！？]/)[0];
    const tail = sentence.split(/[：:]/).slice(1).join("：");
    if (!tail) continue;
    let clauses = tail.split(/[，,]/).map((item) => item.trim()).filter(Boolean);
    if (clauses.length < 3) {
      clauses = tail.split(/[，,、]/).map((item) => item.trim()).filter(Boolean);
    }
    const decisionClauses = clauses.filter((item) => /怎么|多少|什么|哪里|何时|什么时候|是否|哪些|如何|谁/.test(item));
    if (clauses.length < 3 || clauses.length > 10) continue;
    if (requireDecisionWords && decisionClauses.length < 3) continue;
    if (!requireDecisionWords && clauses.some((item) => Array.from(item).length > 24)) continue;
    return sentence.trim();
  }
  return "";
}

function semicolonEnumeration(section) {
  const paragraphs = section.body.split(/\n\s*\n/).filter(Boolean);
  if (paragraphs.length > 2) return "";
  for (const paragraph of paragraphs) {
    const clauses = paragraph.split(/[；;]/).map((item) => item.trim()).filter(Boolean);
    if (clauses.length >= 3) return paragraph.trim();
  }
  return "";
}

function singleBoldThesis(section) {
  const lines = section.body.split(/\r?\n/).filter((line) => /^>\s*\*\*.+?\*\*/.test(line.trim()));
  return lines.length === 1 ? lines[0].trim() : "";
}

function spectrumWithMiddle(section) {
  return section.body.split(/\n\s*\n/).find((paragraph) => (
    /一端是/.test(paragraph)
    && /另一端是/.test(paragraph)
    && /(?:更多|主要).{0,12}(?:位于|集中在)中间/.test(paragraph)
  ))?.trim() ?? "";
}

function expansionSequence(section) {
  if (!/从.+?(?:走向|扩展到|推广到).+/.test(section.heading)) return "";
  return section.body.split(/\n\s*\n/).find((paragraph) => (
    /先|第一个|起点|开始/.test(paragraph)
    && /以后|其他|更多|继续复用/.test(paragraph)
  ))?.trim() ?? section.body.trim();
}

function explicitOrdinalSequence(section) {
  const source = `${section.heading}\n${section.body}`;
  const markers = [...source.matchAll(/第[一二三四五六七八九十\d]+(?:次|步|阶段|轮|层)/g)]
    .map((match) => match[0]);
  const uniqueMarkers = [...new Set(markers)];
  if (uniqueMarkers.length >= 3 && uniqueMarkers.length <= 7) {
    return { source: section.sourceText, count: uniqueMarkers.length };
  }
  const discourseMarkers = [...source.matchAll(/(?:首先|其次|接着|然后|随后|最后)/g)];
  const hasCompleteOrder = /首先/.test(source)
    && /(?:其次|接着|然后|随后)/.test(source)
    && /最后/.test(source);
  return hasCompleteOrder && discourseMarkers.length >= 3 && discourseMarkers.length <= 7
    ? { source: section.sourceText, count: discourseMarkers.length }
    : null;
}

function stateProgression(section) {
  return section.body.split(/\n\s*\n/).find((paragraph) => (
    /(?:最初|起初|一开始|曾经)/.test(paragraph)
    && /(?:逐渐|继而|进而|开始)/.test(paragraph)
    && /(?:最终|终于|最后)/.test(paragraph)
    && /(?:变化|转变|成长|提升|深化|成熟|扩大|觉醒|走向|从.+到)/.test(paragraph)
  ))?.trim() ?? "";
}

function pairedContrast(section) {
  const patterns = [
    /一方面[\s\S]{2,120}(?:另一方面|而另一方面)/,
    /一边[\s\S]{2,120}另一边/,
    /(?:之前|台前|幕前)[\s\S]{2,120}(?:之后|台后|幕后)/,
    /在[^，。；]{1,24}(?:中|时|年代|时期|情境|场景)[^。；]{2,80}[，；]而在[^，。；]{1,24}(?:中|时|年代|时期|情境|场景)/,
    /[^，。；]{1,18}(?:用|使用|利用|借助)[^。；]{2,80}[，；]而[^，。；]{1,24}[，,]?(?:却|则)?(?:用|使用|利用|借助)/,
    /[^，。；]{1,24}比[^，。；]{1,24}更[^。；]{1,48}/,
    /[^，。；]{1,24}与[^，。；]{1,24}(?:对比|比较)/,
    /从[^。；]{1,80}(?:切换到|转为|变为)[^。；]{1,80}/,
  ];
  return section.body.split(/\n\s*\n/)
    .find((paragraph) => patterns.some((pattern) => pattern.test(paragraph)))?.trim() ?? "";
}

function ordinalParallelActions(section) {
  const source = section.body;
  const matches = [...source.matchAll(/(?:首先|其次|最后)[，,]?\s*(?:我们)?(?:要|应当|应该|需要|必须)([^；。]+)/g)];
  if (matches.length < 3 || matches.length > 6) return null;
  const clauses = matches.map((match) => match[1].trim()).filter(Boolean);
  if (clauses.length !== matches.length) return null;
  if (clauses.some((clause) => /(?:完成后|之后再|随后进入|形成后|依次|前一步|下一步)/.test(clause))) return null;
  return { source: matches.map((match) => match[0]).join("；"), count: matches.length };
}

function questionCluster(section) {
  for (const paragraph of section.body.split(/\n\s*\n/)) {
    const questions = (paragraph.match(/[^。！？?]{2,80}[？?]/g) ?? [])
      .filter((question) => !/^(?:为什么|为何|怎么说|如何理解|怎么理解)[？?]$/.test(question.trim()));
    if (questions.length >= 3 && questions.length <= 6) {
      return { source: paragraph.trim(), count: questions.length };
    }
  }
  return null;
}

function temporalSequence(section) {
  const source = section.body;
  if (/过去/.test(source) && /现在|当下/.test(source) && /未来/.test(source)) {
    return { source: section.sourceText, count: 3, type: "past-present-future" };
  }
  const markers = [...source.matchAll(/(?:\d{4}\s*年|当年|起初|随后|后来|最终)/g)];
  if (markers.length >= 3 && markers.length <= 6) {
    return { source: section.sourceText, count: markers.length, type: "chronological" };
  }
  return null;
}

function parallelActionList(section) {
  for (const sentence of section.body.split(/[。！？]/).map((item) => item.trim()).filter(Boolean)) {
    if (!/(?:让我们|希望|我们要|我们需要|必须|应当|需要|为了)/.test(sentence)) continue;
    const groups = sentence.split(/[，,]/).map((item) => item.trim()).filter(Boolean);
    const candidates = groups
      .map((group) => ({ source: group, count: (group.match(/、/g) ?? []).length + 1 }))
      .filter((group) => (
        group.count >= 3
        && group.count <= 6
        && /(?:让我们|希望|我们要|我们需要|必须|应当|需要|为了)/.test(group.source)
      ))
      .sort((left, right) => right.count - left.count);
    if (candidates.length) return candidates[0];
  }
  return null;
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
  return Math.min(4, tail.split(/[，,、]/).map((item) => item.trim()).filter(Boolean).length);
}

export function detectStructuralCues(rawMarkdown) {
  const cues = [];
  extractManuscriptSections(rawMarkdown).forEach((section, sectionIndex) => {
    const idPrefix = `section-${sectionIndex + 1}`;
    const addCue = (cue) => cues.push({
      sectionKey: section.sectionKey,
      markerLine: section.markerLine,
      ...cue,
    });
    const roles = repeatedBoldRoles(section);
    if (roles) {
      const atoms = responsibilityAtoms(roles);
      addCue({
        cueId: `${idPrefix}-roles`,
        sectionHeading: section.heading,
        type: "role-sequence",
        relation: "sequence",
        source: roles,
        ...(atoms.length >= 3 ? { fixedAtoms: atoms } : {}),
      });
      return;
    }

    const responsibility = responsibilitySequence(section);
    if (responsibility) {
      const atoms = responsibilityAtoms(responsibility);
      addCue({
        cueId: `${idPrefix}-responsibilities`,
        sectionHeading: section.heading,
        type: "role-sequence",
        relation: "sequence",
        source: responsibility,
        ...(atoms.length >= 3 ? { fixedAtoms: atoms } : {}),
      });
      return;
    }

    const architecture = mermaidArchitecture(section);
    if (architecture) {
      addCue({
        cueId: `${idPrefix}-architecture`,
        sectionHeading: section.heading,
        type: "architecture-pipeline",
        relation: "layered",
        source: architecture.source,
        fixedAtoms: architecture.atoms,
      });
      return;
    }

    const spectrum = spectrumWithMiddle(section);
    if (spectrum) {
      addCue({
        cueId: `${idPrefix}-spectrum`,
        sectionHeading: section.heading,
        type: "spectrum-focus",
        relation: "progression",
        source: spectrum,
      });
      return;
    }

    const decisionEnumeration = colonEnumeration(section, { requireDecisionWords: true });
    if (decisionEnumeration) {
      addCue({
        cueId: `${idPrefix}-decisions`,
        sectionHeading: section.heading,
        type: "decision-cluster",
        relation: "hub",
        source: decisionEnumeration,
      });
      return;
    }

    const progression = stateProgression(section);
    if (progression) {
      addCue({
        cueId: `${idPrefix}-state-progression`,
        sectionKey: section.sectionKey,
        sectionHeading: section.heading,
        type: "state-progression",
        relation: "progression",
        source: progression,
      });
      return;
    }

    const contrast = pairedContrast(section);
    if (contrast) {
      addCue({
        cueId: `${idPrefix}-paired-contrast`,
        sectionKey: section.sectionKey,
        sectionHeading: section.heading,
        type: "paired-contrast",
        relation: "comparison",
        source: contrast,
      });
      return;
    }

    const ordinalActions = ordinalParallelActions(section);
    if (ordinalActions) {
      addCue({
        cueId: `${idPrefix}-ordinal-parallel-actions`,
        sectionHeading: section.heading,
        type: "ordinal-parallel-actions",
        relation: "parallel",
        source: ordinalActions.source,
        explicitItemCount: ordinalActions.count,
      });
      return;
    }

    const ordinalSequence = explicitOrdinalSequence(section);
    if (ordinalSequence) {
      addCue({
        cueId: `${idPrefix}-ordinal-sequence`,
        sectionKey: section.sectionKey,
        sectionHeading: section.heading,
        type: "ordinal-sequence",
        relation: "sequence",
        source: ordinalSequence.source,
        explicitItemCount: ordinalSequence.count,
      });
      return;
    }

    const temporal = temporalSequence(section);
    if (temporal) {
      addCue({
        cueId: `${idPrefix}-temporal-sequence`,
        sectionHeading: section.heading,
        type: "temporal-sequence",
        relation: "sequence",
        source: temporal.source,
        explicitItemCount: temporal.count,
        temporalSequenceType: temporal.type,
      });
      return;
    }

    const questions = questionCluster(section);
    if (questions) {
      addCue({
        cueId: `${idPrefix}-question-cluster`,
        sectionHeading: section.heading,
        type: "question-cluster",
        relation: "hub",
        source: questions.source,
        explicitItemCount: questions.count,
      });
      return;
    }

    const actionList = parallelActionList(section);
    if (actionList) {
      addCue({
        cueId: `${idPrefix}-parallel-action-list`,
        sectionHeading: section.heading,
        type: "parallel-action-list",
        relation: "parallel",
        source: actionList.source,
        explicitItemCount: actionList.count,
      });
      return;
    }

    const parallelColon = colonEnumeration(section);
    if (parallelColon) {
      const ordered = /(?:先|首先).{0,80}(?:再|然后|最后)/.test(parallelColon);
      addCue({
        cueId: `${idPrefix}-enumeration`,
        sectionHeading: section.heading,
        type: ordered ? "sequence-enumeration" : "parallel-enumeration",
        relation: ordered ? "sequence" : "parallel",
        source: parallelColon,
      });
      return;
    }

    const quoteEnumeration = semicolonEnumeration(section);
    if (quoteEnumeration && /[>\-*]/.test(quoteEnumeration)) {
      addCue({
        cueId: `${idPrefix}-quote-enumeration`,
        sectionHeading: section.heading,
        type: "parallel-enumeration",
        relation: "parallel",
        source: quoteEnumeration,
      });
      return;
    }

    const expansion = expansionSequence(section);
    if (expansion) {
      addCue({
        cueId: `${idPrefix}-expansion`,
        sectionHeading: section.heading,
        type: "expansion-sequence",
        relation: "sequence",
        source: expansion,
      });
      return;
    }

    const transformation = paragraphContaining(section, /从.+?变成.+/);
    const transformationTitles = transformationAnchors(transformation);
    if (transformation && Array.from(transformation).length <= 180 && transformationTitles.length === 3) {
      const paragraphs = section.body.split(/\n\s*\n/);
      const index = paragraphs.indexOf(transformation);
      const context = [paragraphs[index - 1], transformation].filter(Boolean).join("\n\n");
      addCue({
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

    const semicolon = semicolonEnumeration(section);
    if (semicolon) {
      addCue({
        cueId: `${idPrefix}-enumeration`,
        sectionHeading: section.heading,
        type: "parallel-enumeration",
        relation: "parallel",
        source: semicolon,
      });
      return;
    }

    if (/少数人[\s\S]{0,180}(?:但|而)更多的人/.test(section.body)) {
      addCue({
        cueId: `${idPrefix}-categories`,
        sectionHeading: section.heading,
        type: "category-contrast",
        relation: "parallel",
        source: section.body,
      });
      return;
    }

    // A highlighted thesis is a page conclusion, not proof that the page has
    // only one semantic object. Let the content director retain its support.
  });
  return cues;
}

function cueTask(cue) {
  if (cue.type === "role-sequence") {
    return "提取重复声明的角色或职责，保持原有先后次序。每个明确的‘谁负责什么’恰好对应一个 atom；换一种说法、总结和背景不得成为 atom。";
  }
  if (cue.type === "sequence-transformation") {
    return "提取转化主骨架：初始产物、中间规律或机制、最终能力或结果，必须恰好三个 atoms。atoms 只能是主节点；前文冒号后的表达、容量、变化、禁忌等枚举不是阶段，必须作为中间 atom 的 points，绝不能提升为同级 atom。";
  }
  if (cue.type === "architecture-pipeline") {
    return "保留来源图中建设入口、核心能力库与正式调用出口三个系统层，必须恰好三个 atoms。";
  }
  if (cue.type === "decision-cluster") {
    return "提取围绕中心任务必须同时回答的 4–6 个判断问题；这些是并列的判断职责，不得虚构先后顺序，也不得用一句总括替代整组问题。";
  }
  if (cue.type === "spectrum-focus") {
    return "提取需求分布的三个区域：低要求端、中间主体需求、高度定制端，必须恰好三个 atoms；中间主体必须保留并设置 emphasis=true，不能只留下两个极端。";
  }
  if (cue.type === "expansion-sequence") {
    return "提取从当前明确起点向后扩展的 3–5 个真实对象或场景，保持由近到远的顺序；不得用一句最终结论替代扩展路径。";
  }
  if (cue.type === "direct-comparison") {
    return "从标题或核心结论中提取被直接比较的 A、B 双方，必须恰好两个 atoms。使用场景、结论和价值不能取代双方；双方 body 分别保留来源支持的区别，并按原稿明确倾向填写 polarity 与 emphasis。每侧还必须提取 3–5 条能够按相同维度逐行对应的短 points，数量一致；如果来源无法支持某一侧，不得编造。";
  }
  if (cue.type === "paired-contrast") {
    return "提取原稿明确对照的 A、B 两方，必须恰好两个 atoms。双方可以是对象、处境、时间截面或相反用途；body 分别保留原稿支持的核心差异。只有原稿存在逐项对应维度时才填写 points，不得为了套现有对比结构而编造。";
  }
  if (cue.type === "state-progression") {
    return "提取同一主体从初始状态、过渡状态到最终状态的 3–5 个真实阶段，保持状态变化顺序；原因、例子和评价放入对应节点说明，不得提升为并列主节点。";
  }
  if (cue.type === "ordinal-sequence") {
    return "按原稿显式序号提取全部步骤、批次或接力节点，保持原顺序；每个序号恰好对应一个 atom，不得把节点内部说明拆成额外步骤。";
  }
  if (cue.type === "temporal-sequence") {
    return "按原稿明确的时间锚点提取全部阶段并保持先后次序。过去、现在、未来分别成为节点；历史事件链则按真实事件发生顺序提取。背景评价不得冒充阶段。";
  }
  if (cue.type === "question-cluster") {
    return "提取围绕同一中心议题明确提出的全部独立问题，每个独立问题对应一个 atom，保持原顺序；‘为什么、为何、怎么说、如何理解’等短追问并入前一个问题，不单列节点；中心议题不作为额外 atom，也不得替问题作答。";
  }
  if (cue.type === "parallel-action-list") {
    return "提取原稿明确列出的全部同行动或要求，每个顿号分隔的行动恰好对应一个 atom；开场号召与最终愿景不作为额外 atom。";
  }
  if (cue.type === "ordinal-parallel-actions") {
    return "提取原稿以‘首先、其次、最后’列出的全部独立行动。顺序词只负责组织表述；若各行动不存在前一步完成后才能进入下一步的依赖，就保持为同级并列，不得机械改成流程。";
  }
  if (cue.type === "category-contrast") return "提取来源中两个不同处境或角色类别，必须恰好两个 atoms。它们是并列类别，不是优劣方案；背景和产品结论不得成为第三项。";
  return "提取枚举中全部子句所表达的同级决策维度或承诺维度。每个子句必须且只能进入一个 sourceFragments；语义上属于同一个维度的相邻子句应合并，不能遗漏，也不能输出总括词。";
}

function itemRangeForCue(cue) {
  if (cue.type === "role-sequence") {
    const count = Math.max(repeatedRoleCount(cue.source), (cue.source.match(/负责/g) ?? []).length);
    return { minItems: count, maxItems: count };
  }
  if (cue.type === "direct-comparison") return { minItems: 2, maxItems: 2 };
  if (cue.type === "paired-contrast") return { minItems: 2, maxItems: 2 };
  if (cue.type === "state-progression") return { minItems: 3, maxItems: 5 };
  if (cue.type === "ordinal-sequence") return { minItems: cue.explicitItemCount, maxItems: cue.explicitItemCount };
  if (cue.type === "temporal-sequence") return { minItems: cue.explicitItemCount, maxItems: cue.explicitItemCount };
  if (cue.type === "question-cluster") return { minItems: cue.explicitItemCount, maxItems: cue.explicitItemCount };
  if (cue.type === "parallel-action-list") return { minItems: cue.explicitItemCount, maxItems: cue.explicitItemCount };
  if (cue.type === "ordinal-parallel-actions") return { minItems: cue.explicitItemCount, maxItems: cue.explicitItemCount };
  if (cue.type === "architecture-pipeline") return { minItems: 3, maxItems: 3 };
  if (cue.type === "category-contrast") return { minItems: 2, maxItems: 2 };
  if (cue.type === "spectrum-focus") return { minItems: 3, maxItems: 3 };
  if (cue.type === "decision-cluster") return { minItems: 4, maxItems: 6 };
  if (cue.type === "expansion-sequence") return { minItems: 3, maxItems: 5 };
  if (cue.type === "sequence-transformation") return { minItems: 3, maxItems: 3 };
  const hasColon = cue.source.includes("：");
  const tail = hasColon ? cue.source.split("：").slice(1).join("：") : cue.source;
  let clauses = tail.split(hasColon ? /[，,]/ : /[；;]/).map((item) => item.trim()).filter(Boolean);
  if (hasColon && clauses.length < 3) {
    clauses = tail.split(/[，,、]/).map((item) => item.trim()).filter(Boolean);
  }
  const clauseCount = clauses.length;
  return {
    minItems: Math.min(clauseCount, Math.max(3, Math.ceil(clauseCount * 0.7))),
    maxItems: Math.min(7, clauseCount),
  };
}

function outputSchema(cue) {
  const maxBodyChars = cue.relation === "sequence" ? 18 : 32;
  const comparisonPoints = cue.type === "direct-comparison";
  const atom = {
    type: "object",
    additionalProperties: false,
    required: ["title", "body", "sourceFragments", ...(comparisonPoints ? ["points"] : [])],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 10 },
      body: { type: "string", minLength: 1, maxLength: maxBodyChars },
      sourceFragments: {
        type: "array",
        minItems: 1,
        items: { type: "string", minLength: 1 },
      },
      points: {
        type: "array",
        ...(comparisonPoints ? { minItems: 3, maxItems: 5 } : { maxItems: 4 }),
        items: { type: "string", minLength: 1, maxLength: comparisonPoints ? 16 : 8 },
        uniqueItems: true,
      },
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
  const sectionTag = `PPagenT来源章节=${hint.sectionKey}`;
  return pageContents.find((page) => String(page.notes ?? "").includes(sectionTag))
    ?? pageContents.find((page) => String(page.sourceText ?? "").includes(hint.markerLine ?? hint.sectionHeading))
    ?? pageContents.find((page) => String(page.title ?? "").includes(hint.sectionHeading));
}

function hintEvidenceFragments(page, hint) {
  const sourceText = String(page.sourceText ?? "");
  const candidates = [
    ...(hint.atoms ?? []).flatMap((atom) => atom.sourceFragments ?? []),
    hint.source,
    hint.markerLine,
  ]
    .map((value) => String(value ?? "").trim())
    .filter((value) => value && sourceText.includes(value));
  const grounded = [...new Set(candidates)].slice(0, 3);
  if (!grounded.length && sourceText) grounded.push(Array.from(sourceText).slice(0, 160).join(""));
  return grounded.map((value) => Array.from(value).slice(0, 160).join(""));
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
    page.logicIntent = {
      logicId: hint.relation === "none" ? "editorial" : hint.relation,
      reason: `程序从原稿识别出高置信 ${hint.relation} 主关系`,
      evidenceFragments: hintEvidenceFragments(page, hint),
      confidence: "high",
    };
    if (page.structuredData && hint.relation !== "hierarchy") delete page.structuredData;
  }
  return output;
}

function batchOutputSchema(cues) {
  return {
    name: "ppagent_structural_cues_batch",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["hints"],
      properties: {
        hints: {
          type: "array",
          minItems: cues.length,
          maxItems: cues.length,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["cueId", "atoms"],
            properties: {
              cueId: { type: "string", enum: cues.map((cue) => cue.cueId) },
              atoms: {
                type: "array",
                minItems: 1,
                maxItems: 7,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "body", "sourceFragments"],
                  properties: {
                    title: { type: "string", minLength: 1, maxLength: 10 },
                    body: { type: "string", minLength: 1, maxLength: 32 },
                    sourceFragments: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
                    points: { type: "array", maxItems: 5, uniqueItems: true, items: { type: "string", minLength: 1, maxLength: 16 } },
                    polarity: { enum: ["positive", "negative", "neutral"] },
                    emphasis: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

export function buildStructuralCueGuides(rawMarkdown) {
  return detectStructuralCues(rawMarkdown).map((cue) => ({
    cueId: cue.cueId,
    sectionKey: cue.sectionKey,
    markerLine: cue.markerLine,
    sectionHeading: cue.sectionHeading,
    type: cue.type,
    relation: cue.relation,
    source: cue.source,
    task: cueTask(cue),
    itemRange: itemRangeForCue(cue),
    ...(cue.fixedAtoms?.length ? { fixedAtoms: cue.fixedAtoms } : {}),
  }));
}

export function assertStructuralCueCompliance(contentOutput, guides) {
  for (const guide of guides ?? []) {
    const page = pageForHint(contentOutput.pageContents, guide);
    const items = page?.items ?? [];
    const pointCounts = items.map((item) => item.points?.length ?? 0);
    const comparisonPointsInvalid = guide.type === "direct-comparison"
      && (pointCounts.some((count) => count < 3 || count > 5) || new Set(pointCounts).size !== 1);
    const reason = !page
      ? "章节没有对应页面"
      : page.logicIntent?.logicId !== guide.relation
        ? `Logic 应为 ${guide.relation}，实际为 ${page.logicIntent?.logicId ?? "未填写"}`
        : items.length < guide.itemRange.minItems || items.length > guide.itemRange.maxItems
          ? `主节点应为 ${guide.itemRange.minItems}–${guide.itemRange.maxItems} 项，实际为 ${items.length} 项`
          : comparisonPointsInvalid
            ? "对比双方必须各有 3–5 条等量对应要点"
            : "";
    if (!reason) continue;
    const error = new Error(`内容导演没有遵守高置信结构线索：${guide.sectionHeading}；${reason}`);
    error.code = "CONTENT_LOGIC_MISMATCH";
    error.details = {
      sectionHeading: guide.sectionHeading,
      expectedLogic: guide.relation,
      expectedItemRange: guide.itemRange,
      actualLogic: page?.logicIntent?.logicId ?? null,
      actualItemCount: items.length,
      reason,
    };
    throw error;
  }
  return contentOutput;
}

function structuralHintInvalid(cue, value) {
  if (!value || !Array.isArray(value.atoms)) return true;
  const range = itemRangeForCue(cue);
  const maxBodyChars = cue.relation === "sequence" ? 18 : 32;
  return value.atoms.length < range.minItems
    || value.atoms.length > range.maxItems
    || value.atoms.some((atom) => Array.from(compactStructuralBody(atom.body)).length > maxBodyChars)
    || value.atoms.some((atom) => (atom.points?.length ?? 0) > (cue.type === "direct-comparison" ? 5 : 4))
    || value.atoms.some((atom) => (atom.points ?? []).some((point) => Array.from(point).length > (cue.type === "direct-comparison" ? 16 : 8)))
    || (cue.type === "direct-comparison"
      && (value.atoms.some((atom) => (atom.points?.length ?? 0) < 3)
        || new Set(value.atoms.map((atom) => atom.points.length)).size !== 1))
    || (cue.type === "sequence-transformation"
      && ((value.atoms[0]?.points?.length ?? 0) > 0 || (value.atoms[2]?.points?.length ?? 0) > 0))
    || (cue.type === "sequence-transformation" && cue.supportingPointCount > 0
      && (value.atoms[1]?.points?.length ?? 0) !== cue.supportingPointCount);
}

function batchCueContext(cues) {
  return cues.map((cue) => ({
    cueId: cue.cueId,
    sectionKey: cue.sectionKey,
    sectionHeading: cue.sectionHeading,
    relation: cue.relation,
    task: cueTask(cue),
    itemRange: itemRangeForCue(cue),
    maxBodyChars: cue.relation === "sequence" ? 18 : 32,
    source: cue.source,
    ...(cue.anchorTitles?.length ? { requiredNodeTitles: cue.anchorTitles } : {}),
    ...(cue.supportingPointCount ? { requiredMiddlePointCount: cue.supportingPointCount } : {}),
  }));
}

export async function readStructuralCues(rawMarkdown, model, { maxCues = 16 } = {}) {
  if (!model || typeof model.generateJson !== "function") return [];
  const cues = detectStructuralCues(rawMarkdown).slice(0, maxCues);
  if (!cues.length) return [];
  const modelCues = cues.filter((cue) => !cue.fixedAtoms?.length);
  if (!modelCues.length) return cues.map((cue) => ({ ...cue, atoms: cue.fixedAtoms }));
  const request = (requestedCues, retry = false) => model.generateJson({
    role: "PPagenT 结构化内容读取器",
    task: `一次完成 cues 中全部结构线索。每个 cueId 恰好返回一次并保持原顺序；严格按各 cue 的 task、itemRange、maxBodyChars 和 source 提取，不得跨章节借内容。对比两侧各有 3–5 条等量对应 points；转化结构只允许中间节点含 points。${retry ? "这是针对不合格项的唯一重试，必须逐项修正。" : ""}`,
    context: { cues: batchCueContext(requestedCues) },
    outputSchema: batchOutputSchema(requestedCues),
  });
  let output = await request(modelCues);
  let byId = new Map((output.hints ?? []).map((hint) => [hint.cueId, hint]));
  const invalid = modelCues.filter((cue) => structuralHintInvalid(cue, byId.get(cue.cueId)));
  if (invalid.length) {
    output = await request(invalid, true);
    const retryById = new Map((output.hints ?? []).map((hint) => [hint.cueId, hint]));
    byId = new Map(cues.map((cue) => [cue.cueId, retryById.get(cue.cueId) ?? byId.get(cue.cueId)]));
  }
  return cues.flatMap((cue) => {
    if (cue.fixedAtoms?.length) return [{ ...cue, atoms: cue.fixedAtoms }];
    const hint = byId.get(cue.cueId);
    if (structuralHintInvalid(cue, hint)) return [];
    const atoms = cue.anchorTitles?.length === hint.atoms.length
      ? hint.atoms.map((atom, index) => ({ ...atom, title: cue.anchorTitles[index] }))
      : hint.atoms;
    return [{ ...cue, atoms }];
  });
}
