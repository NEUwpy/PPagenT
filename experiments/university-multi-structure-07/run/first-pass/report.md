# university-multi-structure-07 运行报告

## 任务与输入

- 任务标识：`university-multi-structure-07`
- 实际配置：`gpt-5.6-luna` / `high`
- Skin：`northeastern-university-001`
- 排版体系：麦肯锡式
- 原稿：`experiments/university-multi-structure-07/manuscript.md`
- 页面：6 页，封面、单页三章目录、三张观点正文、尾页
- 输出：`deck.pptx`；最终重导入预览在 `renders/slide-1.png` 至 `renders/slide-6.png`

本轮重新运行了 `npm run rules:load -- --profile generation --skin northeastern-university-001`，快照见 `rules-snapshot.md`。页面先通过 `createNortheasternUniversityStarter`，正文结构只通过 `invokeUniversityStructure` 调用，未改规则、结构库或 Git。

## 逐页核对

| 页码 | 实际观点标题／职责 | 证据与阅读顺序 | 原稿保留核对 | 结构来源与次数 |
|---|---|---|---|---|
| 1 | 共享实验平台试点（封面） | 标题 → “先验证记录能力，再小步扩大开放” → 受众与方案讨论稿 | 保留试点性质、先验证再扩围的目的与受众 | 0 次；现行东北大学封面模板 |
| 2 | 目录（导航） | 01 准入与推进 → 02 记录与处置 → 03 能力与扩围 | 三章均来自原稿三段正文，未增加章节 | 0 次；现行蓝带分栏目录 |
| 3 | 先筛项目，再按证据逐级扩大开放 | 左：课题自荐／平台推荐／合作项目进入筛选；中间：资格核对 → 责任确认 → 记录准备；右：可记录 → 可追溯 → 可复用；底部补充“前一级证据具备才进入下一阶段” | 保留三类申请来源、三项筛选条件、三阶能力推进及“筛选决定进入、阶梯决定推进”的关系 | 2 次成功：`convergence-simple-funnel-001`、`progression-maturity-steps-002` |
| 4 | 完整记录与分级处置，守住异常责任归属 | 左：四类并列记录；右：记录完整 → 责任明确 → 复核通过；底部：课题负责人确认事实、平台管理者复核结论，意见不一致保留异常 | 四类记录字段、三道异常关口、双角色责任和“已记录不等于已解决”均保留 | 2 次尝试，1 次成功：`convergence-simple-funnel-001`；1 次失败：`parallel-folded-notes-grid-002` |
| 5 | 扩围以能力达标为门槛，并保留暂停条件 | 左：可记录 → 可追溯 → 可复用；右：人员／资源／方法／证据边界；底部：任一边界不足即暂停，保留规模并补齐任务 | 三阶能力、三项扩围边界、暂停条件及不预设数量／时间／收益指标均保留；“证据”是原稿“先检查证据是否达到门槛”的显式拆分 | 2 次尝试，1 次成功：`progression-maturity-steps-002`；1 次失败：`parallel-folded-notes-grid-002` |
| 6 | 请讨论并确认准入条件、异常复核责任及扩围门槛（收束） | 讨论请求 → 三个确认对象 | 保留原稿收束句 | 0 次；现行东北大学尾页模板 |

## 结构、尺寸与字号

- 画布：`1280 × 720` 设计像素，比例 `13.333 × 7.5 in`。
- 正文安全区：`left=55, top=166, width=1170, height=492`。
- 每次双结构尝试使用左右两个 `560 × 300` 区域：左 `x=55`，右 `x=665`，`y=180`；底部图外说明占 `1170 × 112`，`y=520`。
- 正文页标题按 Skin 的 `pageTypographyPx.title=32`；结构入口读取大学 Skin，一次换算结构字号为 `componentHeading/componentTitle/componentItemTitle=15.75pt`、`componentLead/componentBody/componentLabel=13.5pt`、`componentMeta=10.5pt`，未二次乘 0.75。
- 图外说明按统一角色使用标题／标签／正文档位 `21/18/16/14`；最终渲染中正文与标签保持完整可读，未以缩小字号绕过结构容量。
- 结构保留特征：漏斗的曲面圆台、逐级收窄和随形导流箭头；阶梯的踏面、立面、单一消失点和随透视承托面。失败的折角便签没有被自画卡片替代，失败区改用原生文字补回原稿信息。

## 失败尝试与限制

1. 初次调用把页面 `items/structuredData` 直接传给漏斗，入口按 guide 契约要求 `inputs/steps`，失败后已改为原生字段并成功。
2. 漏斗在半页区域的文字入口无法容纳，保留入口语义但改用 `user-check/building/heart-handshake` 图标，三类来源移到图外说明；结构随后成功。
3. `parallel-folded-notes-grid-002` 在 `560 × 300` 区域内，即使将标题缩至“来源／审批／结果／异常”及“人员／资源／方法／证据”，仍因固定标题槽垂直容量失败。未降字号、未用普通卡片冒充便签调用。失败事件见 `final-structure-events.jsonl`，完整重试历史见 `structure-events.jsonl`。

因此，正文二和正文三各有一次真实结构调用失败；最终 PPTX 不含失败调用的残留结构对象，失败区使用可编辑普通文字保留内容。若验收门槛要求每个正文页两次成功结构调用，本轮只能标记为候选，限制来自当前六页安全区与结构固定比例的组合容量。

## 验证结果

- 最终 `deck.pptx` 已重新导入并渲染六页 PNG。
- `slides_test.py`：通过，`No overflow detected`。
- 逐页检查：封面与尾页标题、目录三列、正文三页标题带、结构／文字阅读顺序、图外说明、文字换行与页底边界均已查看；发现并修正正文页 section label 与标题带重叠，以及结构失败后的空白区域。
- 最终对象保持原生可编辑：模板文字、图形、结构路径、结构文字、图外文字均为独立 PPT 对象；没有用整页截图交付。
- 本报告与快照、日志、PNG、PPTX 均位于指定 `run/` 目录。
