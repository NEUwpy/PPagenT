# Home：一张灰稿到杂志风的后半程试验

当前交付为 [PPTX](gray-to-magazine.pptx) 与 [最终PPT重导入预览](gray-to-magazine.png)。机器真源为 run-02/state.json，指向 run-02/candidate-1/。当前候选已经执行者看图，待用户审阅。

## 固定输入与分支

Home 已从旧基线快进到 main 的 dadabeb5f54eddbf051d016cbe7cc9a2f164666e 并推送。只读取 origin/opencode 的定义与证据，未合并该分支代码。读取版本见 input/opencode-revision.txt，灰稿定义快照见 input/opencode-*.txt。

本轮使用已有的一页“两点不足／四点感悟”范本灰稿，没有模拟新稿。input/gray-state.json 对应 outputs/gray-block-layout-20260916/reference/state.json；输入 PPT 的 SHA256 为 11fd00c95d5f159691daa2a566c463d7e0c0271febaa6554f86bcfc3d7f02330，与 Git 内归档范本完全相同。该灰稿由当时主 Agent 规划，原状态 humanReview=pending；不据本轮改变上游 M1 验收。opencode 的最新本地运行产物未随 Git 提交，不能将此页称为其最新模型产物。

## 实际流程

复用 src/runner/{chat-provider,loop}.mjs 与 tools/index.mjs，加载仓库中性 Skin、杂志风和技能选择规则。实验工具提供读取灰稿、结构检索、指南读取、候选构建及结束制作。内容仅从 grayDraft.semanticPlan 读取，普通文字不在脚本中重写。

模型负责选择图示内容的背景／输入／结果及组宽比例。原生适配器负责固定风格文字角色、文本测量、区域排放、结构执行与最终 PPT 重导入。结构从 invokeStructure 入口真正调用：convergence-many-to-one-003 使用本任务原生适配，保留三路分离输入、平滑粗汇聚曲线和唯一结果；曲线采用源 review.mjs 的 .40/.32 控制比例，采样为可编辑路径。配色使用现有 derivePrimaryTheme 与 neutralPaint，没有另加蓝色配色。

“顶层设计已完成”是图外背景，不参与原因连线。三项不足汇入落地阻力；六个原条目仍属于原来的两大分支。页首、标题与正文分别读取统一角色；制作说明、后台版面解释不进入正文。

本试验能力限于一页、灰稿的并排文字组、组内文字或多路汇聚图；只登记一个本地结构适配器。它不是任意结构、图表、图片或自由版式的完整自动路由，没有改动生产工作台或核心 Harness。图示采用精确摘引保真是本轮收窄策略，不将逐字要求推广为通用美化规则。改变归属、分页或关系仍须返回灰稿规划。

## 真实运行与失败

| 记录 | 结果 |
| --- | --- |
| rejected-manual-v0 | 拒绝。早先手写脚本未读取灰稿、未进入模型循环；把已完成设计误作第四个原因，包含制作旁白、额外蓝色和不合规则的字号。保留用于追溯，不作为当前能力证据。旧 build/ 与 evidence/ 的结构记录属于此版本。 |
| run-01 | 10轮预算耗尽，未构建。检索工具未说明英文logic合法值，模型重复返回空结果。保留原始日志；修正工具schema与描述后另开一轮。 |
| run-02 | 项目已配置 provider deepseek-v4-flash（响应自报 deepseek-flash），4轮、6次工具调用、一次构建，26,766 tokens。生成1页47个原生对象、0图片；待用户审阅。 |
| run-02/replay | 从冻结输入和模型蓝图重建，无模型调用；重导入 PNG SHA256 与 candidate-1 一致。 |

模型只读取文字与工具回执，未看渲染图片；实际图片审阅由本任务主 Agent 完成。渲染器与规则由主 Agent 编写，本轮不是不受约束的模型独立美化成功，也不是跨稿稳定性证明。

## 核验

6项定向契约测试通过；实际 PPT XML 核对全部6个条目的标题与正文仍为原生文本（run-02/package-check.json）；结构事件记录新增原生图形；图片重导入已查看，三路曲线接入唯一结果，没有将背景纳入因果输入。slides_test.py 对最终候选报告无越界；框间文本重叠检查为0。这些检查不替代用户审美验收。

## 重跑

先按 presentations 技能设置工作区运行时 RUNTIME_NODE / RUNTIME_NODE_MODULES / RUNTIME_BIN_DIR，沿用项目现有 provider 配置。不要改密钥或把配置入库。

```powershell
& $env:RUNTIME_NODE experiments/home-gray-magazine-20260919/run-harness.mjs experiments/home-gray-magazine-20260919/run-new
& $env:RUNTIME_NODE experiments/home-gray-magazine-20260919/run-harness.mjs experiments/home-gray-magazine-20260919/run-02 experiments/home-gray-magazine-20260919/input/gray-state.json --replay
& $env:RUNTIME_NODE --test experiments/home-gray-magazine-20260919/visual-contract.test.mjs
```

下一步先由用户看这一页的内容与风格，再按反馈调整后半程。图片、图表及第二类结构的路由只在真实灰稿需要时扩展；本页不能虚构数据或添装饰图来测试调用数量。
