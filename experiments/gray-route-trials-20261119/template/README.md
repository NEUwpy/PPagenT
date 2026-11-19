# 路线 A · 固定语法与自适应模板

2026-11-19，PPagenT `main` 的 Markdown → 灰稿试验。代码和产物位于本目录，所读仓库基线为 `acaf72e306db0b6f16b5a50b12cf92816f00a789`，使用工作树中的现行资源。

固定语法能交付默认尺寸下的中性方案对照、带共同入口的四项服务，以及含完整长段的两组论述。四项服务缩到 1020×450 后仍通过。高密度原样和缩小正文区后的两组长论述均触发拒绝，依据是浏览器实际换行与边界。通过状态指本实验检查通过。

| 原稿与正文区 | 结果 | 可查看产物与测量 |
| --- | --- | --- |
| 两种上线方案，1170×492 | 通过。两方案按实施方式、收益、风险或代价逐行对齐，共同回退演练独占下方横带。 | [HTML](output/options.html) · [PNG](output/options.png) · [测量](evidence/options.json) |
| 园区服务支持，1170×492 | 通过。实调双排折角便签，四项说明换成 3、3、2、3 行，最少剩余 26.22px 安全文字空间。共同入口单独占 49px。 | [HTML](output/services.html) · [PNG](output/services.png) · [测量](evidence/services.json) |
| 复杂协作事项，1170×492 | 拒绝。保留四段各 250 字符，每段含原稿的五次重复。每便签换成 20 行，最长字形超出便签安全区 395.86px。 | [诊断 HTML](output/dense.html) · [诊断 PNG](output/dense.png) · [测量](evidence/dense.json) |
| 存在的不足与感悟，1170×492 | 通过。两类各用独立横带与两列正文。六项及其组内细节、2017 限定、末句全部在原位置语义下保留。正文排布高 413.22px。 | [HTML](output/hr.html) · [PNG](output/hr.png) · [测量](evidence/hr.json) |
| 园区服务支持，1020×450 | 通过。相同模板与字号重算，便签安全区最少剩余 15.83px。 | [HTML](output/services-compact.html) · [PNG](output/services-compact.png) · [测量](evidence/services-compact.json) |
| 存在的不足与感悟，1020×450 | 拒绝。原文重排后需 461.09px，最后一句字形越过正文下界 10.16px。 | [诊断 HTML](output/hr-compact.html) · [诊断 PNG](output/hr-compact.png) · [测量](evidence/hr-compact.json) |

## 语法、来源与放行

- [冻结计划](plan.mjs)由本窗口阅读原稿后写入。输入字段是页面类型、原稿段号、共同说明归属、已有标题或序数边界，以及便签图标选择。对照行标签为试验补充的比较口径。HR 两个大组为同页并置，组内各项按原顺序阅读。没有增加组间因果或把末句移为全页共同结论。
- [运行程序](run.mjs)复用 runner 的 `splitSources`，对原 MD 切出的每段逐字符验证来源范围分割与重建。HTML 文本叶带 `data-source` 和 `data-bind`，正文框带 `data-content-frame`。每案例 JSON 保存文件 SHA-256、段落表、切片索引、组件实参以及实际位置。
- 对照和并列都先实测共同说明高度，调用仓库 `composePageLayout` 的纵向卡片几何分配主体和说明带。对照主体调用 `statement-flow`，CSS 子网格共用同一行高。并列主体调用原便签资产。两组论述用 `heading-content-flow` 和固定双列文流，等数量切分组内连续项，由浏览器定换行和组高。普通文字使用仓库的兼容渲染器，整页组合 CSS 是实验目录内新增的。
- [测量程序](measure.mjs)使用本机 Chrome 157.0.8103.79，等待字体就绪，核对原文、唯一绑定、18px 字号下限、各行字形框、文字重叠、图形与文字的所属区域，以及对照行共线。默认画布 1280×720，正文左上角为 (55,166)。压缩测试只变更正文框宽高。拒绝稿保留完整 DOM 和带红线的 PNG，PNG 可见示例随裁切而缩短。
- 固定路径每页制作一个候选，带共同说明的三个案例先量一次横带。程序在冻结计划之后可离线重跑，包含独立的旧 runner 与结构能力探针。稿件分类、关系判断、标题切分锚点和图标选择来自本窗口的预先阅读。自动读任意稿选类型、语义审校、自动拆页、转换到原生 PPTX 和视觉验收均属于超出本次验证范围的能力。

