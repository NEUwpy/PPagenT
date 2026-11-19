# 两条图示样例与真实 Typst 对照已完成渲染

- exact tip：`acaf72e306db0b6f16b5a50b12cf92816f00a789`，完成日期2026-11-17，仍只改本实验目录。
- SeaSlides HTML 当前 PNG：`outputs/seaslides.png`，2560×1440。实际复制并适配官方 mckinsey-minimal 模板，原 assemble.py 编译，六项正文／标题覆盖 true，当前 DOM 无越界／溢出；`evidence/seaslides-dom-audit.json`。本图实际消费 implementation.kind=diagram，完整保留已完成设计与三项障碍，用分组箭头指向落地阻力。为容纳结构，改成47%问题区＋四行感悟卡片；组件数、分组比例、图示扩展及中文样式是本次作者补做。
- Slidev 当前 PNG：`outputs/slidev/1.png`，2560×1440。实际运行 Slidev 53.1.0 export；源码 `src/slidev/slides.md` 是宿主 Agent 按灰稿设计整页，三障碍到落地阻力有明确箭头，合规四方面仅作并列短项。正文21—22px，6项标签正文完整；图已逐张打开检查，无可见裁切。后续补PDF文本/几何和导出审计。
- 上述两张经过一次容量修正：初版结构插入后底部越界，已收紧多余组件空间、调整问题区宽度与合规短项排列；未删正文、未改来源关系、未靠极小字号。
- 真实非浏览器对照：`outputs/typst.png`／`typst.pdf`／`typst.svg`，Typst 0.15.2＋Touying 0.7.4，实际复用 SeaSlides navy-formal 主题的 slide/method-card 函数。1页1280×720pt，PNG 2560×1440，PDF中全部6项标题和正文覆盖 true，字体嵌入 Microsoft YaHei。它是文字排版对照，未实现图示块要求；不得与另两法的图示完成度混比。
- 两条额外原生PPTX导出已有文件且XML有文本形状（旧版Slidev48形状＋1图片，SeaSlides58形状＋1图片，均367文字字符），不是整页截图PPTX。由于刚做容量修正，最终版PPTX将统一重导出核验，当前不作为最终交付。
- Marp／Yoga 保留为纯文字控制稿，不再重做。五法图已可看，下一步是导出收尾、共同证据和 gallery。

本报告完成对象是当前三个PNG及真实编译范围，未称全框架Agent自动生成链路、跨稿能力或用户验收。
