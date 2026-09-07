# 第二轮结构检索与采用

本轮沿用首轮对内容关系的检索结论，并按反馈把局部结构转成可检查的分析展板。

- `comparison-dual-verdict-001` 的逐项对照语义用于第 2 页，但原稿条件和说明超过其短条容量，因此改为自绘四行共享维度表。
- `sequence-flow-001` 不能表达第 3 页授权分支；`sequence-phase-gates-004` 的短阶段/门禁容量也不足。第 3 页采用其“阶段推进与门禁”语义，自绘四列角色—交付物—完成条件展板。
- 第 1 页是五项共同解释关系，采用中心节点与五个真实连接器；第 4 页保留时间轴与决策门，仍由原生形状表达。

实际执行：没有 `invokeStructure` 直接调用，没有把候选示例事实带入页面；所有最终对象均由 artifact-tool 原生 API 创建。第 1 页连接器使用 `slide.shapes.connect`，authoring ledger 记录五个 connector ID 及 `fromSide/toSide`；第 2/3/4 页使用可核对位置的原生线与箭头。
