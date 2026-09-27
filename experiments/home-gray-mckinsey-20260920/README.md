# Home：同一张灰稿的麦肯锡排版试验

当前成品：`gray-to-mckinsey.pptx`；预览：`gray-to-mckinsey.png`。有效运行真源为 `run-02/state.json`，用户视觉验收仍为 pending。

上一版杂志风已提交并推送至 Home 的 `c6080075`。本轮继续在 Home 上，以同一份 `../home-gray-magazine-20260919/input/gray-state.json` 为输入，不改上游灰稿，也不替换上一版证据。

## 本轮完成

复用现有 chat-provider / tool loop，让模型读取灰稿、检索结构、读取 guide，再选择主旨句、短章节名、内容证据、组宽比例与三路汇聚的内容分解。run-02 为 4 轮模型请求、5 次工具调用、1 次构建；配置模型为 deepseek-v4-flash，响应自报 deepseek-flash。

使用 `createNortheasternUniversityStarter` 复制现有大学模板正文页并应用既有替换配方。大学 Skin 外观、校徽、蓝色主旨条与底线沿用模板；正文仅在 `(55,166,1170,492)` 安全区内排放。主题 XML 在导出后恢复源文件字节，再重导入检查。字体、色彩及 21/18/14 正文角色来自既有 Skin 和大学麦肯锡配置。

主旨句由模型根据原文概括为“变革落地仍存三项短板，合规基础管理亦待压实”，保留待改善语气。两点不足与四点感悟继续作为两个拥有各自内容的分支，没有虚构一对一因果对应。普通正文及标签逐字来自灰稿，六项均核对最终 PPT XML 中的原生文本。

灰稿明确指定的图示使用 `invokeStructure` 实际执行 `convergence-many-to-one-003`：已完成顶层设计是图外背景，三个障碍汇入唯一结果。该结构尚未登记大学专用 `preserved-design` 执行，本轮沿用杂志试验的局部原生迁移适配，接入共享大学色阶和文字角色，恢复输入侧色标及深色结果面。保留原设计的分离输入、平滑粗曲线、单一结果与 .40/.32 控制比例。此为明确的实验入口例外，不修改大学正式入口，不宣称完整复制源设计的阴影、描边等全部细节或正式适配验收通过。

## 失败及修正

- run-01 的技术构建成功，但实际看图发现原灰稿长页名在继承章节框中换行，压到蓝条；输入节点间距过窄。该版本保留，视觉不通过。
- 增加 1–4 字章节名约束，节点之间至少 8px 净距，图示高度按真实文字增加。另开 run-02，未覆盖首版。
- run-02 实际重导入图片已检查：章节单行、蓝条主旨单行、正文六项归属清楚、三个输入彼此分离并接入结果，没有把已完成事项画成障碍。

## 验证与边界

11 项定向测试通过（含原灰稿契约6项及本轮5项），最终 PPT 有52个原生形状；正文页未增加图片，身份素材仍继承自模板。完整内容、模板主题字节、母版及版式保留检查见 `run-02/package-check.json`。重放与几何检查记录见 `run-02/verification.txt`。这些证据不代替用户视觉验收。

本轮仍是一张既有灰稿、相邻分支文字组、一个局部汇聚图的代表页。未打通任意灰稿自由排版、任意结构、图片／图表路由或生产工作台；模型未查看图片，主 Agent 承担最终看图修正。新主旨句的语义充分性需要人审，不因 evidence ID 存在而自动判真。

## 重跑

按 Presentations 技能设置 RUNTIME_NODE / RUNTIME_NODE_MODULES / RUNTIME_BIN_DIR，并将 MCKINSEY_PYTHON 指向同一工作区依赖包提供的 Python；沿用本地 provider 配置，不将密钥或配置入库。

```powershell
& $env:RUNTIME_NODE experiments/home-gray-mckinsey-20260920/run-harness.mjs experiments/home-gray-mckinsey-20260920/run-new
& $env:RUNTIME_NODE experiments/home-gray-mckinsey-20260920/run-harness.mjs experiments/home-gray-mckinsey-20260920/run-02 experiments/home-gray-magazine-20260919/input/gray-state.json --replay
& $env:RUNTIME_NODE --test experiments/home-gray-mckinsey-20260920/visual-contract.test.mjs
```
