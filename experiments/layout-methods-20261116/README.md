# 同页内容的五种排版方法对照

完成：2026-11-17。基线 `acaf72e306db0b6f16b5a50b12cf92816f00a789`，只新增本目录，无生产实现、提交或推送。

直接打开 [gallery](index.html)，可选两张并排、放大原图，查看源码和导出文件。[八图总览](outputs/overview.png)同时包含五种方法、原灰稿、旧原生稿和用户生图。

## 比较口径

共同输入是 [content.json](content.json)，取自指定 gray-state 的两组六个块。标签、正文、来源和原关系未改；六项标题／全文覆盖见 [输出审计](evidence/output-audit.json)。历史三张参照原样复制，哈希见 [输入记录](evidence/input-manifest.json)。生图新增文字没有进入内容。

五法均实际执行了工具并生成 **2560×1440 PNG**。SeaSlides HTML、Slidev 实现了灰稿的“三项障碍 → 落地阻力”图示；Marp、Yoga、Typst 是保留全文的**纯文字排版对照**，未消费该块的图示制作要求。不能把三张控制稿的完成度与图示样例混为一个质量排名。

这里比较作者链路、排版机制与结果，没有运行外部框架的模型生成／多轮 Agent 自动设计链。页内布局、组件选择和中文适配仍由本次宿主 Agent 编写，未证明低成本自动生产或跨稿稳定性。

## 方法、真实执行与作者工作

