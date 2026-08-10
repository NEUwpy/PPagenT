import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import {
  applyTemplateMappedRecipes,
  exportTemplateMappedQa,
  prepareTemplateMappedStarter,
} from "../../../src/asset-runtime/template-utils.mjs";
import { renderComponentIntoSlide } from "../../../src/asset-runtime/component-builders.mjs";
import { buildGoalKpiMap } from "../../../src/asset-runtime/component-builders.mjs";
import { buildOrganizationTree, buildDualTrackRoadmap } from "../../../src/asset-runtime/history-organization-builders.mjs";
import { buildFishboneAnalysis } from "../../../src/asset-runtime/analysis-model-builders.mjs";
import { buildResearchMethodSummary } from "../../../src/asset-runtime/academic-model-builders.mjs";
import { northeasternUniversitySkin } from "../../../src/runtime/skins/northeastern-university.mjs";

const experimentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(experimentDir, "..", "..", "..");
const sourcePptx = path.join(projectRoot, "workbench", "source-archive", "PPT模板-封面正文尾页.pptx");
const outputPptx = path.join(experimentDir, "结构家族第二批-东北大学Skin-v0.1.0.pptx");
const qaDir = path.join(experimentDir, "qa");
const starterPptx = path.join(experimentDir, ".runtime", "template-starter.pptx");

const people = ["林澈", "周岚", "陈昊"];
const roles = ["策略研究", "产品设计", "质量验证"];
const departments = (count, memberCount) => Array.from({ length: count }, (_, index) => ({
  name: ["研究组", "产品组", "技术组", "运营组"][index],
  head: ["徐阳", "吴飞", "陈军", "沈嘉"][index],
  members: Array.from({ length: memberCount }, (_, memberIndex) => ({ name: people[memberIndex], role: roles[memberIndex] })),
}));
const kpiRows = (count, metricCount) => Array.from({ length: count }, (_, index) => ({
  title: ["内容运营", "用户增长", "产品技术", "商业合作", "交付质量"][index],
  body: ["提升内容供给与传播效率", "扩大有效用户并提升活跃", "保障稳定并缩短交付周期", "拓展伙伴并提升合作质量", "建立可复核的交付标准"][index],
  metrics: Array.from({ length: metricCount }, (_, metricIndex) => ({ value: ["98%", "24h", "+18%"][metricIndex], label: ["达成率", "响应时效", "增长率"][metricIndex] })),
  outcome: ["扩大影响", "提升活跃", "保障稳定", "增强盈利", "可靠交付"][index],
}));
const fishboneBranches = (count, itemCount) => Array.from({ length: count }, (_, index) => ({
  category: ["人员", "流程", "技术", "资源", "需求", "环境"][index],
  items: ["关键岗位不足", "协同边界不清", "验证覆盖不足", "经验尚未沉淀"].slice(0, itemCount),
}));
const dualStages = (count) => Array.from({ length: count }, (_, index) => ({
  period: `${2025 + index}`,
  trackA: { title: ["验证场景", "标准流程", "扩展场景", "规模运营", "生态协作"][index], body: ["完成真实业务闭环", "明确交付与协作边界", "覆盖更多组织用途", "让生产流程稳定运行", "形成伙伴协作网络"][index] },
  trackB: { title: ["搭建基础", "沉淀组件", "统一内核", "智能协同", "开放能力"][index], body: ["形成稳定生成能力", "积累规则与运行代码", "复用契约与质量门禁", "双导演与资产协同", "提供标准能力接口"][index] },
}));
const dimensions = (count) => Array.from({ length: count }, (_, index) => ({
  name: ["研究对象", "成立年限", "收入来源", "偏差检验", "稳健分析"][index],
  body: ["明确纳入标准、覆盖范围与样本单位。", "区分早期、成长与成熟阶段。", "识别主要业务结构和交易特征。", "比较早晚期样本并检验非应答偏差。", "更换口径后重复估计并核对方向。"][index],
}));

