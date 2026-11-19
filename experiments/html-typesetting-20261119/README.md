# HTML 文字编排试验

前一轮页面以模板和装载能力为主，用户认为整页效果差。本轮以浏览器的文字布局、阅读顺序和视觉层级为主，从原始 Markdown 做几种不同的整页编辑式编排。选入展示的是三份页面的宽、窄两版。[打开 HTML 预览](index.html)

用户指出人力稿应以演示讲述为目标，原先的全文分栏退回试验记录。当前展示版把主旨句放入主题页首，正文改为两点不足的讲述线索和四点感悟的提纲。以仓库原有多路汇聚画出三项因素共同阻碍落地，并在第一点感悟内展示业务战略到落地方案。正文由原稿 551 个非空白字符缩为 218 个，完整稿留在讲述备注。两个幅面都检查了页首位置、三条曲线端点和文字裁切。[当前展示版](talk-slide/review.html) · [窄版](talk-slide/review-narrow.html) · [讲述备注](talk-slide/讲述备注.md) · [实测记录](talk-slide/audit.json)

从旧灰稿和用户生图再做了一组同版面试验，延续原汇聚图和简洁实文。两组占位、图文几何及文字行框在灰稿和参照样式两页完全相同。[灰稿与样式对照](reference-style/index.html) · [方法与规范](reference-style/README.md)

| 展示稿件 | 实际排法和调整 |
| --- | --- |
| 存在的不足与感悟（前一版对照） | 整页自动流栏使「四点感悟」从左栏底部到右栏接续。试改为在各组内分栏，在宽、窄版均容纳了全文。这两种排法构成文字容量的对照，均经用户反馈退回。[原分组流栏](editorial/output/review-refined.html) · [连续分栏对照](editorial/output/review-continuous.png) · [测量](editorial/output/results.json) |
| 备件供应方式对比 | 用真实 CSS 子网格让两方式的数字、解释、适用对象对齐。共同规则移到下方，转窄时按条款顺读，两种画幅共用一份 HTML。首版大数独立占一行，生效条款被顶出；改为数字与单位在同一行的阅读节奏。保留 5 个工作日、1 个工作日以内、8%–12%、原有 500 元限定和安全停机例外。[HTML](references/index.html) · [实测与首轮](references/README.md) |
| 汛期值班与应急处置 | 页眉先读适用日期，按三项职责分配真实正文宽度。处置类句子的触发条件用字重提示，数字与单位保持连续。「或」「无论级别」和 30 分钟要求全部保留。窄版按宽度重算，正文字号 22px。[宽版](flow/output/duty.html) · [窄版](flow/output/duty-compact.html) · [分栏实测](flow/README.md) |

保留另一条经验证的人力稿做法。宽幅保留独立小标题，窄幅将标题改为段首粗体，使标题与正文共用行流。窄区 1012×464 由独立标题的 18px 溢出，调整为 19.5px 段首行流后容纳原文。[段首行流 HTML](pretext/output/hr-narrow.html) · [证据](pretext/README.md)

## 实跑的外部项目

| 项目 | 本地试验的结果 |
| --- | --- |
| Pretext 1.0.0 | 在两份中文稿上测 77 组常规宽度，逐行与 Chromium 原生默认断行一致；启用 `text-wrap: pretty` 后有 7 组折点不同。另有 5 组变宽文本与 CSS float 对照一致。适合预量、分栏和选段首形态，最终读取浏览器实际布局。[项目](https://github.com/chenglou/pretext) · [逐行证据](pretext/output/line-probes.json) |
| Paged.js 0.4.3 | 实际用同一份内容和出版 CSS 排版。人力稿变两页并留下栏末的小节标题，值班稿一页但险情组被拆跨栏。保留为连续文档和溢出对照。[项目](https://github.com/pagedjs/pagedjs) · [本地对照](flow/README.md) |
| BudouX 0.10.4 | 运行简体中文短语模型，以 `wbr` 生成可断点。两份稿的宽版标题未受益；人力稿同样双栏的整页从约 751px 增至约 779px。对短标题可按实例验证，正文主方案采用浏览器断行和必要的局部调整。[项目](https://github.com/google/budoux) · [本地对照](editorial/output/results.json) |
| Grid System 1.2.0 | 用上游 `calculateLayout` 跑同一份备件稿，三种模式循环使用原稿来填充网格，另一种只覆盖 194/274 字符。借鉴网格与构图选择分层，真实稿的来源覆盖交由本地检查。[项目源码](https://github.com/dostevskii/grid-system/blob/203a601f5b362e16671484710a476ee3e72229d9/src/core.ts) · [实跑记录](references/evidence/grid-system.json) |
| Quoin 1.26.0 | 带内联来源标记的页面仅三个直拥有文本的块被识别。分画幅校正均能让这三块对齐，宽版的校正直接套到窄版后三块均偏离。适合作为基线诊断。[项目](https://github.com/hawkbass/quoin) · [实跑记录](references/evidence/quoin.json) |

Chrome 的 `text-wrap: balance` 对上线方案的短引导段有直接效果，原本单挂「投入。」的第二行改为完整分句。正文分栏、比较项和共同条款各用了不同的浏览器排版原语。可复用的是内容块的语义、字体层级、分栏和对齐规则以及浏览器测量。跨稿设计仍需理解内容，本轮稿件的分组与强调经过人工解释。[Chrome 断行实践](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/visual-design/improve-text-layout-and-legibility.md) · [CSS 分栏规范](https://www.w3.org/TR/css-multicol-1/) · [上线方案 HTML](editorial/output/decisions-native.html)

## 复跑

四个子目录各有可执行实验。展示页使用落盘 HTML，在宽窄画幅下实际重新布局。校验记录覆盖六个画幅、渲染边界及重要的限定词。复核环境为本机 Chromium 和安装的中文字体。

```powershell
npm.cmd --prefix experiments/html-typesetting-20261119/editorial ci --ignore-scripts
node experiments/html-typesetting-20261119/editorial/run.mjs
node experiments/html-typesetting-20261119/talk-slide/build.mjs
node experiments/html-typesetting-20261119/verify-gallery.mjs
```
