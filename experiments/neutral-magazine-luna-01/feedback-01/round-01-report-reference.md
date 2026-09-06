# 实验数据归档：round-01 交付报告

## 交付结果

本轮完成 8 页中性 Skin / 杂志风原生可编辑 PPTX，面向课题组教师与研究生，按方案讨论口径呈现四周小范围试点。最终文件为 [deck.pptx](./deck.pptx)，规范化最终化副本为 [deliverables/deck-v3.pptx](./deliverables/deck-v3.pptx)，两者 SHA-256 均为 `7f45cf65428b6e5ec8e784f8b44c025c54cef04bde463f0931992f52cb8f6ef1`。

逐页 PNG 位于 [preview/](./preview/)，HTML 总览位于 [review.html](./review.html)。

## 输入与设计取舍

实际读取并保存快照的输入只有：任务入口、`manuscript.md`、当前 generation 规则、`neutral-editorial-001` Skin 与字体配置、杂志风规则、Presentations 技能及其实施/样式/最终化文档、按需结构 Skill 与顺序结构 Skill。没有读取旧成品、实验旧 builder、前轮小样或既往研究报告；没有读取输入图片。恢复前曾对 `C:/Users/ilove/.codex/memories/MEMORY.md` 做过一次关键词检索，命中的是旧 PPagenT 交付索引；本轮没有采用其设计、内容或验证结论。最终渲染后实际读取了本轮生成的 PNG，用于逐页视觉复核。

页面职责依次为：封面、讨论框架、问题、记录单元关系、访问边界、复核流程、试点范围、评估与收束。采用纸色背景、砖红强调、炭黑正文、Noto Serif SC 展示字体与 Noto Sans SC 正文字体。第 4 页使用原生关系图，第 6 页使用原生流程图，第 7 页使用原生时间轴；没有外部图片、统计图或虚构数据。

## 实际运行的检查

- `npm run rules:load -- --profile generation --skin neutral-editorial-001`：通过。
- Artifact Tool finalizer：通过；8 页、16:9、包完整性 0 finding、第一方导入通过。
- 文字角色检查：165 个文字运行；Noto Serif SC 66 次、Noto Sans SC 99 次；通过。
- 几何检查：bullet geometry 与 heading fit 已运行；0 finding。
- 逐页渲染：最终文件 8/8 PNG 已生成至 `rendered-v3/`，并复制至 `preview/`；逐页实看并记录在 [role-geometry-check.md](./role-geometry-check.md)。
- 结构实际使用、源稿覆盖、中断与自修记录已分别保存。

Finalizer 的布局检查保留 5 条保守 warning，全部来自第 4 页关系图连接器与文字区域的可能重叠提示。逐页 PNG 复核确认线条停在节点边界外侧，未穿字；第 4 页已按关系图语义去除箭头并重新渲染。字体原生渲染是否在 PowerPoint 桌面端显示一致，当前工具未验证；结构包和 Artifact Tool 导入已验证。
