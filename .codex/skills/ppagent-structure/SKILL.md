---
name: ppagent-structure
description: 在 PPagenT 制作 PPT 时按内容逻辑检索结构，直接调用现有组件或参考其设计重组原生可编辑表达。用于流程、比较、层级等局部关系，不负责核心资产入库。
---

# PPagenT 结构表达

在本仓库根目录运行以下命令。`node` 使用 `load_workspace_dependencies` 返回的运行时；资源路径均相对项目根，便于以后移植 Harness。

## 按需查找

先根据稿件识别本组内容的关系，不以“结构多”作为目标。普通文字直接按 Skin 规则排版，不需要文字 Skill。

1. 查询实际可用逻辑与数量：`node .codex/skills/ppagent-structure/scripts/catalog.mjs list`。
2. 流程先读 [顺序结构 Skill](skills/ppagent-structure-sequence/SKILL.md)；比较先读 [比较结构 Skill](skills/ppagent-structure-comparison/SKILL.md)。其他逻辑可以直接用 `list --logic <logicId>` 查询当前目录。
3. 只读候选摘要。根据任务选择直接调用或参考重组；无需两套路径同时执行。直接调用用 `inspect <assetId>` 取得真实参数与执行契约；参考重组用 `reference <assetId>` 取得语义、视觉意图和实际实现路径，再按需要读源码。
4. 示例只用于理解方法，不能把示例事实带进稿件。找不到合适参考时，按稿件关系直接排原生元素并如实记录来源情况。

`inspect` 读取当前资产真源，不维护平行静态清单。结构是否支持图片以其字段契约为准；一般图文排版不必进入结构检索。

## 参考重组

任务要求以结构作参考，或允许自主重组时，读[参考使用](references/reference-use.md)。参考提供关系表达与设计经验，不强制复制源坐标、尺寸或造型。依据目标区域与整页论证重新组织节点、连接和说明，使用本次主题与排版指南；保留稿件中的顺序、归属、极性及条件。产生本次 PPT 的原生表达，记录参考 ID、吸收的方法及主要变化。没有执行 `invokeStructure` 就不报告直接调用成功。

## 直接调用

先读取 [调用接口](references/invocation.md)。在自己的 JavaScript PPT 构建脚本中导入 `scripts/invoke.mjs` 的 `invokeStructure`。它调用已有 HTML/Native 执行器，将结构加入当前 slide，并在成功或失败后向指定的运行记录文件追加事件。它不会生成整页截图来代替图示。

正文区、主题与对齐使用本次明确指定的 Skin 设计指南；未指定时读取 `docs/工作流/正式生成/Agent排版规则.md` 确认入口。`src/runtime/skins/northeastern-university-contract.mjs` 是旧大学接口参考，不覆盖本次 Skin。仅任务要求继承旧模板时复用其 Shell，不把旧 grid 文字槽位当作新规则。

## 直接调用的适配与反馈

数量、关系、极性、字段与自然尺寸必须符合所选资产。先读取契约再选区域，不能整体缩小后把字号补回来。节点与连线的位置、方向及归属保留；本次 Skin 明确要求样式统一时，可以对调用产生的原生对象做样式适配，按[调用接口](references/invocation.md#原生样式适配)核对文本和几何不变。关系或语义依赖的样式不能抹去，无法兼容时换表达。

发生错误先分清：参数/语义不合适、区域不足、Skill 说明缺失、运行环境故障。只修改有证据的问题后重试。禁止吞错后改成假结构并声称调用成功。保存失败与成功事件，报告实际采用的表达。新的页面组合不自动晋升核心资产。

本 Skill 在当前任务可通过显式读取使用；新建文件是否已被应用自动发现，需要另行验证，不能把手动加载说成自动触发。