| 方法 | 实际运行、现成能力 | 本次补做与布局差异 | 产物／边界 |
|---|---|---|---|
| [Marp CLI 4.5.1](https://github.com/marp-team/marp-cli) | Markdown 解析、主题、浏览器排版、官方 PNG/PDF 导出 | 1页 Markdown；约1.1KB中文蓝白主题，指定双栏与间距。接近原灰稿左右分组 | [PNG](outputs/marp.png)、[PDF](outputs/marp.pdf)、[源码](src/marp/slides.md)。文字控制稿；默认图片 PPTX未生成；实验可编辑选项未运行 |
| [SeaSlides HTML](https://github.com/touying-typ/seaslides/tree/dcde5bf6c6875b300e2999fc7766f369a13a67ac/skills/seaslides-html-slides-skill) | 真实 mckinsey-minimal 模板的 insight-card 组件；原 source gate、assemble、DOM→SVG、PNG/PDF/PPTX、DOM审计与编译收据 | 模板后追加约3KB样式，适配中文、校标、47%问题区＋四行感悟；新增障碍汇聚组件；移除不用的外部CDN和导航。不是原主题直接装入文字即成稿 | [PNG](outputs/seaslides.png)、[PDF](outputs/seaslides.pdf)、[PPTX](outputs/seaslides.pptx)、[语义内容](src/seaslides/content.html)、[样式](src/seaslides/template.css)。图示完整 |
| [Yoga 3.2.1](https://github.com/facebook/yoga) | Chromium真实测量标题／段落，Yoga Flexbox计算嵌套分带、行列与间距 | 约5.9KB任务适配器，明确指定上2项／下4项容量、字号及渲染样式；测量回调和HTML绘制由作者补做。没有运行语义规划或自由布局搜索 | [PNG](outputs/yoga.png)、[源码](src/yoga.mjs)、[实测与几何](evidence/yoga-measurements.json)。文字控制稿；无PPTX链路 |
| [Slidev 53.1.0](https://github.com/slidevjs/slidev) | Vue/Markdown 编译、浏览器排版、PNG/PDF及原生 PPTX 导出 | 约5.6KB整页源文件，宿主 Agent 自由设计：左侧障碍图与合规短项、右侧编号条目；默认主题主要提供框架。没有声称 Slidev 自动完成整页设计 | [PNG](outputs/slidev.png)、[PDF](outputs/slidev.pdf)、[PPTX](outputs/slidev.pptx)、[源码](src/slidev/slides.md)。图示完整 |
| [Typst 0.15.2](https://github.com/typst/typst)＋[Touying 0.7.4](https://github.com/touying-typ/touying) | 真实 SeaSlides navy-formal 的 slide／method-card 函数与 Touying 布局，Typst编译 PDF/PNG/SVG，**不经浏览器排版** | 复用现成主题，改蓝白配色、中文字号和白色页头，加入原校标并去掉单页无用页脚；新写一页两列内容。卡片大小由排版引擎测量 | [PNG](outputs/typst.png)、[PDF](outputs/typst.pdf)、[SVG](outputs/typst.svg)、[源码](src/typst/main.typ)。文字控制稿；本轮未运行 typ2pptx |

SeaSlides固定 commit 为 `dcde5bf6c6875b300e2999fc7766f369a13a67ac`。当前 README推荐主线为 Typst/Touying，仓库仍有HTML技能和工具链；上述两个后端分别取自实际代码，未用论文描述代替运行证据。npm精确版本与integrity在两个 lock 文件；外部源码、依赖和缓存隔离在忽略的 `vendor/`、`node_modules/`、`.cache/`。

试验保留的 SeaSlides 派生源文件适用上游 [MIT 许可](LICENSE-SeaSlides.txt)。

## 检查与可编辑性

- 五张方法图已逐张打开检查。六项标签／正文完整；Marp、SeaSlides HTML、Yoga 的 DOM文字检查无越界／溢出，SeaSlides原生门的 blocker为0；四份PDF均1页，文本覆盖完整、文字span未越出页面。Typst PDF嵌入 Microsoft YaHei。图示关系只限原稿已有的三障碍汇聚，不建立两组间的对应／因果。
- 校标取自现有主题PPTX的原始媒体，裁取浅底版本，所有路线保持644:165比例；没有生成或重绘校标。
- 两份PPTX均由框架原生导出，已在本机PowerPoint实际重渲染：[SeaSlides原生渲染](outputs/seaslides-native.png)、[Slidev原生渲染](outputs/slidev-native.png)。XML分别有55／48个原生形状、各1张校标图片，全部六项全文可在原生文本中找到，**不是整页截图PPTX**。
- 原生导出有实际差异：Slidev出现标点孤行和换行漂移；SeaSlides的Latin字体被转换器写成Segoe UI，中文依赖本机字体回退。原生PPTX因此保留为导出证据，未称为已达到网页图的外观一致性或正式可交付质量；未修改上游转换器。

SeaSlides真实编译与视觉／PPTX产物已生成，**官方最终交付收据门未通过**：Windows收据写入反斜杠相对路径，验证器要求POSIX路径，产生9项路径规则错误。原收据未改，失败原文见 [最终门记录](evidence/seaslides-final-gate.txt)。这与其source gate和DOM blocker=0分别陈述。

完整失败和修正范围见 [运行记录](evidence/run-notes.md)，原框架收据见 `src/seaslides/output/compile-manifest.json`。本轮只验证这一页，不是选型结论或用户验收。

## 对本项目的对应关系

项目已有 `page-layout-library.mjs` 的矩形递归分区，以及 `html-component-runtime.mjs` 的Playwright／真实字体和行测量。外部实践不是首次引入“前端排版”：

- Marp可替代一部分Markdown解析、主题和预览导出胶水，不能替代页内设计和可编辑制作。
- SeaSlides值得借鉴的是语义内容、模板／组件、编译收据和局部诊断的职责分开；本页仍需补容量和图示组件。
- Yoga可承担一部分几何分配与对齐，文字测量仍要外接；不能替代原关系判断、版式候选和视觉选择。
- Slidev说明宿主Agent可负责整页设计、成熟框架负责制作和导出，但自由编写仍需设计积累、约束和检查；原生转换仍有误差。
- Typst/Touying提供另一套排版引擎和函数组件；PDF能力在本页可验证，可编辑PPTX衔接仍须单独判断。

## 复现

本次实际使用 Windows、Node 25.2.0、Chrome与Microsoft YaHei。Slidev依赖有Node25的engine警告但构建完成；新环境应按lock里的engine约束选Node。无需模型密钥或付费服务。

```powershell
# 缺依赖时执行；下载均落在实验目录。已有本轮依赖可跳过。
powershell -NoProfile -ExecutionPolicy Bypass -File experiments/layout-methods-20261116/src/setup.ps1

# 原样重建五张PNG、PDF、两份原生PPTX、审计和gallery。
# -Python可指定具备Pillow/PyMuPDF/python-pptx/pypdf的Python；Typst由vendor/python加载。
powershell -NoProfile -ExecutionPolicy Bypass -File experiments/layout-methods-20261116/src/rebuild.ps1 -Python <python.exe> -RenderNative
```

`-RenderNative`需要本机PowerPoint，只打开并关闭这两份实验PPTX；可省略以只复现框架输出。`setup.ps1`在新环境安装依赖，未在本轮重复执行；`rebuild.ps1`已在本轮实际运行。单法命令和关键依赖见源码与编译收据。
