# Marp 与 Yoga：已完成真实渲染的小阶段

- exact tip 仍为 `acaf72e306db0b6f16b5a50b12cf92816f00a789`，无提交；修改只在本实验目录。
- Marp：`outputs/marp.png`（2560×1440）、`outputs/marp.pdf`；源码 `src/marp/slides.md`、`src/marp/theme.css`，由 Marp CLI 4.5.1 实际编译并用其 PNG/PDF 导出。标题／分组／编号为 Markdown，双栏和中文主题由本次作者写入约20条 CSS 规则，不是框架自动选出的整页布局。
- Yoga：`outputs/yoga.png`（2560×1440）；源码 `src/yoga.mjs` 和生成的 `src/yoga/index.html`。Chromium 先按固定2／4列容量真实测量中文标题／段落，再由 Yoga 3.2.1 计算分带、行列、padding/gap 和各项位置。真实尺寸与算后几何在 `evidence/yoga-measurements.json`，内容下界645px／720px。作者指定2＋4分带及22px正文，Yoga不负责语义、美化或绘制。
- 两张图均已打开逐张看过；6个标签、6段正文覆盖均 true，DOM 越界／溢出为0，校标加载且保持644:165源比例。见 `evidence/marp-dom-audit.json`、`evidence/yoga-dom-audit.json`。
- Marp第一张自行浏览器截图带演示导航，已改用官方PNG导出，当前图无导航遮挡；这不是内容布局错误。
- 无原生PPTX声明。Marp默认整页图片PPTX未生成；Yoga只交HTML源码／PNG，尚无PPTX转换链。
- SeaSlides原模板源门已通过，正在补齐DOM转换的一项 jsdom 依赖；Slidev隔离安装成功；可额外实际运行的 Typst 0.15.2 已轻量安装至 vendor/python，接下来有界尝试 SeaSlides/Touying 模板，不冒充风格HTML。

本报告是完整的两个样例小阶段，剩余路线和总 gallery 继续制作；请按图和源码分别评审。没有将局部运行或看图视为用户验收。
