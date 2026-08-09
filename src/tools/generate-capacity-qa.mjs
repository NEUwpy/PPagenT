import fs from "node:fs/promises";
import path from "node:path";
import {
  buildComparison,
  buildFlowMap,
  buildGoalKpiMap,
  buildLayeredArchitecture,
  buildRadialHub,
  buildSequentialProcess,
  buildSwimlaneProcess,
  buildTimelineRoadmap,
  saveSingleExample,
} from "../asset-runtime/component-builders.mjs";
import {
  buildDualTrackRoadmap,
  buildEvolutionStaircase,
  buildOrganizationTree,
} from "../asset-runtime/history-organization-builders.mjs";
import {
  buildConclusionBands,
  buildConcentricCapabilitySystem,
  buildResearchMethodSummary,
  buildTechnicalRouteFlow,
  buildTheoryIntegrationFramework,
} from "../asset-runtime/academic-model-builders.mjs";
import { buildGeographicNetwork } from "../asset-runtime/geographic-model-builders.mjs";

const outputRoot = path.resolve(process.argv[2] ?? ".tmp/capacity-qa");
await fs.mkdir(outputRoot, { recursive: true });
const text = (index) => `要点 ${index + 1}`;
const jobs = [
  ["comparison-max.pptx", buildComparison, {
    title: "双向对比上限", centerLabel: "比较",
    left: { title: "方案 A", items: Array.from({ length: 5 }, (_, index) => text(index)) },
    right: { title: "方案 B", items: Array.from({ length: 5 }, (_, index) => text(index)) },
  }],
  ["flow-map-max.pptx", buildFlowMap, {
    title: "多阶段流向上限",
    columns: ["输入", "处理", "输出"].map((label, column) => ({ label, items: Array.from({ length: 4 }, (_, index) => ({ title: `${label}${index + 1}`, value: `${(index + 1) * 10}%` })) })),
    flows: Array.from({ length: 8 }, (_, index) => ({ fromColumn: index < 4 ? 0 : 1, fromIndex: index % 4, toColumn: index < 4 ? 1 : 2, toIndex: (index + 1) % 4, weight: 5 })),
  }],
  ["goal-kpi-max.pptx", buildGoalKpiMap, {
    title: "目标与 KPI 上限", goal: "总体目标", summary: "持续提升",
    rows: Array.from({ length: 3 }, (_, row) => ({ title: `子目标 ${row + 1}`, body: "解释目标及关键行动。", metrics: Array.from({ length: 3 }, (_, index) => ({ label: `指标${index + 1}`, value: `${80 + index}%` })) })),
  }],
  ["layered-architecture-max.pptx", buildLayeredArchitecture, {
    title: "分层架构上限", sources: Array.from({ length: 6 }, (_, index) => `来源${index + 1}`), platform: "共享能力平台", apps: Array.from({ length: 5 }, (_, index) => `应用${index + 1}`),
  }],
  ["radial-hub-max.pptx", buildRadialHub, { title: "中心辐射上限", center: "核心主题", items: Array.from({ length: 8 }, (_, index) => text(index)) }],
  ["sequential-process-max.pptx", buildSequentialProcess, { title: "顺序流程上限", steps: Array.from({ length: 6 }, (_, index) => ({ title: `阶段${index + 1}`, body: "核心任务与交付要求" })) }],
  ["swimlane-max.pptx", buildSwimlaneProcess, {
    title: "泳道流程上限", lanes: ["角色A", "角色B", "角色C"], stages: ["准备", "执行", "验证", "交付"],
    tasks: Array.from({ length: 8 }, (_, index) => ({ label: `任务${index + 1}`, lane: index % 3, stage: index % 4 })),
  }],
  ["timeline-max.pptx", buildTimelineRoadmap, { title: "发展历程上限", milestones: Array.from({ length: 4 }, (_, index) => ({ period: `${2022 + index}`, title: `里程碑${index + 1}`, body: "阶段成果与能力提升" })) }],
  ["organization-tree-max.pptx", buildOrganizationTree, {
    title: "组织树上限", leader: { name: "负责人", role: "总负责人" },
    departments: Array.from({ length: 4 }, (_, department) => ({ name: `部门${department + 1}`, head: `主管${department + 1}`, members: Array.from({ length: 3 }, (_, member) => ({ name: `成员${department + 1}${member + 1}`, role: `岗位${member + 1}` })) })),
  }],
  ["evolution-staircase-max.pptx", buildEvolutionStaircase, { title: "演进阶梯上限", stages: Array.from({ length: 5 }, (_, index) => ({ period: `${2021 + index}`, name: `阶段${index + 1}`, marker: `S${index + 1}`, body: "阶段任务、主要成果与能力变化" })) }],
  ["dual-track-max.pptx", buildDualTrackRoadmap, { title: "双轨路线图上限", trackA: "业务主线", trackB: "技术主线", stages: Array.from({ length: 5 }, (_, index) => ({ period: `${2021 + index}`, name: `阶段${index + 1}`, body: "两条主线在本阶段的协同变化" })) }],
  ["research-method-max.pptx", buildResearchMethodSummary, {
    title: "研究方法上限", sectionTitle: "样本与数据", summary: "覆盖研究设计、样本选择、变量测量、质量控制和偏差检验。", sample: { value: "5000", label: "总体样本" }, response: { value: "4200", label: "有效样本" },
    dimensions: Array.from({ length: 5 }, (_, index) => ({ name: `方法维度${index + 1}`, body: "说明该维度的操作方式与质量要求。" })),
  }],
  ["technical-route-max.pptx", buildTechnicalRouteFlow, {
    title: "技术路线上限", startLabel: "启动", question: "明确研究问题", objective: "确定整体目标", branches: Array.from({ length: 4 }, (_, index) => `分支${index + 1}`), core: "构建综合分析模型", inputs: ["实验数据", "现场数据", "专家知识"], analysis: "分析变量关系并验证模型", result: "形成结论",
  }],
  ["conclusion-bands-max.pptx", buildConclusionBands, { title: "结论陈述上限", sections: Array.from({ length: 4 }, (_, index) => ({ name: `结论层${index + 1}`, points: Array.from({ length: 4 }, (_, point) => `结论要点 ${point + 1}`) })) }],
  ["concentric-system-max.pptx", buildConcentricCapabilitySystem, { title: "同心系统上限", center: "核心系统", capabilities: Array.from({ length: 8 }, (_, index) => `能力${index + 1}`) }],
  ["theory-framework-max.pptx", buildTheoryIntegrationFramework, { title: "理论框架上限", domains: Array.from({ length: 4 }, (_, index) => ({ name: `理论域${index + 1}`, body: "理论贡献与适用边界" })), criteria: Array.from({ length: 5 }, (_, index) => `准则${index + 1}`) }],
  ["geographic-network-max.pptx", buildGeographicNetwork, {
    title: "地域网络上限", panelTitle: "覆盖能力",
    locations: Array.from({ length: 10 }, (_, index) => ({ id: `p${index}`, name: `节点${index + 1}`, value: `${index + 2}城`, x: (index % 5) / 4, y: Math.floor(index / 5) * 0.65 + (index % 2) * 0.2 })),
    routes: Array.from({ length: 9 }, (_, index) => ({ from: `p${index}`, to: `p${index + 1}` })),
    stats: Array.from({ length: 5 }, (_, index) => ({ label: `指标${index + 1}`, value: `${index + 1}0` })),
  }],
];

for (const [name, builder, config] of jobs) {
  await saveSingleExample(builder, config, path.join(outputRoot, name));
  console.log(name);
}
