# PPagenT

从 Git `d5efa449`（2026-09-12）起，项目正式转向轻量 PPT Harness 重构：先用一份短稿、一种已有风格跑通内容 → 蓝图 → 原生 PPT → 实际渲染、检查、返工的最小闭环，再按证据扩展流程。当前完成架构说明对齐，尚未开始新 R1 制作。

新任务从 [Harness 入口](harness/README.md) 开始；[架构与运行流程](harness/运行流程.md)维护最小产物和职责，[R0–R3 项目进度](docs/方向讨论/页面编排能力计划.md)维护里程碑。默认交付完整 PPT，只有明确要求时停在初模。A–H 保留参考，旧 API 生产线保留兼容，不再作为新主架构。

结构库当前采用“一结构一份源设计，各 Skin 共用”的模式。35 个已审批结构已接入中性 Skin 的统一色阶转换；大中小保真适配仍为三个样板。修改范围、主色入口与验证边界见[当前结构架构](docs/产品定义.md#结构源设计与-skin-的共享方式2026-09-08)，预览见[统一转换记录](experiments/structure-unified-neutral/index.html)。

PPagenT 面向工作型演示，把用户内容整理为表达清楚、视觉合适、原生可编辑的 PowerPoint。第一正式场景是东北大学，目标是让设计经验可复用，而不是让每页都套结构图。

## 当前状态

兼容保留的旧生产线是内容导演编排、程序筛选候选、视觉导演选择、Native 生成与检查。它已支持已披露的文字加结构混合页，尚不是自主工具循环的 Agent Harness；正式 CLI 仍使用东北大学 Skin。

现行设计与角色规则集中到根目录 [rules/](rules/README.md)，通过索引按用途读取。暂定每个 Skin 一个颜色体系、绑定一个排版体系；多个 Skin 可复用同一排版体系。当前中性 Skin 自动加载「杂志风」，东北大学 Skin 自动加载「麦肯锡式」六字段排版，可用于独立制作任务；中性 Skin 资产仍为 candidate，结构预览已接入共享转换，正式 CLI 仍限东北大学。规则拆分不等于已经实现通用图文、复合页或四类输入自动处理。

中性 Skin 与杂志风、东北大学 Skin 与麦肯锡式均已登记独立制作规则绑定，继续以 Luna high 验证实际效果。独立制作入口已按需连接结构 Skill：通用组件跨 Skin 复用，适配则优先直接调用，不能直接套用则参考适配；项目库不适合时，关系图以 Archify 补充，数据图表以 Lieflat Charts 非商业试用补充；适用技能均不适合再自主编排；不强制每页使用结构，尚未证明跨稿稳定性。

## 入口

新 Harness 首个闭环在任务中选择一种已有风格，不同时验证两套。选择「东北大学 Skin＋麦肯锡式」时使用六字段排版；结构按[大学结构入口](docs/工作流/正式生成/大学结构调用.md)复用原造型并适配区域。中性 Skin＋杂志风仍可显式选择。新入口的技术检查不等于整页审美验收。

独立制作的关系表达按[技能选择顺序](skills/references/selection.md)：项目结构技能优先，Archify 补充技术图示，Lieflat Charts 补充数据图表（当前非商业试用）。Skin 与绑定排版体系提供基础视觉；生成、编辑性和视觉检查仍须实际完成。

- [产品需求](docs/产品需求.md)：输入、交付与用户修改权限，不绑定实现架构。
- [产品定义](docs/产品定义.md)：产品边界、兼容能力与结构事实；Harness 执行架构以其运行流程为准。
- [规则维护](rules/README.md)：单一规则来源、按需加载与经验沉淀。
- [结构库尺寸适配改造目标](docs/架构/结构库尺寸适配改造目标.md)：保留核心特征、调整尺寸并参与页面编排的持续改造档案。
- [项目技能库](skills/README.md)：技能清单表、固定版本上游技能与许可、项目入口及未来 Harness 绑定说明。
- [正式生成工作流](docs/工作流/正式生成/工作流.md)：可运行命令与当前限制。
- [独立生成任务提示词](docs/工作流/正式生成/生成任务提示词.md)：新任务读取规则的短入口。
- [文档地图](docs/README.md)、[更新日志](docs/更新日志.md)：其余资料与状态记录。

## 已合并的大学咨询式排版实验

`codex/penguin-harness-v2` 的提示词、结构主题适配、Harness 原型与完整生成证据已纳入 main。三篇 29 页精选稿及独立首轮对照见[整稿展示](experiments/university-skin-pilot/stability-01/index.html)，实际通过数与限制见[测试记录](experiments/university-skin-pilot/stability-01/RESULTS.md)。这些是实验成果；大学现行绑定采用六字段规则，不加载这些历史长指南；规则接入不代表正式 Harness 已迁移。

## 旧工作台使用与代码验证

安装 Node.js 20 或更高版本后：

```powershell
npm ci
npm run setup:workspace
npm run production:workbench
```

也可双击 `启动PPA生产工作台.cmd`／`启动PPA看板.cmd`。Provider 和密钥配置见[运行配置契约](docs/契约/运行配置信息.md)；真实密钥不进入 Git。

只读取独立制作所需规则，不启动模型或生成 PPT：

```powershell
npm run rules:load -- --profile generation --skin neutral-editorial-001
```

`npm test` 执行契约、程序测试和公开审计；本地有 `PPT源/` 时可额外运行 `npm run audit:local`。程序测试不能替代成品逐页视觉检查。

主要目录：`rules/` 管规则正文；`assets/` 管资产声明与实现（含候选）；`catalog/` 管目录数据；`src/` 管加载、编排与执行；`稿件/` 管原稿；`PPT源/` 是唯一原始 PPT 来源且被 Git 忽略。实验和历史文档不作为当前生成入口。
