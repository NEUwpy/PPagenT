---
name: ppagent-structure
description: 为 PPT 关系表达检索项目结构 Skill，提取已有结构的视觉特征与关系语法，按内容、区域及 Skin 适配重建，复用设计方法并执行本页原生构建。保留结构辨识度，支持多参考组合。
---

# PPagenT 自适应结构 Skill 库

结构库提供可迁移的表达方法、视觉特征、来源和可复用实现。按本页内容选择结构，再按本页区域构建原生图形和文字；不再填入旧槽位。结构跨 Skin 复用，Layout 组织本页文字、媒体和结构。

## 渐进检索

在仓库根运行 `node .codex/skills/ppagent-structure/scripts/catalog.mjs list`，再用 `list --logic <logicId>` 筛选。流程可读[顺序结构](skills/ppagent-structure-sequence/SKILL.md)，比较可读[比较结构](skills/ppagent-structure-comparison/SKILL.md)。普通文字无需强行图示。

对候选执行 `guide <assetId>`（`reference` 为兼容别名），获取真实语义、视觉意图、固定／可变项和实现路径。按需要查看源码与预览，不一次读取全库。说明缺失时查看原实现和来源，不凭名称猜造型，也不把未提炼项说成已确认特征。

## 先保留特征，再适配

从来源证据识别两类边界：

- 内容关系：顺序、归属、极性、条件与事实；不为套图更改。
- 视觉识别特征：使该结构区别于普通框图的轮廓、层次、连接、对齐和节奏。挑明本次采用哪些特征；不能只引用名称却将所有设计抹平成普通卡片。

原 visual-intent 和 componentModel 是设计证据，可能同时包含旧 Skin 颜色和原实现数量限制；不要将这些统统升级为新表达的硬约束。色彩、字号、尺寸、间距、文字内外分工按本次 Skin 和区域调整。数量、朝向和布局可变化，但要重算几何并保持所采用的特征可辨识。具体见[适配与多参考组合](references/reference-use.md)。

## 原生执行

按[构建接口](references/invocation.md)，给 invokeStructure 传入采用的 references、稿件 content、本页 targetFrame 和 build 函数。build 直接创建可编辑形状、文字与连接；执行器不加载原 Mapper、固定文字框、数量上限或缩放契约。

沿用一个参考的特征属于 adapted；组合多个参考的局部方法属于 composed。源码只作造型与几何参考，按本次内容重算位置和文字尺寸。项目结构缺少合适表达方法时，按[技能选择顺序](../../../skills/references/selection.md)转用图示／图表技能或自主编排。

## 输出和检查

简记来源资产、保留特征、适配变化、执行方式和未解决问题。原生构建事件由 invokeStructure 记录；success 只表示构建产生了对象，不代表视觉验收通过。新组合只写入本次产物，不自动晋升核心。

在最终 PPTX 中检查可编辑性、语义字号、文字边界、连线端点、重叠和关系方向；渲染实际页面，对照参考检查保留特征及整页效果。适配后的结果单独验证，样例预览及原资产审批不代表新表达已通过。发现问题后修正并重新渲染。

本 Skill 供独立制作入口显式加载；正式生产线及 Harness 的自动适配迁移需另行验证。