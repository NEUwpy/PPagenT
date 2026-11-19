# 路线 C：按稿件编制整页 HTML

三份默认稿和服务页的窄区复跑通过灰稿测量与交接字段检查。高密度稿的原文在单页四格中实测溢出。方案页另保留自由 CSS 的交接失配，人力资源页保留两次真实资产试排和最终的长文编排。基线 `acaf72e306db0b6f16b5a50b12cf92816f00a789`，沿用当前工作区的运行时和资产版本。[机器回执](results.json)

| 试排 | 灰稿与交接结果 | 产物 |
| --- | --- | --- |
| 两种上线方案 | 原等权卡片承载两个无推荐倾向的方案，下面共用回退条件。正文最低 19 px。交接树通过所测字段检查 | [HTML](outputs/options.html) · [PNG](outputs/options.png) · [来源与测量](evidence/options.json) · [交接](evidence/options-handoff.json) |
| 方案页自由 CSS | 页面测量通过。下方条件板的 `clip-path` 在浏览器形成斜角，编译输出为矩形 | [HTML](outputs/options-free.html) · [PNG](outputs/options-free.png) · [失配对象](evidence/options-free-handoff.json) |
| 园区服务支持 | 原折角便签完整承载四项服务，右侧独立显示共同入口。正文最低 19 px。交接树含 12 条纸面、卷角和投影路径 | [HTML](outputs/services.html) · [PNG](outputs/services.png) · [来源与测量](evidence/services.json) · [交接](evidence/services-handoff.json) |
| 园区服务窄区 | 仅将正文区从 1170×492 改为 1020×450。便签区从 888×492 改为 738×450，四项正文行数仍是 3、3、2、3 | [HTML](outputs/services-narrow.html) · [PNG](outputs/services-narrow.png) · [来源与测量](evidence/services-narrow.json) · [交接](evidence/services-narrow-handoff.json) |
| 高密度原稿 | 四段各保留五次原句，完整重建 1040 字符。18 px 下每段九行，四格有九项边界或重叠诊断，本候选拒绝 | [失败 HTML](outputs/dense.html) · [失败 PNG](outputs/dense.png) · [来源与测量](evidence/dense.json) |
| 不足与感悟套便签 | 右栏 715×438 的自适应调用发生 19 项诊断。四条标题触及裁切，第一及第四条正文分别 9、10 行 | [失败 HTML](outputs/hr-notes.html) · [失败 PNG](outputs/hr-notes.png) · [来源与测量](evidence/hr-notes.json) |
| 不足与感悟长文 | 以两组并列文字表达各自内部条目，原文 564 字符完整，包含 2017 限定和末句。正文最低 18.75 px。交接树通过所测字段检查 | [HTML](outputs/hr.html) · [PNG](outputs/hr.png) · [来源与测量](evidence/hr.json) · [交接](evidence/hr-handoff.json) |

## 冻结的页面设计与复跑成本

[pages.mjs](pages.mjs) 是本窗口模型离线编制的绑定与布局计划，[pages.css](pages.css) 是页级排版和局部组件尺寸调整。[run.mjs](run.mjs) 重放 Markdown 读取、原文绑定、原资产调用、渲染、检查和交接投影。换稿时仍需判断段落归属、关系、组件、尺寸和允许的变体。

| 稿件 | 本窗口给定的页面设计 | 改尺寸与换稿 |
| --- | --- | --- |
| 上线方案 | 两个等权卡片、两个图标、同宽共同条件板、卡片内部四处纵向位置配置、一个条件板路径 | 卡宽随正文变化，卡高及条件板纵向配置固定。本页换尺寸未验证。相同段落结构可重读文本，改成三方案、有明确推荐或正文更长时，需重判布局、共用条件和槽位容量 |
| 园区服务 | 四个服务图标、左侧原资产、右侧 258 px 入口提示栏、24 px 栏距 | 1020×450 复跑增加零条 CSS、零个绑定、零个图标。便签位置和大小由原资产重新计算，入口栏由 CSS Grid 定位。换稿且服务数量或角色变化时，需重判图标、共同入口和容量 |
| 高密度稿 | 四格两行各 211 px、原文标题与正文分槽、一条共同要求 | 首次候选拒绝，重复段全部保留。本轮只测了该四格单页配置 |
| 不足与感悟 | 两个分组、六个条目起点、40 px 栏距、两栏宽配比，条目标题后原文换块 | 条目起点按本稿词串冻结，原文句首改变会触发错误。换话题时需重新确定分组和切分。普通文本内部可随栏宽换行，另外的画布尺寸未测 |

