---
name: ppagent-structure-design
description: Design, refine, or visually review PPagenT Structure Groups using only the repository's confirmed visual rules, asset contracts, HTML-first intake workflow, and existing core design language. Use for PPagenT structure-asset aesthetics and HTML approval work; do not use for ordinary presentation generation or unrelated UI design.
---

# PPagenT Structure Design

本 Skill 是 PPagenT 结构资产审美工作的执行入口，不是第二份设计规范。只使用仓库中已经确认的规则；没有明确依据时保持待确认，不自行补充新规则。

## 开始前

按任务需要读取以下现行文档：

- [方向校正](../../../docs/方向校正.md)：确认产品目标、边界和当前方向。
- [资产积累与入库工作流](../../../docs/工作流/资产积累与入库/工作流.md)：确认入库阶段、检查点和审批边界。
- [HTML Structure Group 生成系统提示词](../../../docs/工作流/资产积累与入库/HTML%20Structure%20Group生成系统提示词.md)：确认视觉意图蒸馏与 HTML 设计要求。
- [Shell 与 Logic 契约](../../../docs/Shell与Logic契约.md)：确认内容框、Region、Text Layout 与 Slot Contract。
- 设计透视箭头、道路、带状路径、平台或其他空间主体时，读取[透视形状生成法](references/perspective-geometry.md)。其中当前只有“单消失方向的直线收缩带＋直立节点”模型完成了公式化与审计；附属节点属于该模型时运行 `scripts/audit-perspective-layout.mjs`。遇到双／三消失点、俯视平台、弯曲路径、等轴测或复杂体块时，先建立对应模型，不能强套现有脚本。

以这些文档和用户当轮明确要求为准。不要复制出另一套规则，不要把历史事故逐条写成新约束，也不要擅自提高审查强度。

## 已确认的审美规则

以下是跨结构通用的视觉词汇，不记录单个组件的做法：

- **对齐**：同级元素共享明确的基线、中心线或边界线。
- **平行**：表达同一方向的边、轴和引线保持平行；方向变化必须有结构依据。
- **比例**：同类元素共享可解释的尺寸与位置比例，缩放时保持相对关系。
- **节奏**：重复元素使用一致的尺寸、间距或渐变规律；变化应连续且可预测。
- **连接**：连接线从来源边界出发并落到目标轮廓，端点、转折和箭头都与对象真实相接。
- **空间一致**：同一构图中的主体、附属元素和连接共享一个投影体系，不能各自模拟空间感。
- **文字边界**：文字服从形状和 TextRegion，保持统一对齐、内边距与可读性，不越界或压线。
- **克制与继承**：使用简洁的几何、有限色阶和必要层级，继承已审批核心资产的设计语言，保留有表达作用的细节。

## 设计与修改

1. 检查当前分支、工作区和目标 Logic，识别已存在的 Structure Group。
2. 先判断新表达是否与已有结构重复，以及能否通过已有结构扩散覆盖；目标是尽可能少的重叠、尽可能多的覆盖。
3. 读取目标资产的 `visual-intent.md`。视觉意图只能来自已确认要求、参考材料和已有核心资产，不补写未经确认的审美结论。
4. 从少量最接近的已审批核心资产中继承当前设计语言，不从外部风格重新起稿。
5. 在资产现有 `review.mjs`、共享样式和运行时体系内实现 HTML 黄金态，再由同一数据契约扩散代表性状态；拓扑型资产同时改变节点数量和关系，不能只对默认关系增减节点。
6. 使用现有 TextRegion、Text Layout 和 Slot Contract 表达可编辑内容。保留已经确认且有意义的视觉细节，不为方便编译而删除。

## 审查

1. 在 PPA 看板查看实际渲染结果，不只阅读源码。
2. 至少检查黄金态以及较少、较多两类代表性状态；检查重点以现行文档为准。
3. 若 HTML 与 Native/PPT 不一致，修正共享组件、几何或编译链，不在最终 PPT 上临时补丁。
4. 未经用户确认，停在 HTML 待审批阶段；确认后再生成 Native/PPT、登记审批并晋升核心资产。

## 验证边界

- 待审批前只做语法检查、代表性状态渲染和实际视觉查看。
- 晋升时再执行 Slot Contract、相关定向测试和资产审计。
- 不增加 SHA256、全状态笛卡尔积、重复视觉循环或无关重构。
- 用户已确认的结果不重新制作；只修复明确指出的问题和能举一反三的系统原因。

## 交付说明

明确区分：HTML 待审批、用户已确认、已生成 Native/PPT、已晋升核心、已接入正式调用。不要把其中一个阶段描述成另一个阶段。
