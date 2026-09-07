---
name: ppagent-diagrams
description: 当 PPT 页面需要项目结构库无法覆盖的技术图示时，调用 Archify 补充关系表达，再按当前 Skin 与区域适配为可编辑 PPT 对象。HTML 是 PPT 任务的中间产物；也支持用户独立要求的技术图示。
---

# 项目技术图示

先读[技能选择顺序](../../../skills/references/selection.md)。本技能为第二顺位，优先核对项目结构库是否适合；无需故意调用失败。

在项目根目录运行 `node skills/library.mjs bind archify`，读取返回的上游 Skill 与 PPagenT 接入说明。技能真源为 `skills/vendor/archify`，不要复制到个人目录或另写一套上游规则。

按任务类型读取相应 schema/example，然后真实执行 `validate`、`deliver` 和浏览器检查，保存任务证据。Node 路径由当前宿主提供。

PPT 结构选型仍读取项目 ppagent-structure。从页面需要确定图示任务，不从外部技能倒推整稿。PPT 任务须继续完成 Native 转换或忠实重建、当前 Skin 和页面区域适配，保留节点/关系到 PPT 对象的对应，并检查完整页面。HTML/SVG 不是最终 PPT，未完成此环节就报告任务未完成。
