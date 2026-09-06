# run-01 交付检查记录

## 输入与设计取舍

- 原稿：`inputs/01-convergence.md`。本页沟通目的为说明交接质量取决于现场、检测、备件三路资料共同进入一份维修交接单。
- 内容关系：三路输入同级、可独立准备，直接汇聚为一个共同结果。没有加入先后筛选、中间归纳、故障排除结论或任何时间节约／完成率数字。
- 结构选择：先用 `catalog.mjs list --logic convergence` 检索，再用 `inspect` 核对契约，直接调用 `convergence-many-to-one-003`。该资产要求 3–6 路同级输入、1 个共同结果，契合本稿；未使用漏斗结构。
- 页面编排：`neutral-editorial-001 / magazine`。正文结构占用 Skin Content Frame `55,166,1170,492`；页首采用 `01 + Noto Serif SC 页标题 + 延伸细线`，页码置右下。组件主题传入纸色、炭黑、正文灰、辅助灰、分隔线、砖红及 `Noto Sans SC`；组件主题字号按 pt 传入，原生页首／页码字号按设计 px 传入。
- 原生样式适配：结构调用成功后按稳定 `sh/...` 对象 ID 识别输入框、结果框和文字对象，保留几何、节点、路径和文本，仅将输入框改为纸色细框无阴影，将结果框改为浅承载色砖红细框无阴影，并将结构文字归入杂志风的 21／17／15px 角色。详见 `style-adaptation.md`。

## 最终产物

- 可编辑 PPTX：`deck.pptx`（1 页，16:9）。结构路径、输入框、结果框和全部文字保持原生对象；未使用整页截图。
- 最终导入渲染：`render-imported/slide-01.png`。
- 最终导入检查：`inspect-imported.ndjson` 与 `slide-01-imported.layout.json`。
- 完整结构调用日志：`structure-invocations.ndjson`。每次 attempt/success 均保留，包含参数、目标区域、理由和 manifest 路径。
- 规则加载完整输出：`rules-load-output.txt`。
- 最终化器收据：`.codex-finalizer/deck-v2.validation.json`。

## 实际检查

- 内容覆盖：现场记录保留“故障现象与发生时间”；检测记录保留“测量读数与测试条件”；备件记录保留“替换型号与领用数量”；共同结果为“维修交接单”。结果说明可见“接班追溯；双方确认”，并明确“材料缺失标注待补”。不确定边界和无数据声明写入 speaker notes 的 `[Boundaries]`。
- 文字与字体：最终导入检查显示页标题使用 `Noto Serif SC`，页码和三路节点文字使用 `Noto Sans SC`；三路输入标题／说明均为单行，结果说明为按语义断开的 2 行，未出现孤字或溢出。最终化器观察到字体族仅为这两种，字号／几何检查无告警。
- 线条与净距：三条渐变汇聚路径从各输入框右边界 `x=373` 出发，抵达共同结果左边界 `x=917`；路径没有穿过输入文字、结果文字或页首标题。页首细线从标题右侧留白后开始。
- 内容组高度与重心：三路输入沿正文区上／中／下分布，结果框保持右侧稳定，结构组在 `y=188–658` 内完成，页首与页码保留独立安全区。留白集中在路径之间，承担分路与汇聚的阅读停顿。
- 文件与导入：最终化器 `packageIntegrity`、`presentationLayout`、`firstPartyImport` 均通过，页数为 1，尺寸为 13.3333×7.5 in；导入渲染工具返回 `slideCount: 1`。
- 视觉复核：已打开并检查最终 `render-imported/slide-01.png`。修订前结果说明曾在“缺／失”之间断行，已调整为“接班追溯；双方确认”与“材料缺失标注待补”两行并重新最终化、导入、渲染复核。
- 样式复核：适配后输入卡片不再使用默认白卡阴影，结果框不再使用旧蓝色深填充；关系路径的三路汇聚几何保持不变，结果标题实际为 Noto Serif SC 21px 角色。

## 失败与修订证据

- 首次运行：归档 builder 的结构 Skill 相对导入路径多退一层，报 `ERR_MODULE_NOT_FOUND: C:\.codex\skills\ppagent-structure\scripts\invoke.mjs`。未进入结构调用，随后只修正导入路径。
- 第二次运行：结构调用成功，但最终化器导入验证报 `RUNTIME_NODE_MODULES is required`。按 presentations 技能设置工作区内置 `RUNTIME_NODE_MODULES` 后重跑。
- 第三次运行：最终化器报 `Private validation receipt must stay inside the task workspace and outside final output`。将最终化输出放到 `run-01/final/`，收据留在 `run-01/.codex-finalizer/`。
- 第四次运行：最终化器报 `Final presentation must remain inside the real task workspace`，原因是 `final/` 尚未预先创建。创建已验证目录后重跑并通过。
- 样式适配第一次尝试：从 `slide.export({format:"layout"})` 取得的数字索引不能用于 `presentation.resolve`，报 `Invalid aid: 8`。未写出产物，随后改为 `presentation.inspect` 获取稳定对象 ID，再按相同几何做样式适配并重新验证。
- 视觉修订：为修正结果说明的不自然断行，保留旧版为 `.codex-finalizer/deck-v1.pptx` 和 `.codex-finalizer/deck-v1-finalized.pptx`，改写结果说明的语义断行，重新调用、最终化并导入渲染。日志中的重复 success 是这些可追溯重跑，未隐藏失败。

## 未解决限制

- 最终化器的字体策略检查通过，但其 `native_font_rendering_verified` 标记为 `false`；本轮完成的是 Artifact Tool 导入、布局与实际 PNG 目检，未在桌面 PowerPoint 中打开验证。
- 结构资产自身使用 HTML/SVG 汇聚路径，路径和节点已编译为可编辑 PPT 对象；未把位图作为结构替代。
