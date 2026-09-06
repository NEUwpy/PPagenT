# 35 个核心结构颜色来源盘点

本表盘点各核心组件在代表状态下的 CSS 与 markup 彩色字面量来源。源码中的历史字面量仍保留用于旧调用兼容；当 Skin 明确提供 `primaryColor` 时，它们在浏览器解析前被映射到共享离散色阶。PPA HTML 与 `resolveHtmlComponent` 均调用同一编译入口。

| Asset ID | 资产目录 | 代表状态颜色字面量数 | 新主题接管 |
| --- | --- | ---: | --- |
| argument-evidence-conclusion-001 | assets/结构图/论点证据结论-001 | 31 | 已接管 |
| branching-decision-routes-001 | assets/结构图/分支决策-001 | 28 | 已接管 |
| branching-scenario-fan-004 | assets/结构图/情景假设扇面-004 | 16 | 已接管 |
| causal-fishbone-attribution-001 | assets/结构图/鱼骨归因-001 | 11 | 已接管 |
| causal-mediator-chain-003 | assets/结构图/因果机制链-003 | 17 | 已接管 |
| comparison-dual-verdict-001 | assets/结构图/双向对比-001 | 20 | 已接管 |
| comparison-pros-cons-balance-005 | assets/结构图/优劣权衡天平-005 | 23 | 已接管 |
| containment-consensus-field-005 | assets/结构图/集合交集共识区-005 | 45 | 已接管 |
| containment-multi-set-intersection-001 | assets/结构图/多集合交集-001 | 19 | 已接管 |
| convergence-funnel-001 | assets/结构图/转化漏斗-001 | 18 | 已接管 |
| convergence-many-to-one-003 | assets/结构图/多路汇聚结果-003 | 15 | 已接管 |
| convergence-simple-funnel-001 | assets/结构图/简明转化漏斗-001 | 16 | 已接管 |
| cycle-loop-001 | assets/结构图/循环闭环-001 | 8 | 已接管 |
| cycle-racetrack-loop-005 | assets/结构图/回环轨道循环-005 | 23 | 已接管 |
| cycle-single-chain-feedback-002 | assets/结构图/单链反馈控制环-002 | 26 | 已接管 |
| goal-alignment-strategy-metrics-001 | assets/结构图/目标策略指标-001 | 21 | 已接管 |
| hierarchy-grouped-breakdown-005 | assets/结构图/分组展开结构-005 | 17 | 已接管 |
| hub-directed-outcomes-002 | assets/结构图/中心驱动成果辐射-002 | 19 | 已接管 |
| hub-radial-001 | assets/结构图/中心辐射-001 | 14 | 已接管 |
| hub-two-tier-capabilities-004 | assets/结构图/两级能力生态辐射-004 | 26 | 已接管 |
| layered-architecture-001 | assets/结构图/分层架构-001 | 13 | 已接管 |
| layered-iceberg-depth-006 | assets/结构图/冰山显隐能力层-006 | 118 | 已接管 |
| matrix-cross-grid-003 | assets/结构图/行列交叉矩阵-003 | 18 | 已接管 |
| matrix-quadrant-priority-001 | assets/结构图/矩阵象限-001 | 30 | 已接管 |
| network-internal-external-ecosystem-001 | assets/结构图/关系生态网络-001 | 33 | 已接管 |
| parallel-equal-cards-001 | assets/结构图/等权并列卡片-001 | 14 | 已接管 |
| parallel-folded-notes-grid-002 | assets/结构图/双排折角便签-002 | 11 | 已接管 |
| problem-method-result-001 | assets/结构图/问题方法结果-001 | 31 | 已接管 |
| problem-solution-outcome-001 | assets/结构图/问题方案结果-001 | 23 | 已接管 |
| progression-growth-curve-004 | assets/结构图/连续成长曲线-004 | 30 | 已接管 |
| progression-maturity-steps-002 | assets/结构图/成熟度阶梯-002 | 20 | 已接管 |
| progression-spectrum-focus-001 | assets/结构图/连续区间重点分布-001 | 16 | 已接管 |
| role-stage-collaboration-001 | assets/结构图/阶段角色协同-001 | 27 | 已接管 |
| sequence-flow-001 | assets/结构图/顺序流程-001 | 14 | 已接管 |
| sequence-phase-gates-004 | assets/结构图/阶段门禁流程-004 | 19 | 已接管 |

逐项原始颜色、蓝/紫解析树最终颜色及非主题色检查见 [output/theme-audit.json](output/theme-audit.json)。
