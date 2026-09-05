---
name: ppagent-structure
description: 在 PPagenT 制作 PPT 时按内容逻辑查找并调用现有结构图，读取实际契约并生成原生可编辑元素。用于页面或局部需要流程、比较、层级等结构表达时，不负责结构资产入库和审美改造。
---

# PPagenT 结构表达

在本仓库根目录运行以下命令。`node` 使用 `load_workspace_dependencies` 返回的运行时；资源路径均相对项目根，便于以后移植 Harness。

## 按需查找

先根据稿件识别本组内容的关系，不以“结构多”作为目标。普通文字直接按 Skin 规则排版，不需要文字 Skill。

1. 查询实际可用逻辑与数量：`node .codex/skills/ppagent-structure/scripts/catalog.mjs list`。
2. 流程先读 [顺序结构 Skill](skills/ppagent-structure-sequence/SKILL.md)；比较先读 [比较结构 Skill](skills/ppagent-structure-comparison/SKILL.md)。其他逻辑可以直接用 `list --logic <logicId>` 查询当前目录。
3. 只读候选摘要。选择后用 `inspect <assetId>` 取得真实 manifest、参数示例、文字契约、运行入口和适配限制。参数示例仅解释调用形状，不能把示例事实带进稿件。
4. 将稿件内容绑定到参数，调用生成入口。找不到合适资产时，直接文字排版或用原生元素表达有来源依据的关系；不要伪造资产 ID。

`inspect` 读取当前资产真源，不维护平行静态清单。结构是否支持图片以其字段契约为准；一般图文排版不必进入结构检索。

## 真正调用

先读取 [调用接口](references/invocation.md)。在自己的 JavaScript PPT 构建脚本中导入 `scripts/invoke.mjs` 的 `invokeStructure`。它调用已有 HTML/Native 执行器，将结构加入当前 slide，并在成功或失败后向指定的运行记录文件追加事件。它不会生成整页截图来代替图示。

正文区和字体主题使用 `src/runtime/skins/northeastern-university-contract.mjs`；整页排版遵守 `docs/工作流/正式生成/Agent排版规则.md`。实际 Shell 可复用 `assets/主题/东北大学-001/runtime-template.pptx`。不要把旧 grid 的固定文字槽位当作新规则；可直接创建不同尺寸的文字框。

## 适配与反馈

数量、关系、极性、字段与自然尺寸必须符合所选资产。先读取契约再选区域，不能整体缩小后把字号补回来。复用资产内部对齐方式；当前任务每页正文只用一种对齐，冲突时换表达或调整区域组织。

发生错误先分清：参数/语义不合适、区域不足、Skill 说明缺失、运行环境故障。只修改有证据的问题后重试。禁止吞错后改成假结构并声称调用成功。保存失败与成功事件，报告实际采用的表达。新的页面组合不自动晋升核心资产。

本 Skill 在当前任务可通过显式读取使用；新建文件是否已被应用自动发现，需要另行验证，不能把手动加载说成自动触发。
