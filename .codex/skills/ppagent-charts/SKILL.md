---
name: ppagent-charts
description: 当 PPagenT 的 PPT 页面需要数值比较、趋势、构成或分布图，且项目结构库缺少合适数据编码时，调用 Lieflat Charts 模板并按当前 Skin 适配成可编辑 PPT 图形。当前上游仅有非商业许可。
---

# 项目数据图表

先读[技能选择规则](../../../skills/references/selection.md)。用户明确指定图表技能时遵循本次要求；否则保留项目结构第一顺位。

在项目根运行 `node skills/library.mjs bind lieflat-charts`，读取上游 Skill 和项目接入说明。按数据形状检查 catalog 与真实 gallery 模板，记录候选理由、选中编号和源代码位置。

核对数据单位、总量、分母、零基线与视觉比例。模拟数据明确标注，不能借用模板示例作为事实。按当前 Skin 和页面区域重排，保持所选模板的核心数据编码。

PPT 任务继续完成原生可编辑图形、数据映射与最终页面渲染。上游 HTML 是中间产物；原生形状重建如实标记 adapted-native，不称通用转换器或带数据表的 Office chart。许可与执行边界见 bind 返回的接入说明。
