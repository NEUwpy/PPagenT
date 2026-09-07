# Run A report

## Deliverable

已生成 4 页、1280×720、原生可编辑的 `deck.pptx`，包含四个分析页，无封面、无目录、无额外收束页。所有文字、矩形、圆形、分隔线和流程连接线均写入 PPTX 原生对象。

## Validation completed

- `render_slides.py deck.pptx`：成功生成最终 PPTX 渲染目录 `deck/`，包含 4 页。
- `slides_test.py deck.pptx`：通过，未检测到画布溢出。
- Layout export：已生成 `slide-01.layout.json` 至 `slide-04.layout.json`。
- Inspect：已生成 `inspect.ndjson`，并按页核对实质命题，见 `source-coverage.md`。
- Canvas bounds：逐页检查所有导出元素 bbox，`off_canvas=0`。
- Connection check：PPTX `ppt/slides/slide3.xml` 包含 7 个 `p:cxnSp` 连接对象和 7 组箭头端点属性；主流程 3 条、授权分支 3 条、异常入口 1 条。
- Text capacity：导出布局中全部文本框启用工具级 `autoFit: shrinkText`；正文保持 15–18px，标题与分区标题达到预设层级。少量短标签发生轻微自动适配（0.89–0.98），未触发 `slides_test.py` 溢出。

## Coverage and limits

`slides_test.py`、bbox 和 XML 检查覆盖画布边界、原生对象存在性、连接对象和工具级文本适配；它们不覆盖视觉审美、中文字体在用户环境中的最终字形差异、语义关系是否符合人工预期或内容事实是否完整。事实覆盖由 `source-coverage.md` 对最终导出文本快照完成，视觉验收留给父任务独立查看最终渲染图。

## Files

- `builder.mjs`
- `deck.pptx`
- `deck/`（最终 PPTX 渲染）
- `slide-01.layout.json` … `slide-04.layout.json`
- `source-coverage.md`
- `design-notes.md`
- `structure-usage.md`
- `report.md`
