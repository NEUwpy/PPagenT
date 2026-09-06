# B版设计说明

本页直接调用 `sequence-phase-gates-004`，保留蜿蜒收窄河道、横跨河道的三道门闸、阶段编号和门禁标牌；阶段文案来自 manuscript.md 的记录复核流程。

中性 Skin 只替换组件主题用途色：纸色背景、浅承载、炭黑／正文灰文字、分隔线与低饱和砖红强调。结构主题中的 typography 数值按 CSS pt 传入；页首和页脚的原生文字按设计 px 传入。

结构调用事件、参数与成功记录见 `evidence/structure-invocations.ndjson`；候选布局见 `evidence/candidate.inspect.ndjson`。输出为一页可编辑 PPTX，最终导入渲染由仓库 `src/tools/render-pptx-evidence.mjs` 生成并复核。

参考方式：保留结构库几何与视觉语法，改变阶段文字、门禁文字、颜色和页首 shell；没有使用库示例事实。