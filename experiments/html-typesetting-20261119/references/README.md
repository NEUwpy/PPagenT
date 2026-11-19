# 比较正文的 HTML 排版试验

[备件供应方式对比说明](index.html) · [1280×720](preview.png) · [1020×640](evidence/narrow.png)

从仓库 A04 原稿提取 20 个语义片段，按原文组织为两个各自完整、可以横向阅读的供应方法，以及两条跨方法的规则。放大了来源不同的时间指标，同时保留「配送周期平均」「响应时间可缩短至」「以内」的限定。建议和安全停机例外分开。金额边界沿用原稿的「500 元以上」「500 元以下」。[原稿](../../../稿件/模拟稿库/行政信息/A04-备件供应方式对比说明.md)

## 页面迭代

| 试验 | 实际效果 |
| --- | --- |
| 数字独占一行 | 92px 数字下压正文，1280×720 的生效条款超出画面，总内容滚动高度超 72px。[初稿失败图](evidence/first.png) |
| 同类正文共享行 | CSS subgrid 让两种方法的四种文字角色共用实际行高。方法正文与适用对象的基线各自对齐，标准幅面分别为 364.44、440.44px。时间限定与数字同行，生效条款完整在画布内。 |
| 幅面缩窄 | 同一 DOM 在 1020×640 重算。建议与例外从并排变成同一标签列下的逐条说明，两个规则正文起点对齐。方法正文和适用对象的基线分别为 329.95、399.95px，两方法一致。 |
| 中文断点 | 按来源句的短分句提供断点，「无论金额」「500 元以上」「8% 至 12%」成组。仅在两条短规则使用 balance，其他正文使用原生换行策略。 |

两个目标尺寸的 20 处绑定均有可见的字形框，最小有效字号为 18px，无横向或纵向滚动溢出。560×900 压力测试会转为单列阅读，内容需要滚动 57px，可按网页继续阅读，无法作为该尺寸的单页输出。文案分组和阅读优先级是一次稿件编辑决策。排版高度、换行、比较行对齐及规则重排由浏览器完成。[片段、源跨度和浏览器测量](evidence/results.json)

## GitHub 参考和实跑

- **Grid System 1.2.0** 把可锁定的网格和构图探索分开，有实际字体测量、网格占用检测与布局导出。实跑固定版本的 src/core.ts 中的 calculateLayout，以浏览器 Canvas 量字，使用 A04 原稿和相同画布，四种上游构图生成了两类问题。aligned、editorial、asymmetric 将 274 字符原稿循环填满到 610、558、664 字符，各包含两份完整原稿。free 只排到 194 字符，漏掉生效条款。四种均没有警告，符合该工具用于视觉试排的循环填充逻辑。导出的宽版还使用预断行定位。这类工具适合借网格和可复现试排思路，内容编排必须先遵守稿件边界。[固定版源码](https://github.com/dostevskii/grid-system/blob/203a601f5b362e16671484710a476ee3e72229d9/src/core.ts) · [导出实现](https://github.com/dostevskii/grid-system/blob/203a601f5b362e16671484710a476ee3e72229d9/src/export.ts) · [MIT](https://github.com/dostevskii/grid-system/blob/203a601f5b362e16671484710a476ee3e72229d9/LICENSE) · [实跑](evidence/grid-system.json)
- **Quoin 1.26.0** 在 Chrome 实跑 verifyGrid、seatPage 和 exportCssVerified。只检查直接拥有文本的块，本页带来源包装的多数内容在扫描范围外。每个目标幅面都能将它认出的 3 块从 2 块对齐调到 3 块。直接复用宽版自动导出的修正 CSS 到窄版，3 块全部偏离。适合作为局部诊断参考，发布页采用可重排的 CSS 行关系。[文本块扫描](https://github.com/hawkbass/quoin/blob/cba04515852af5bbd4da7f6d6a5f404d8d708162/src/walk.ts) · [MIT](https://github.com/hawkbass/quoin/blob/cba04515852af5bbd4da7f6d6a5f404d8d708162/LICENSE) · [实跑](evidence/quoin.json)
- **Chrome 的 HTML 排版指南**给出了原生 subgrid、按容器尺寸重排和按用途选择换行策略。本页直接采用这些浏览器能力。基线检查使用 css-baseline-grid 的零尺寸行内探针思路，在比较区的真实文字容器上取浏览器基线。[CSS 排版](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/css/css-layout.md) · [可读换行](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/visual-design/improve-text-layout-and-legibility.md) · [基线探针](https://github.com/bkazez/css-baseline-grid/blob/main/check-grid.mjs)

## 复现

仓库根目录已有 playwright-core。本次 Chrome 157.0.8103.79 实际使用 Noto Sans SC 排正文，用 Georgia 排大数字。最终 HTML 内含 CSS，可直接打开。

~~~powershell
node experiments/html-typesetting-20261119/references/render.mjs
~~~

需要复跑上游探针时，在本实验目录从 GitHub 固定版本取得源码，再打包浏览器入口。安装落在实验目录的 node_modules，预览 HTML 本身无运行时 JS 和外链资源。

~~~powershell
npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund esbuild@0.28.2
$quoin = 'cba04515852af5bbd4da7f6d6a5f404d8d708162'
Invoke-WebRequest "https://codeload.github.com/hawkbass/quoin/tar.gz/$quoin" -OutFile node_modules/quoin-source.tar.gz
tar -xzf node_modules/quoin-source.tar.gz -C node_modules
$grid = '203a601f5b362e16671484710a476ee3e72229d9'
$gridDest = "node_modules/grid-system-$grid"
New-Item -ItemType Directory -Force "$gridDest/src" | Out-Null
foreach ($file in @('src/core.ts','src/fonts.ts','src/model.ts','LICENSE','package.json')) {
  Invoke-WebRequest "https://raw.githubusercontent.com/dostevskii/grid-system/$grid/$file" -OutFile "$gridDest/$file"
}
node quoin-probe.mjs
node grid-system-probe.mjs
~~~