## 结构与旧运行器实跑

- 服务页执行 [双排折角便签](../../../assets/结构图/双排折角便签-002/review.mjs) 的原 `renderAdaptiveMarkup`、原 CSS 和已有主题编译器。折起的纸面、卷页、影子、标题带、图标与两排同轴排列来自资产，整页无栅格截图嵌入。默认和压缩尺寸的 `resolveHtmlComponent` 均通过。默认组得到 12 个 path、8 个 shape、4 个 icon image、8 个 text 节点。该收据只到组件解析。默认图形实际只使用正文区中部约 655px 宽，说明沿用资产更省造型工作，同时保留了原构图的宽边空白。
- 便签自然入口先实跑在服务页正文主区。1170×492 根盒侵入 1170×427 主区以外，下排六个纸面相关路径也越界，尽管文字未超出整页正文。随后采用源资产自带的尺寸适配，图形进入所属槽位。高密度稿和 HR 四点组的自然入口均触发 4 项状态 52 字符容量门。对 HR 的同类四点组再以实际分组宽高 1170×252.81px 执行适配，标题折成 3–5 行，四段文字最差越过安全区 368.97px。便签的可识别造型在服务短段中成立，保留 HR 长段时承载不足。[服务首个候选](evidence/services-natural.png) · [HR 便签失败](evidence/hr-notes-adaptive.png)
- 比较资产选用之前读了 `comparison-dual-verdict-001` 的现行 guide。原设计要求取舍方向，原稿没有给总体推荐，因此直接用中性逐行对照模板。候选日志中的旧 runner 也以真实 `comparison` 关系绑定，旧选择器拒绝了用 `cards-support-band` 表达该对照。
- [旧 runner 探针](legacy.mjs)实跑原稿门、状态初始化、`validateSemanticPlan`、`measuredLayoutCandidates`、`bindLayoutSelection` 和 `validateGrayPlan`。语义校验四稿均通过。服务稿 `cards-support-band` 与 HR 的 `cards-horizontal-measured` 可绑定并通过旧计划校验，后者只是两个整组的旧分区。密集稿候选集为空。旧字号测量与版式扫描记录在各稿 `existingRunner`，都没有参与 HTML 放行。旧 `renderGrayDraft` 入口使用 PPT 引擎输出含区框的旧灰稿 PNG/PPTX，此次运行止于旧计划校验。

## 首轮与保留边界

首轮默认对照与 HR 的原文字兼容流使用 1.2 倍标题行高。Chrome 实测大字的字形顶部超出该文字盒约 2px，触发裁切。统一将相应的标题行高调至 1.36 与 1.4 倍，同时把对照单元的文字盒按自身高度垂直居中。补测图形所属槽位，纠正了只看整页正文边界而放行原尺寸便签的问题。此后保持模板、原句与字号，直接记录缩小尺寸和长文的失败。[对照初测](evidence/initial/options.json) · [HR 初测](evidence/initial/hr.json)

- 值得保留的是少量语义字段、确定的组件语法、可追踪的原文绑定，以及浏览器按所属槽位实测后放行。共用说明带和对照共用行高都有明确复用范围。折角便签可继续作为短并列项的候选，原几何设计与外部空间分配可以独立维护。
- 淘汰本组试验中的自然尺寸便签直接塞入较短主区、用便签承载 HR 的长段以及用含推荐极性的比较部件承载中性方案。原样压力试验没有去重分支，保留了溢出、裁切和潜在遮挡证据。
- 接下来需要用独立稿件对照固定语法的覆盖率、需要退回内容规划的频率及改动成本。当前的少迭代来自一个冻结语义计划和固定组件选型，无法据此估计跨稿或开放式编排的整体成本。更深层次的嵌套论证、更多正文比例、字体变化及后续原生输出还有待实测。

## 复现

在仓库根用现有 Node 和 Playwright 依赖执行。Chrome 默认取 Windows 常规安装位置，可用 `BROWSER_EXECUTABLE_PATH` 指定已有的 Chrome 或 Edge。单次执行会重建 `output/`、当前各稿在 `evidence/` 的测量及 [results.json](results.json)，保留 `evidence/initial/` 的首轮快照。

```powershell
node experiments/gray-route-trials-20261119/template/run.mjs
```

复核时从磁盘重开六份 HTML，逐段用文字叶恢复原文，并核对拒绝标记、1280×720 PNG 与便签的内联 SVG。旧布局候选与选择器的两份现有测试共 11 项通过。
