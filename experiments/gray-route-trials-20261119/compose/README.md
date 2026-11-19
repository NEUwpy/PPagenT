# 路线 B｜语义计划、组件能力和有限候选实测

2026-11-19，PPagenT `main` 灰稿试验。四份仓库原稿直接读取，人力稿另跑窄区。终轮测量 **53 个候选，16 个满足本机 HTML 检查**，选出四页。另有一份单页拒绝。默认画布 1280×720，正文区 `(55,166,1170,492)`，下限 18 CSS px。窄区为 `(55,166,1020,450)`。

| 原稿 | 终轮通过 / 实测 | 结果和选用依据 | 产物 |
| --- | ---: | --- | --- |
| 两种上线方案 | 4/4 | 等宽双栏，正文 22 px，两个方案的描述及得失行对齐；共同前置条件占独立底带。单栏也能容纳，但降低横向对照便利。 | [HTML](output/options.html) · [PNG](output/options.png) · [候选](output/options.candidates.json) · [几何](output/options.geometry.json) |
| 园区服务支持 | 4/6 | 真实等权卡片，单行四卡，组件区高 276 px，正文 20 px；共同入口仍在组件区外。228 px 版文字裁切，328 px 版可用但占高更多。 | [HTML](output/services.html) · [PNG](output/services.png) · [候选](output/services.candidates.json) · [几何](output/services.geometry.json) |
| 复杂协作事项 | 0/7 | 按原稿保留每项五次重复。最接近的是 18 px 四栏文本，连共同记录要求一共需要 507.64 px，超出 15.64 px。原样单页拒绝。 | [失败 HTML](output/dense-diagnostic.html) · [失败 PNG](output/dense-diagnostic.png) · [候选](output/dense.candidates.json) · [来源及关系](output/dense.geometry.json) |
| 不足与感悟，标准区 | 7/18 | 原多路汇聚图进入第一点不足。左列 527 px、右列 619 px、列距 24 px。图高 232 px，右列决定整页用高 481.72 px。 | [HTML](output/hr.html) · [PNG](output/hr.png) · [候选](output/hr.candidates.json) · [几何](output/hr.geometry.json) |
| 不足与感悟，窄区 | 1/18 | 同一计划选用纯文字双栏，左 359 px、右 637 px，使用紧凑行距；18 px，正文区剩 2.14 px。本机可读，换字体或交给 PPT 时需重新核查。 | [HTML](output/hr-narrow.html) · [PNG](output/hr-narrow.png) · [候选](output/hr-narrow.candidates.json) · [几何](output/hr-narrow.geometry.json) |

## 怎样选中

[冻结计划](plans.mjs)由本次试验编写，规定分组、关系、阅读顺序和原文切分锚点。程序调用已有 `buildSourceBlocks` 读取 Markdown，每个片段保留源文件哈希、源块 ID 和 UTF-16 源字符区间。HTML 逐片段标记 `data-bind`、`data-source`。输入与输出按绑定顺序重组逐块相同。人力稿的两组是独立并列，汇聚只发生在第一点不足内部；2017 年的完整限定、第四点感悟末句均保留。压力稿的重复及共同要求全部保留，失败示意也保留全文。

[组件能力和适配](components.mjs)声明关系类型、数量、槽位、来源和形态边界。[运行程序](run.mjs)按这些声明筛选有界候选，枚举 CSS 分配和已声明的组件宽高档。浏览器使用真实内容，测量文字行盒、裁切、分区、原设计关键几何和整页剩余高度；硬检查包括来源覆盖、18 px 下限、文字和分区边界、不同文字流互叠及图示锚点。图示合格需同时满足图内与外部各组约束。之后按冻结的表达优先级、字号、剩余高度和较小组件的偏好排序；优先级为试验设定，本轮没有生成或学习语义判断。每个候选记录是否测量、得分、失败项或落选原因。通过的 HTML 结果可以无人工重跑，计划外文稿仍需自己的语义计划及适用组件。