const cases = [
  { contentTitle: "项目团队组织架构", sectionName: "组织与职责", validationLabel: "三层组织树 · 2部门×1成员", builder: buildOrganizationTree, params: { title: "项目团队组织架构", leader: { name: "李明", role: "项目负责人" }, departments: departments(2, 1) } },
  { contentTitle: "项目团队组织架构", sectionName: "组织与职责", validationLabel: "三层组织树 · 4部门×3成员", builder: buildOrganizationTree, params: { title: "项目团队组织架构", leader: { name: "李明", role: "项目负责人" }, departments: departments(4, 3) } },
  { contentTitle: "年度目标与责任指标", sectionName: "目标与指标", validationLabel: "目标与 KPI 映射 · 3单元×1指标", builder: buildGoalKpiMap, params: { title: "年度目标与责任指标", goal: "年度总目标：形成稳定、可持续的业务增长能力", rows: kpiRows(3, 1), summary: "责任单元、过程指标与最终贡献保持一一对应" } },
  { contentTitle: "年度目标与责任指标", sectionName: "目标与指标", validationLabel: "目标与 KPI 映射 · 5单元×3指标", builder: buildGoalKpiMap, params: { title: "年度目标与责任指标", goal: "年度总目标：形成稳定、可持续的业务增长能力", rows: kpiRows(5, 3), summary: "责任单元、过程指标与最终贡献保持一一对应" } },
  { contentTitle: "项目延期原因拆解", sectionName: "问题分析", validationLabel: "鱼骨原因分析 · 4类×1因素", builder: buildFishboneAnalysis, params: { title: "项目延期原因拆解", effect: "交付延期", branches: fishboneBranches(4, 1) } },
  { contentTitle: "项目延期原因拆解", sectionName: "问题分析", validationLabel: "鱼骨原因分析 · 6类×4因素", builder: buildFishboneAnalysis, params: { title: "项目延期原因拆解", effect: "交付延期", branches: fishboneBranches(6, 4) } },
  { contentTitle: "业务与技术双轨演进", sectionName: "发展路线", validationLabel: "双轨演进路线 · 3阶段", builder: buildDualTrackRoadmap, params: { title: "业务与技术双轨演进", start: "共同起点", trackA: "业务主线", trackB: "技术主线", stages: dualStages(3) } },
  { contentTitle: "业务与技术双轨演进", sectionName: "发展路线", validationLabel: "双轨演进路线 · 5阶段", builder: buildDualTrackRoadmap, params: { title: "业务与技术双轨演进", start: "共同起点", trackA: "业务主线", trackB: "技术主线", stages: dualStages(5) } },
  { contentTitle: "研究方法与样本说明", sectionName: "研究设计", validationLabel: "研究方法摘要 · 3维度", builder: buildResearchMethodSummary, params: { title: "研究方法与样本说明", sectionTitle: "样本及数据收集", summary: "采用分层抽样与结构化问卷相结合的方法，覆盖不同规模、行业和发展阶段的研究对象。", sample: { value: "5830", label: "发放样本" }, response: { value: "4280", label: "有效回收" }, dimensions: dimensions(3) } },
  { contentTitle: "研究方法与样本说明", sectionName: "研究设计", validationLabel: "研究方法摘要 · 5维度", builder: buildResearchMethodSummary, params: { title: "研究方法与样本说明", sectionTitle: "样本及数据收集", summary: "采用分层抽样与结构化问卷相结合的方法，覆盖不同规模、行业和发展阶段的研究对象。", sample: { value: "5830", label: "发放样本" }, response: { value: "4280", label: "有效回收" }, dimensions: dimensions(5) } },
];

const recipes = cases.map((item, index) => ({
  sourceSlideNumber: 3,
  textEdits: [
    { sourceText: "01", replacementText: String(index + 1).padStart(2, "0") },
    { sourceText: "正文页", replacementText: item.sectionName },
    { sourceText: "主旨句", replacementText: item.contentTitle },
    { sourceText: "正文", replacementText: "", writeMode: "replace-all" },
  ],
  deletions: [
    { kind: "shape", name: "箭头: 下 9" },
    { kind: "image", name: "图片 10" },
  ],
  notes: `[Sources]\n- 视觉：东北大学正文 Skin\n- 结构检索标签：${item.validationLabel}\n- 用途：候选资产 Skin 实装压力测试\n[/Sources]`,
}));

await prepareTemplateMappedStarter({ sourcePptx, sourceSlideNumbers: recipes.map(() => 3), starterPptx });
const presentation = await PresentationFile.importPptx(await FileBlob.load(starterPptx));
const slides = await applyTemplateMappedRecipes(presentation, recipes);
cases.forEach((item, index) => {
  renderComponentIntoSlide(item.builder, slides[index], item.params, {
    sourceFrame: northeasternUniversitySkin.componentSourceFrame,
    targetFrame: northeasternUniversitySkin.bodyFrame,
    theme: northeasternUniversitySkin.componentTheme,
  });
});

await fs.mkdir(path.dirname(outputPptx), { recursive: true });
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(outputPptx);
await exportTemplateMappedQa(presentation, qaDir);
console.log(JSON.stringify({ outputPptx, qaDir, slideCount: slides.length }, null, 2));
