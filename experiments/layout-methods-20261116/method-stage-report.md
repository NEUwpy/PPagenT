# 方法选择与依赖核查（完整小阶段）

- exact tip：`acaf72e306db0b6f16b5a50b12cf92816f00a789`；开始时工作区干净。
- 输入已从指定 `gray-state.json` 提取为 `content.json`，6 块标签与正文逐字保留；分组关系保持“两点不足／四点感悟”，不建立跨组因果。原灰稿、旧原生稿、生图参照已原样复制，哈希记录在 `evidence/input-manifest.json`。
- 选择四条责任分配不同的路线：Marp Markdown＋主题 CSS；SeaSlides 现成 HTML 语义组件模板及原工具链；Yoga Flexbox＋外部真实文字测量；Slidev 宿主 Agent 整页设计＋浏览器测量导出。
- Marp CLI 4.5.1、Yoga 3.2.1 已安装到本实验目录；SeaSlides 已隔离 clone，commit `dcde5bf6c6875b300e2999fc7766f369a13a67ac`。Slidev 53.1.0 与 SeaSlides HTML 转换的轻量 Node 依赖正在同一隔离目录安装。
- SeaSlides 当前仓库仍有 HTML 技能/模板/编译脚本，README 的推荐主线已是 Typst/Touying。此次选其 `mckinsey-minimal` HTML 模板，不拿论文当代码证据，不安装全套研究系统或模型 provider。
- 计划保留原生支持的 PDF；Slidev 原生 PPTX 导出会尝试并核对 XML，若出现局部栅格或整页回退如实记录。Marp 默认图片 PPTX没有必要生成；可编辑实验选项依赖 LibreOffice，本轮先不扩展该链路。
- 所有设计仍需本次作者做布局/组件选择与中文适配；不是“框架自动设计”成本基准。后续继续真实渲染、覆盖/边界/字体检查与 gallery，不等待阶段审批。

官方证据：

- https://github.com/marp-team/marp-cli/blob/main/README.md
- https://github.com/touying-typ/seaslides/tree/dcde5bf6c6875b300e2999fc7766f369a13a67ac/skills/seaslides-html-slides-skill
- https://www.yogalayout.dev/docs/about-yoga
- https://sli.dev/guide/exporting

当前没有阻塞。下一份报告提交完整、可看、可复现的产物。
