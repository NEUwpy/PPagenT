# HTML 连续文字流试验

将两份中文原稿分别交给 Paged.js 0.4.3、浏览器的全页双栏和按语义组局部分栏。三者使用同一批正文。同一稿件的栏目数量及宽度由内容长度和浏览器实测共同决定。结果供选型比较。

| 原稿 | 局部分栏 1280×720 | 1080×650 换尺寸 | 全页文字流的失效 |
| --- | --- | --- | --- |
| 存在的不足与感悟 | 两点不足一栏，四点感悟分成连续的两栏，20px 正文。[HTML](output/hr.html) · [成图](output/hr.png) | 首轮超出，调整边距、标题留白和行距后保持 20px，底部余约 31px。[HTML](output/hr-compact.html) · [首轮数据](first-flow/results.json) | Chromium 自然双栏超过画布下沿。Paged.js 落为两页，「四点感悟」悬在左栏末，第四条落次页。[浏览器失败图](output/hr-native-flat.png) · [Paged.js 失败图](output/hr-paged.png) |
| 汛期值班与应急处置安排 | 三个主题并列，各用一栏。汛期在题下，险情触发条件加粗，22px 正文。[HTML](output/duty.html) · [成图](output/duty.png) | 原文维持同组，20px 正文。[HTML](output/duty-compact.html) · [成图](output/duty-compact.png) | Paged.js 一页能承载，正文组在两栏之间续排。值班稿适合按主题找读，局部分栏更清楚。[Paged.js 对照](output/duty-paged.png) |

实际安装运行 [Paged.js](https://github.com/pagedjs/pagedjs) 0.4.3，使用 `@page` 设定画布和边距，由其 polyfill 生成浏览器页。这个例子确认分页引擎适合顺读文稿，也说明按页切分后仍需核对演示中的分组边界。[Paged.js 页面与边距](https://pagedjs.org/en/documentation/5-web-design-for-print/)

保留 CSS Multicol 的局部连续流。组内用 `column-fill: balance` 让浏览器平衡分栏，用 `break-inside: avoid-column` 让标题和正文跟随。组与组之间用 Grid 分配宽度，先根据组的真实字数估计需要的正文栏数，再实测不同宽度和字号档。文字标题、细分隔线和段间留白建立层级。正文用 Noto Serif SC，标题用 Noto Sans SC。数字与单位相连，`lang=zh-CN`、`line-break: strict` 与浏览器的 `text-wrap: pretty` 参与断行。本轮测量 42 个候选，为两份稿的两种画布各选一个布局。数据保留候选的余量、分栏及文字边界。[CSS Multi-column](https://www.w3.org/TR/css-multicol-1/) · [CSS Fragmentation](https://www.w3.org/TR/css-break-3/) · [Chromium 的文字排版建议](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/visual-design/improve-text-layout-and-legibility.md)

人力页保留 2017 年的逻辑限定、BLM、「唯一」及「作风改进不要求立竿见影，重在持续用力」。值班页保留加密巡查的「或」、两个报告条件、「无论级别」和 30 分钟要求。脚本验证原文段落拆分后可复原，并从落盘 DOM 取正文逐段比对。标题和分组采用原文提示词精简。两份稿的内容切分在本次实验中显式指定。

## 复跑

从本目录执行，使用仓库既有 Playwright 和本机 Chromium。

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
node run.mjs
```

默认 Chrome 路径可用 `BROWSER_EXECUTABLE_PATH` 覆盖。[输入哈希、文案、候选和结果](output/results.json)
