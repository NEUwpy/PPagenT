# 纯内容 → 表达选择

2026-11-20。四份人工组织的单页内容，用同一独立灰稿编译器实测。**值得继续验证小规模候选枚举，结合独立的内容校对和浏览器容量检查。** 本轮能排出同文异形，规则分数仍不足以代替整页目检。

[四份纯内容和字段约定](inputs/README.md) · [Schema](content.schema.json) · [运行入口](run.mjs)

| 实测页 | A · 按关系与组件容量门槛直选 | B · 测量多个表达后选择 | 本页判断 |
| --- | --- | --- | --- |
| 不足与感悟 · 1280 × 720 | 汇聚图、四项短条、BLM 步骤图。 [预览](output/hr-standard/landing-convergence--compliance-short-facts--alignment-sequence/compile/gray.png) | 8 种均过检查，规则最高分只画汇聚。 [规则首选](output/hr-standard/landing-convergence/compile/gray.png) · [全实文](output/hr-standard/text/compile/gray.png) | 三因同果值得画。BLM 的局部先后一句读得清。规则低估了对照短条的价值，首选把「协同」断在两行，目检更倾向保留短条。 [目检偏好](output/hr-standard/landing-convergence--compliance-short-facts/compile/gray.png) |
| 同页 · 900 × 640 | 原组合超容，回退文字。 [拒绝图](output/hr-900x640/landing-convergence--compliance-short-facts--alignment-sequence/compile/rejected.png) · [回退结果](output/hr-900x640/text/compile/gray.png) | 含汇聚的 4 种均超容。剩余 4 种中，三步横排的 BLM 候选得分最高，因使用常规密度。 [入选结果](output/hr-900x640/alignment-sequence/compile/gray.png) | 汇聚在窄幅改用文字仍能明示共因。BLM 图能放下，是否需要占据额外注意力仍是讲述选择。 |
| 两种上线方案 | 双栏比较。 [预览](output/options-1280x720/comparison-comparison/compile/gray.png) | 双栏胜出，纵列实文也通过。 [纵列预览](output/options-1280x720/text/compile/gray.png) | 双栏方便就近对照，回退演练横跨两方案；段内的过渡期、风险和代价仍须逐段阅读。 |
| 汛期值班 | 文本分组。 [预览](output/duty-1280x720/text/compile/gray.png) | 同 A；关系条件排除组间箭头。 | 保留「或」「无论级别」、时限和全页适用期。各类险情有各自动作，箭头会误导为升级步骤。 |
| 办公用品采购 · 留出例 | 金额条件用文字，给应急采购画两步。 [预览](output/procurement-checked/emergency-procedure-sequence/compile/gray.png) | 实文首选；应急顺序以文字陈述。 [预览](output/procurement-checked/text/compile/gray.png) | 数额递增只是条件的排列。真实先后只在应急采购里，两步正文已够；留档要求适用整页。 |

## 验证范围

- **表达与测量。** A 按关系、节点数量及文字槽门槛选取可绑定组件，整页不合格则试文字。B 枚举同一批受支持的表达和文字替代，先由旧编译器实际排字、测量，再按主旨证据关联、图形数量、密度及短末行打分。两法共用重复候选的测量。在汇聚候选中实跑库内 `convergence-many-to-one-003`，其余使用原编译器的文字、对照、短条和顺序呈现。两法都是手写规则，未调用小模型、判断模型或 JEV。
- **内容约束。** 三份开发样本对旧输入逐项核对了 35、8、20 个带来源的文字字段、备注和限定。适配后对照浏览器实测文字、端点与限定对象再检查。正文合写时，`projection.json` 保留原字段的字符区间及来源。倒放 BLM 箭头、串起险情或金额条件、漏掉回退演练或采购留档，共 5 个故意注入的反例，编译均通过，内容审查均拒绝。 [倒序](output/hr-standard/probe-reverse-sequence/compile/gray.png) · [误连条件](output/procurement-checked/probe-cases-as-sequence/compile/gray.png) · [漏共同条件](output/options-1280x720/probe-drop-scope/compile/gray.png)
- **仍需强模型或人工。** 采购首版在从原文组织实文时漏了「可」，引文能定位且自动检查通过。对照原稿后补回许可措辞，并用同一排序规则重跑。来源能否推出改写、条件会否被图形暗示为必然先后、局部图示是否抢了整页重点，都需要另审。金额临界值沿用原稿措辞。三份开发例用于形成规则，采购仅是同一实验者标注的一份留出检验；本轮没有验证自动组织稿件、跨稿视觉质量或 PowerPoint 交接。 [采购首版](output/procurement-1280x720/text/compile/gray.png) · [修订版](output/procurement-checked/text/compile/gray.png)

## 复跑

在仓库根目录，使用原编译器所需的 Node、项目依赖和本机 Chromium。

```powershell
$trial = 'experiments/content-to-expression-20261120'
node $trial/run.mjs $trial/inputs/hr.json --out $trial/output/hr-standard --probe reverse-sequence
node $trial/run.mjs $trial/inputs/hr.json --width 900 --height 640
node $trial/run.mjs $trial/inputs/options.json --probe drop-scope
node $trial/run.mjs $trial/inputs/duty.json --probe cases-as-sequence
node $trial/run.mjs $trial/inputs/procurement.json --out $trial/output/procurement-checked --probe cases-as-sequence --probe drop-scope
```

每次运行保留输入计划、浏览器报告、HTML/PNG 和内容审查结果。各 `summary.json` 记录候选排序、拒绝原因和编译器的完整参数。 [人力标准幅](output/hr-standard/summary.json) · [人力窄幅](output/hr-900x640/summary.json) · [上线](output/options-1280x720/summary.json) · [汛期](output/duty-1280x720/summary.json) · [采购](output/procurement-checked/summary.json)
