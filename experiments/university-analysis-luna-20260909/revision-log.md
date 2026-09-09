# 修订记录

## 首版

- 输出：`.build/university-analysis-luna-high-draft-01.pptx`
- 渲染：`render-first-01/slide-01.png` 至 `slide-03.png`
- 结果：三页模板身份、标题带、正文安全区和核心条件均可读；P1 右侧递进关系、P2 四类记录与三关口、P3 阶梯与三项边界均成形。

## 修订 02

- 新增 P3 底部可见条件：“达到可复用前不宣称跨项目可推广。”
- 原因：首版视觉检查发现该关键限制仅在分析记录中，正文页面没有直接可见表达，不能视为覆盖。
- 输出：`university-analysis-luna-high-revision-02.pptx`
- 渲染：`render-revised-02/slide-01.png` 至 `slide-03.png`

## 修订 03（父级视觉反馈后）

- P1 改为“核对项—需要的依据—缺失动作”主表达，三类来源压缩为一行说明；阶段证据改为清晰三项递进，移除底部规则条，并把页面标题改为“准入核对与证据推进”以避免把可追溯误读为准入资格。
- P2 改为四行证据清单，右侧将三道关口、责任确认、复核结论、补齐再提交和分歧保留异常组织在同一责任区，移除四卡片加三卡片加底条骨架。
- P3 三项边界保持等权浅底，保留成熟度阶梯，并就近写出“达到可复用前不宣称跨项目可推广”。
- 输出：`university-analysis-luna-high-revision-03.pptx`
- 渲染：`render-revised-03/slide-01.png` 至 `slide-03.png`

## 修订 04（最终局部修订）

- P1 页面标题改为“准入先核对，推进看证据，开放再逐步扩大”，避免把可追溯误读为准入资格。
- P2 将“意见不一致：保留异常状态并提交协调”提升为 18px 两行正文，并上移到右侧责任区内，保留安全区边界。
- 输出：`university-analysis-luna-high-revision-04.pptx`
- 渲染：`render-revised-04/slide-01.png` 至 `slide-03.png`
- 父级视觉意见在 revision-03 后已完成这两项局部修订，本轮不再扩展结构范围。

## 工具与失败记录

- `progression-maturity-steps-002`：实际调用成功，日志见 `structure-calls.jsonl`。
- `sequence-phase-gates-004`：未调用。其 guide 标记为 `documented-not-implemented`，当前大学入口要求保留造型实现，不能把未登记结构当成已完成调用。
- Lieflat Charts：未调用。稿件没有数值、单位或比较口径，制造数据图会改变事实边界。
- Archify：未调用。三页关系均可由模板内原生文字、线条、形状及已验证阶梯表达，未增加技术图示价值。
- 首次最终化遇到两项工具配置问题：模板的既有 `汉仪粗宋简` 未列入 font policy，以及 first-party import 缺少 `RUNTIME_NODE_MODULES`。已修正脚本环境和字体声明后重新最终化通过。私有验证回执在仓库根 `.build-validation/`，不作为交付文件。