## 真实资产、内部容量和整页反馈

**等权并列卡片。** 直接使用 `等权并列卡片-001/review.mjs` 及 `component.css`，保留四个完整双层卡面、圆形锚点、统一标题／正文层级和同级无连接的关系。服务图标经原组件调用 Tabler 内联 SVG。局部 CSS 将整排位置、卡高和内部标题与正文区改为可分配尺寸。固定原版占了 492 px，附带共同入口后超出 66.39 px，不能进入本页。短版虽给底带留出空间，正文在组件内部最多裁切 39.38 px；终轮 276 px 档通过。两栏和四栏普通文字在候选中保留回退。[原尺寸诊断](output/services-diagnostic.png)

**多路汇聚结果。** 从 `多路汇聚结果-003/review.mjs` 生成任务本地副本，沿用原路径公式、输入和结果 markup、TextRegion 和主题编译；调整槽位长度校验以容纳源文短句，输入宽高随分区及三节点间距联动，CSS 消费原几何变量。原造型仍是三个独立输入框、粗贝塞尔曲线及唯一结果，三条边距实际锚点最大误差 0.02 px。527×232 px 下图内输入框约 237×64 px，间隔 8 px，最长原句两行；同宽 196 px 容不下节点实文，260 px 也能通过但整体剩余更少。旁列收窄到 550 px 时，即使图内成立，感悟溢出 13.11 px；再将图列加到 653 px，感悟溢出 36.50 px。1020×450 px 时，九个适配图候选均未通过，程序选用同一内容计划的无图版本。[原 CSS 几何诊断](output/hr-diagnostic.png) · [窄区测量](output/hr-narrow.candidates.json)

## 首轮和一次修订

[首轮清单](output/initial-results.json)保留 49 个候选。首轮没有人力稿通过，主要问题是输入框过高导致间隔不足、比例分配后最长节点需三行、邻列超高；另外，组标题的字体度量越过上沿。服务稿首轮只能采用文字回退，两个舒展卡片尺寸的第一行仍有 1 px 裁切。终轮按整数高度预算保留汇聚节点间隔、为节点增加可用宽度、补齐标题行高及卡片内边距，并为两独立组加两档紧凑文字分配。复核同段 `Range` 的相邻绑定片段时采用共同文字流的排版边界，跨独立文字流仍做重叠检查。两方案使用共享网格轨道对齐比较行。没有逐稿删字或修坐标。

## 交接和判断

`*.geometry.json` 有输入哈希、绑定、角色、关系、组件 ID 和版本、布局与 CSS 像素坐标、文字样式和行盒、组件原生标记下的几何、矢量路径及连线端点。`verify.mjs` 重开落盘 HTML，检查实际正文区、来源逐字对应、字号下限和 PNG 尺寸。四个通过案例均核对过渲染图。输出是这次试验可校验的结构化交接，当前项目的共享灰稿编译器及 PPTX 消费尚未接通至本格式；HTML 与 PPT 的文字度量和造型保真仍待验证。

值得保留的是独立于语义规划的能力声明、真实文字测量、整页与图内联动、有限候选和可解释回退。应淘汰本次无法随区域工作的固定尺寸调用。18 px 四栏压力稿与原 CSS 汇聚诊断作为失败对照保留。后续产品试验需检查计划外自然稿、组件适配维护成本、不同主题下的富余量、失败分页与原生交接。此次没有调用模型 API、晋升资产或改动生产文件。

## 复跑

从仓库根目录运行，依赖仓库已有 Node 包和本机 Chrome/Edge。可用 `BROWSER_EXECUTABLE_PATH` 显式指定浏览器。

```powershell
node experiments/gray-route-trials-20261119/compose/run.mjs --initial
node experiments/gray-route-trials-20261119/compose/run.mjs
node experiments/gray-route-trials-20261119/compose/verify.mjs
```

[统一结果清单](results.json)提供主窗口读取所需的案例状态、相对路径、候选数、诊断和回退。