等权卡片直接执行 `等权并列卡片-001/review.mjs` 的 `renderMarkup`，局部 CSS 改网格和文字槽位置，保留圆形视觉锚点、整卡轮廓和等权层级。服务页执行 `双排折角便签-002/review.mjs` 的 `renderAdaptiveMarkup`，保留同轴的双排阵列、带图标的通栏标题和三层纸面。资产 JS、CSS 和 manifest 的 SHA-256 及调用参数见各页证据。原稿通过仓库 `buildSourceBlocks` 处理，复原比较以原稿的非空段落为单位，空白分段符由布局表达。

## 首轮问题与一次调整

- 方案页的 CSS 五边形在原生树中仍是 `geometry: rect`，编译器成功返回对象时没有提示缺角丢失。改为同区的显式 `data-ppt-kind="path"` 后，交接树保留闭合的斜角轮廓，文字框继续独立交接。两版底板的测量框同为 x125、y543、1030×82，两张浏览器 PNG 仅在斜角边缘相差 3 个像素。现有编译器对路径采样产生折线点，精确路径命令仍需另行验证。[初版投影](evidence/options-free-handoff.json) · [调整版投影](evidence/options-handoff.json)
- 人力资源的两类内容按并列处理。自然接口中，感悟的首张便签有 13 字标题与 99 字正文，超过 4 项状态总计 52 字的上限。长文论述柱首项标题为 12 字，超过上限 10 字。第二点还需要在保留 2017 限定的条件下重新切出适合其引导句槽的完整短语。本轮保留这两次拒绝。[自然接口实跑](evidence/asset-gates.json)
- 自适应便签首轮的宽度 724 px 超过右栏 697.53 px。第二轮把右栏加宽到 715.20 px，并让便签框取该栏可用宽度 715 px。组件边界通过后，长标题和长正文仍裁切。最终长文页使用这一栏宽配比，第四点由四行减为三行，末句完整可见。第二点末行仍仅有“效。”，属于排版瑕疵。[首轮保留](evidence/first-run/) · [便签调整后](evidence/hr-notes.json) · [长文版](evidence/hr.json)
- 高密度稿四段正文均超过各自 211 px 的格子。下排最后一行的行框底部为 674.875，超过正文底边 658，左侧正文还与共同要求相交。保留余量诊断和失败图，交接检查在测量失败时停止。[高密度测量](evidence/dense.json)

## 交接所测范围

同一候选先由 Chromium 独立测量，再交给仓库 `resolveHtmlComponent`。检查全部文字叶子的来源、顺序和精确复原，浏览器行框和部分祖先裁切，正文 18 px 下限、组件边界、文字相交，以及交接树中的对象覆盖、文字尺寸和位置。源中无段内硬换行，交接树中部分文字带有按浏览器换行位置写入的 `\n`。只有逐行等同浏览器结果且拼回原文完全一致才通过，保留在 `materializedSoftWraps` 中。首轮把这类编码差异统计为文本变化，后续增加了按字测量视觉行序的检查。[首轮回执](evidence/first-run/results.json)

交接树提供原生形状、路径、文字与独立 SVG 图标媒体，来源跨度由本实验的结果文件补齐。图标进入交接树为 `image`，内部笔画尚无原生形状级编辑性证据。编译阶段的截图是编译器浏览器 DOM，实际 PowerPoint 换行、字面基线、填充、阴影和原生重渲染一致性仍待成品验证。通过状态对应上述实验门槛。

可保留模型按页决定组合的空间，以及库组件尺寸变化后重新测量的做法。交接应对正文流和绘制图元明确约束，形状声明须携带实际轮廓，编译器应在遇到未覆盖的 CSS 视觉效果时给出诊断。图元的 PPT 路径误差、文本框间距与字面换行、陌生稿件的选型次数和作者改动量，仍需在少量不同稿上对照实测。

## 复现

从仓库根运行。依赖项目现有 `playwright-core`、本机 Chrome 或通过 `BROWSER_EXECUTABLE_PATH` 指定的 Chromium，以及交接检查用现有引擎依赖。运行只写入本路线的 `outputs/`、`evidence/`、`results.json`。

```powershell
node experiments/gray-route-trials-20261119/authored/run.mjs
```
