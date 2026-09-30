# 外部依赖与接入

当前 M1 规划反馈与后续 M2 制作只接入真实稿件、一种已有风格所需的工具与字体；结构/图示/图表按需。先复用现有工具，完整部署、去除私有运行时依赖与商用条件归 M5 验收；不建设新的依赖平台，也不因推迟产品化而忽略现存许可限制。

本包包含 Harness 的规范正文。以下是工具或资产依赖，不以外部文档链接代替包内规范。

| 依赖 | 接入要求与缺失时行为 |
| --- | --- |
| Agent 宿主 | 支持文件读写、命令执行与持久状态。**多轮工具调用循环已归仓库所有**（`src/runner/`），不再要求宿主提供；宿主只提供文件与执行环境。模型走 HTTP 接口、按当次实际配置记录（R1 实测 DeepSeek，密钥经 `config/deepseek.local.json` 注入，不入包）。 |
| Node.js | 运行包内规则加载、语义检查和组合解析；不依赖全局 PPagenT npm 命令。 |
| PPT 制作、导入与渲染工具 | 提供可编辑文字/形状/表格/图表构建、PPTX 导出和逐页渲染。当前 Codex 的演示文稿技能与 bundled runtime 是宿主依赖；远端必须提供相应实现和工具说明，不能假装该 SDK 随文档包一起安装。**该 SDK 的许可证禁止生产与商业用途，参见下节。** |
| 结构库（可外挂） | 指定安装目录或工具入口，提供检索、适配、构建及实际检查；应含结构源设计与调用说明。选择原则已在包内 skills/references/selection.md，适配边界已在包内 docs/架构/结构库-变与不变.md。缺失时记录缺口，允许用适合内容的原生文字、表格或基础图形，不伪称调用成功。 |
| 品牌模板及大型 Native 执行器 | 大学 Skin 的固定模板、Logo 与专用构建器目前来自 PPagenT 外挂能力；未接入时不使用该品牌模式。本包只携带规则加载所需配置及轻量工具。 |
| 字体 | 按选中规则安装或明确替代并重新渲染，不以源机器有字体推断远端可用。 |

## PPT 引擎的许可限制（2026-09-12 实测）

上表「PPT 制作、导入与渲染工具」的具体实现是 `@oai/artifact-tool`。它**不是本仓库声明、也不在 npm 上**：`node_modules/@oai/artifact-tool` 是指向 `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool` 的目录联接，由 `src/tools/setup-workspace-dependencies.mjs:41-64` 建立；找不到时该脚本抛（`:60`）「未找到 Codex 工作区内置的 @oai/artifact-tool；请先在 Codex 中加载工作区依赖」。仓库根 `package.json` 没有声明这个依赖。

版本 `2.8.59`，包内 `LICENSE.md` 为 `PROPRIETARY AND CONFIDENTIAL`，Copyright © 2026 OpenAI, L.L.C.，要点逐条如下：

- 许可**仅限 internal evaluation and testing purposes**；
- 不得 copy、modify、distribute、sublicense、sell、lease，或提供给任何第三方；
- **不得用于 production、commercial 或 benchmarking purposes**；
- OpenAI **可随时终止**，终止后须立即停止使用并销毁全部副本。

依赖它的交付链路文件（实测 11 个）：`src/asset-runtime/component-builders.mjs`、`src/asset-runtime/template-utils.mjs`、`src/runtime/skins/northeastern-university.mjs`、`src/visual-runtime/html-component-runtime.mjs`、`src/tools/audit-core-asset-quality.mjs`、`src/tools/build-structure-group-examples.mjs`、`src/tools/render-pptx-evidence.mjs`、`src/tools/render-pptx-slide-evidence.mjs`、`src/tools/serve-logic-dashboard.mjs`、`src/tools/setup-workspace-dependencies.mjs`、`assets/主题/中性编辑排版-001/generate.mjs`。

**结论与边界：** 在装有 Codex 运行时的机器上确实能产出真实可编辑的 PPTX，但该能力**只在「已装 Codex 运行时」且「仅用于内部评估与测试」的前提下成立**。不能据此宣称可交付、可商业使用或可远端部署。全项目对它的调用已收敛到 `src/ppt-engine/index.mjs` 一处（许可探测与说明也导出自那里），将来替换引擎只改这一层。**该 SDK 不得复制进本包**，包内只携带适配层，不携带实现。

每次启动记录已发现的工具、版本、外挂路径和缺口。当前本机可用的 C:/PPagenT 仅是外挂的一个部署位置，不能硬编码为远端必需路径。凭据通过宿主配置注入，不进入本包或任务输出。

结构库定位为项目私有资产库，可独立部署或随私有部署打包；不以公开素材词库代替，也不因提供检索入口而默认公开资产。Harness 包内保留通用选择、适配和验收规范，外挂提供具体结构源设计与执行能力。技术图示与数据图表是另外两类按需能力，其可用性和许可按实际接入记录；三者均在整页职责与宏观区域明确之后选择，允许全部不用。
