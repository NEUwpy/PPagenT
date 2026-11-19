# Pretext 实测与文字版面

两份原稿先按原文段落的关系组织为论述单元。栏数、栏宽、分配、段首标题摆法由文字测量和实际余量共同决定。横竖线用于组织正文，整页文字可选、可复制。输入的段落分组人工冻结。

| 实页 | 实际结果 |
| --- | --- |
| [不足与感悟 · 标准](output/hr-standard.html) · [图](output/hr-standard.png) | 1148×508 正文区。20px，实用 486px。两大组横向分带，保留各自栏标和独立小标题。实际列宽随正文长度变化，感悟两栏分别为 410、543px。 |
| [不足与感悟 · 缩窄](output/hr-narrow.html) · [图](output/hr-narrow.png) | 1012×464 正文区。19.5px，实用 451px。小标题改为加粗段首，与正文共用行流。保留 2017 年的让步限定、“唯一”和最后一句“作风改进不要求立竿见影，重在持续用力”。 |
| [备件供应 · 标准](output/spares-standard.html) · [图](output/spares-standard.png) | 22px，实用 411px。供货方式双栏，分级建议是贯穿的宽行，执行要求再双栏。完整展示“500 元以上／以下”、安全停机备案加急例外和生效衔接。 |
| [备件供应 · 缩窄](output/spares-narrow.html) · [图](output/spares-narrow.png) | 保持 22px，不同栏宽与断行，无越界。段落语义、排序和说明与标准版一致。 |

## 两次调整

先尝试 23px 独立小标题，段间、组间留较舒展的间距。人力稿实用高度达 629px，第二组伸出可用范围；备件稿在同一条件实用 461px。后续调整字号、版面间距及标题与正文的关系，保留本稿细节。[标准首轮](output/hr-standard-first.png) · [缩窄首轮](output/hr-narrow-first.png)

标准幅面保留较易扫读的独立小标题。窄幅独立标题在 18px 时仍用 470px。把左侧栏标提到组顶部，增加了文字横向宽度，但在 18px 时仍用 454px，低于本轮要求的 12px 安全余量。最后在原两组语义上试 `rich-inline`，将条目标题置于段首加粗，19.5px 时正文用 451px。条目之间的隔断感随之减弱。[逐候选回执](output/hr-narrow.json)

## Pretext 能做的事

实际使用 npm 锁定的 `@chenglou/pretext@1.0.0` 与本机 Chrome 157.0.8103.79。预先准备常规和粗体字体，调用 `layoutWithLines` 对各栏候选测量。改变行宽时通过 `layoutNextLineRange` 和 `materializeLineRange` 继续同段，段首混排通过 `prepareRichInline` 与 `walkRichInlineLineRanges` 测量。浏览器完成最终排版和像素检查。[项目与 API](https://github.com/chenglou/pretext) · [MIT 许可](https://github.com/chenglou/pretext/blob/main/LICENSE) · [动态行宽示例](https://chenglou.me/pretext/dynamic-layout/) · [编辑式示例](https://chenglou.me/pretext/editorial-engine/)

- 两稿 11 个文字块，在 198、236、278、317、386、467、519px 和 20px 微软雅黑下测量。常规原生断行与 Pretext **77/77 逐行一致**。开启 `text-wrap: pretty` 后，**77/77 行数一致，70/77 逐行一致**，可通过收据检查具体折点。
- 另取五个更长段落，510px 里前两行让出 166px，余下行恢复 510px。Pretext 的逐行结果与 CSS `float` 下的浏览器断行 **5/5 一致**。变宽测量作为独立探针保留，交付页用连续文流显示。
- 适合提前测出多个宽度和混排配置的载荷，帮助决定哪里该借宽度、哪里可以合段。中文、混排样例的结果来自这台浏览器、这些字体和样本，最终行序和文字边界以 Chrome 实际渲染为准。[逐行证据](output/line-probes.json)

## 重跑

在仓库根目录执行。依赖本机 Chromium、Noto Serif SC 和微软雅黑，已有 Playwright 由仓库提供；外部包安装作用域限于本目录。灰稿 HTML 在生成时内联样式，打开可以离线看。

```powershell
npm.cmd ci --prefix experiments/html-typesetting-20261119/pretext --ignore-scripts --no-audit --no-fund
node experiments/html-typesetting-20261119/pretext/run.mjs
node experiments/html-typesetting-20261119/pretext/verify.mjs
```

[回执总表](output/summary.json) · [原稿与来源区间](output/input-map.json)
