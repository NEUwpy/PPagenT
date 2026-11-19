# 灰稿交接的原生 PowerPoint 试验

2026-11-19。用 PptxGenJS 4.0.1 写出原生对象，实际用本机 PowerPoint 打开、渲染，并通过 OOXML 和 PowerPoint COM 核对对象、位置、文字与换行。PptxGenJS 4.0.1 使用 MIT 许可证，本次仅核对已用原语。相关接口见 [PptxGenJS 的文字 API](https://gitbrent.github.io/PptxGenJS/docs/api-text)、[PptxGenJS 4.0.1 许可证](https://github.com/gitbrent/PptxGenJS/blob/v4.0.1/LICENSE)、[PowerPoint 的文本行查询](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.textrange.lines)。

## 本轮主窗口的灰稿交接

直接读取 [汛期值班灰稿的布局结果](../bridge/output/duty-standard.layout.json)，按其阅读顺序，将段落、文本框边界、字体、字号、行高、字重和对齐传给同一后端，共输出 13 个可编辑文本框。13 个框在 PPTX XML 和 PowerPoint 中均存在，文字完整，XML 几何最大误差约 0.00004 CSS px。无须重新浏览灰稿 HTML 或再次排版。来源、语义组织和组件实例留在输入文件，样式只生成基本字重和字号。本探针验证段落与几何，未生成页壳、分区边框或图表。

事件处置模块三段正文存在可测差异。一般险情从 Chrome 的 2 行变成 PowerPoint 的 1 行，危险征兆从 3 行变成 2 行。两框各有约 16 px 的右边界超出。上报段两边均 3 行，PowerPoint 的字形界仍约超右边 12 px。这里的超出是 PowerPoint 报告的文本边界相对文本框，截图中文字仍可读。布局 JSON 给行框但未给每行的字串或字符范围，本次只能对比行数和实际文本边界。可查看 [原生 PPTX](output/bridge-duty.pptx)、[PowerPoint 导图](output/bridge-duty.png)和[逐框审计](output/audit.json)。

## 已有多路汇聚结构

输入为上轮[冻结的 A 页浏览器解析树](../../html-library-reuse-20261119/evidence/native-a-tree.json)，使用其真实文字、设计位置和图层顺序。每个版本保留 39 个对象，其中 38 个原生对象含 24 个文本对象和 3 条路径，另有 1 张原校标图片。路径端点相对浏览器测量的位置误差小于 0.001 px。旧树只保存路径的采样点，能导出原生可编辑折线路径。利用组件原 SVG 的 C 指令补充三次曲线路径与控制点后，3 条都写成了真正的原生三次曲线。两种路径都独立于形状，移动输入或结果框后不会自动移动路径端点。正式交接应明确表达源节点、目标节点、锚点、几何及原生编辑要求。

从浏览器有效样式提取到 9 个对象含单边样式，但旧树只记录统一的描边。6 个标题编号和文字采用不同内联样式，旧树将它们合为同一文本样式。页面渐变记录在树中，本次 PptxGenJS 适配只用第一色标画页壳。图中可见三输入左侧强调边消失、编号与标题贴在一起以及合规块的单侧线变成全框，足以说明现有树不能直接作为完整原生交接。可查看 [原 HTML 页](../../html-library-reuse-20261119/outputs/page-a.html)、[PowerPoint 导图](output/natural.png)和 [浏览器及降级记录](output/inputs.json)。

换行对照分别取逻辑段落交给 PowerPoint 自然换行，以及按浏览器测得的文字范围插入软换行。首轮误用旧树的 `text` 测自然换行，发现此字段已经含浏览器折点。改用 DOM 逻辑段落，并把 HTML 显式换行和由 CSS 形成的布局折点区别记录后，得到以下结果。

| 测试 | 自然换行 | 按浏览器软换行 |
| --- | --- | --- |
| A 页 24 个文本框 | 行数均一致，汇聚结果一处折点变化 | 行数和每行内容均一致 |
| 两段实文各测 5 个贴边宽度 | 行数均一致，一处“人”字换至次行 | 行数和每行内容均一致 |

结果内的逐行文字比对忽略布局空白，数据见[逐框审计](output/audit.json)。软换行留在同一个可编辑框，适合由组件明确提出的换行要求。试验对已加软换行的框关闭自动折行，继续编辑长文时需要重新检查文字边界。另有[自然换行压力导图](output/natural-stress.png)和[软换行压力导图](output/preserve-lines-stress.png)。

## 建议的交接字段

- 页、组件与节点有稳定 ID，组件标注版本、支持的 PPT 原语及布局变体，明确画布坐标、旋转、图层和阅读顺序。节点保留角色、内容槽及来源引用。组件自带设计关系与布局边界。
- 文本保留逻辑段落、显式换行和有样式的文字片段，提供文字框与内边距、字体及回退、字号、行距和横竖对齐。浏览器记录行框和字符范围供比对，PPT 端以实际渲染核对换行和字形边界。贴边或超出应输出到原页、组件和文字节点，供灰稿调整或原生适配修正。
- 图形保留形状及路径指令，逐边线或显式边线原语。连接保留源与目标 ID、锚点、路径和叠放顺序。需联动的连接要验证原生连接行为。图片保留资源引用、裁切及放置方式。标明可交由主题应用的页壳样式。
- 共享编译器为未知原语、丢失的文本字段或可疑容量生成诊断。按真实组件在浏览器和 PowerPoint 各跑一次。先采用原型已经通过的基础对象，按需求补齐高级样式，逐个验收产品资产。

## 复现

需要仓库当前的 `node_modules` 里的 Playwright、Windows PowerPoint、Chrome（可用 `BROWSER_EXECUTABLE_PATH` 指定）以及 Python 3。保留两个输入目录后，在本目录执行以下命令。PPTX 和实际渲染图保存在 `output/`。

```powershell
npm.cmd ci --no-audit --no-fund --ignore-scripts
node probe.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File render.ps1
python audit.py
```
