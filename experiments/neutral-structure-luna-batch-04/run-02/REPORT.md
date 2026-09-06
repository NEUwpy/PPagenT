# run-02 交付记录

## 输入与目的

- 输入：`experiments/neutral-structure-luna-batch-04/inputs/02-comparison.md`
- 目的：用一页中性编辑排版说明“临时协调”和“统一预约”的取舍。
- 关系：三个共同维度逐行对应。统一预约是本方案讨论中的优先方向，不是实测效率结论；紧急插单与预约信息维护责任保留在页脚说明。

## 结构选型与执行

- 先运行 `catalog.mjs list --logic comparison`，再读取并检查 `comparison-dual-verdict-001` 的 manifest、reference 和 runtime 契约。
- 直接调用 `comparison-dual-verdict-001`：两个对象、两侧各 3 条、一正一负、标题和要点均在容量内，调用后新增 40 个原生对象。
- 组件放在 Skin 正文区 `(55,166,1170,492)`，保留左右镜像、中央 VS、逐行共线和底部共同椭圆平台。
- 调用后按 `invocation.md` 做原生样式适配：临时协调的身份帽、承载、标记和下沉层改用灰度；统一预约保留砖红；主体面与中央节点去除重阴影。未改变结构对象的几何、文字或勾叉语义。
- 字体按 Skin 使用 `Noto Serif SC`（页首标题）和 `Noto Sans SC`（正文、辅助说明、页码）；原生 `fontSize` 使用设计 px，组件 `theme.typography` 使用 CSS pt。

## 检查结果

- `rules:load -- --profile generation --skin neutral-editorial-001` 成功，完整输出保存在 `rules-load.txt`。
- finalizer：1 页、16:9、包完整性通过、布局通过、字体策略通过，0 findings / 0 warnings；回执为 `build/deck.pptx.validation.json`。
- 最终导入 inspect：`inspect-final.ndjson`，包含 20 个文字对象、结构对象、备注和实际 bbox。
- 最终导入渲染：`deck-rendered.png`。视觉复核确认页首单行、页首延伸线、三行短要点均未换行，左右对应行中心线一致，VS 位于中缝，标题/正文/页脚没有相互遮挡，主体内容在 `(55,166,1170,492)` 内。
- 字体／容量／行数证据：`typography-check.json` 与 `build/slide-01.layout.json`；实际三条比较行均为单行，最长要点“查看空闲时段”“保留调整记录”“集中展示停机”各 6 字。
- 自动审计：`qa-audit.json` 为 passed（最小检查字号 12 px）。该通用审计的 QA parent 数为 0、连接器数为 0，因此不能把它当作完整语义几何证明；本页的线条为标题分隔线，结构关系由组件原生镜像与逐行 bbox 表达，并已人工核对。
- 交付文件与 finalizer 发布副本哈希一致：见 `deck-sha256.txt` / `hash-check.txt`。

## 失败与修订

- 首次调用失败：builder 将仓库根误解析为 `C:\PPagenT\experiments`，导致 `scandir ...\\experiments\\assets`。已保留 `structure-invocations.ndjson` 中的 attempt、failure 和 builder-abort 事件，随后仅修正根目录解析并重试成功。
- finalizer 两次路径检查失败：回执目录与最终文件目录约束、以及 finalizer 要求 `workspaceDir` 为真实仓库工作区。已调整为 `run-02/final/deck.pptx` 受控发布、`run-02/build` 回执，并复制同字节文件到交付入口 `run-02/deck.pptx`；没有改动内容或结构。
- 仍有一项工具限制：finalizer 报告 `native_font_rendering_verified: false`，因此记录为“字体策略与 PPTX 内字体声明已通过，原生 PowerPoint 字体渲染未由工具验证”。
