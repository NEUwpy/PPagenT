# 结构化页面方案 → 灰稿

[看编译结果](index.html) · [输入怎么写](inputs/README.md) · [校验 Schema](page-plan.schema.json)

2026-11-20。独立单页 CLI。从已有的上屏文案、来源和内容关系出发，程序绑定组件、尝试布局、测真实行框并输出灰稿。版面取舍已经进了输入与程序规则，运行无需模型。

## 输入与输出

输入合约是 `gray-page-plan@1`。页面给主旨和页题，组给阅读关系，条目给上屏文字和可选的局部表达。共同条件用作用域引用，讲述备注单独保留。每个内容字段关联原文引文。输入字段、关系和怎么写在[示例说明](inputs/README.md)。输入中的汇聚、顺序及短项是表达需求，实际尺寸由编译器计算。

| 输入 | 在一条编译入口上检查什么 |
| --- | --- |
| [不足与感悟](inputs/hr.json) | 两个独立组，第一点不足中已有结构库的真实汇聚图，第二点的对象与状态，以及四点感悟中的一段真实流程 |
| [两种上线方案](inputs/options.json) | 中性比较和共同回退条件，附注同时绑定两个方案 |
| [汛期值班](inputs/duty.json) | 三个独立职责组和全页适用期，保留「或」、阈值、跨级别上报及例外范围 |

三页均通过 1280 × 720 实测。不足与感悟和汛期值班在 1020 × 720 重新求解组宽、分行与组件尺寸，也通过实测。不足与感悟在 720 × 420 的可生成候选均溢出，编译非零退出并保存[检查回执](output/pressure/report.json)与[诊断预览](output/pressure/rejected.html)。

成功后输出自包含的 `gray.html`、`gray.png`、已校验的 `page-plan.json`、布局 `layout.json` 与 `report.json`。布局记录使用 CSS px 及左上原点，包含实测分区和组件、阅读顺序、文字、字号、行字符范围、形状和连接几何、来源及作用域。失败回执指出对应字段或候选。容量失败有实测候选时，同时保存 `rejected.html` 与失败图，便于看见问题。

## 编译规则与试验边界

- Ajv 严格校验结构。程序核对对象 ID、作用域、引文是否逐字存在及上屏字段是否按来源绑定。引用正确的改写还要由内容层核对语义忠实。
- 按组内关系使用真实文本、并列、比较或顺序组合。局部支持库内三至六路汇聚、短项和值、顺序步。组宽候选按内容、组件的最低宽度及幅面计算，使用 Chromium 测实际文字、边界、重叠和连接锚点。排序先考虑可读版式，再比较短末行与相邻组的空间分配。
- 画布、组件和主题使用试验范围内的固定排版约束。超容返回诊断，保留已确定的文字。HTML 为本次布局的重放源，`layout.json` 是同一次浏览器测量的交接证据。工作台接入、Markdown 自动规划、Home 消费及原生 PowerPoint 重渲染另待验证。多页、媒体和图表需扩展。

## 运行

从仓库根运行，使用项目已有 Node 依赖和本机 Chrome 或 Edge。可用 `BROWSER_EXECUTABLE_PATH` 显式声明浏览器。重复使用同一输出目录时，每次运行保存到独立子目录。

```powershell
node experiments/gray-compiler-20261120/compile.mjs experiments/gray-compiler-20261120/inputs/hr.json --out experiments/gray-compiler-20261120/output/hr
node experiments/gray-compiler-20261120/compile.mjs experiments/gray-compiler-20261120/inputs/hr.json --width 1020 --out experiments/gray-compiler-20261120/output/hr-narrow
```
