export const draft = "稿件/变革不足与感悟-v3-条件否定.md";
export const gist = "破解落地阻力、补齐合规短板，以解决实际问题检验变革成效";
export const inputs = [
  { key: "atmosphere", title: "变革氛围", body: "尚未完全形成", evidence: "变革氛围尚未完全形成" },
  { key: "systems", title: "信息系统", body: "支撑能力仍有差距", evidence: "信息系统支撑能力仍存在差距" },
  { key: "management", title: "管理机制", body: "缺乏市场化机制", evidence: "缺乏市场化的管理机制" },
];
export const result = { title: "变革落地受阻" };
export const anchors = ["业务战略", "人力资源战略规划", "落地方案"];
export const points = [
  { title: "用 BLM 统一语言、目标和策略", evidence: "统一语言、统一目标、统一策略" },
  { title: "以实效检验变革", cue: "能否解决实际问题，是唯一标准", evidence: "检验变革的唯一标准" },
  { title: "顶层设计持续迭代", cue: "小步试点、对标实践，按落地成效优化", evidence: "结合落地成效持续开展迭代优化" },
  { title: "统筹变革、合规与作风", cue: "作风改进不要求立竿见影，重在持续用力", evidence: "作风改进不要求立竿见影，重在持续用力。" },
];
export const sources = [
  ...[...inputs, ...points].map((part) => part.evidence),
  "完成顶层设计后，变革落地就是关键。",
  "2017年的巡视整改虽然取得了一定成效，但也充分暴露出人力条线基础管理薄弱的问题",
  "认识有待提升、作风有待转变、能力有待增强、协同有待深化",
  "从业务战略到人力资源战略的规划设计端到端人力资源落地解决方案",
];
