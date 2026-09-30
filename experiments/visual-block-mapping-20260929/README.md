# 组内视觉块映射：第一轮可调用实现

2026-09-29。建设证据，非模型自动规划、用户验收或资产正式晋升。承接[能力盘点](../../docs/架构/现有能力盘点与首批建设.md)第 1 项，保留旧基线与全部本轮失败。

## 本轮实现

`gray-plan-3.pages[].visualMapping` 是可选的有限绑定字段；不另建一套计划格式。程序从原始 blocks 取文案、来源、标签和附注，拒绝正文/坐标注入、遗漏、重复、跨组引用及顺序改变。组内并列/独立内容可选横向或纵向；横向按等宽内容列测量，纵向按实文高度排列。一条 `scope:group` 共同说明可在组首或组尾全宽显示，附注留在所属条目内，原组标题只出现一次。

调用链：`runGrayAgent` → `validateSemanticPlan` / `semanticPages` → `bindVisualBlocks` → `measuredLayoutCandidates` → `bindSemanticLayout` → `validateGrayPlan` → `grayBodyLayout` → `renderGrayDraft`。测量与原生渲染共用排版代码；映射进入语义审稿输入和指纹。回放校验派生绑定与原内容一致，拒绝偷偷改派生块正文。没有映射的旧计划沿用原行为。

已接入灰稿生产入口；不是孤立的 Schema 或实验渲染器。提示只补充程序实际接受的字段、范围和失败方式，没有加入样稿答案。模型配置未改。

## 产物与验证

- [固定输入](fixed-plan.json)、[原稿](source.md)、[构建脚本](run.mjs)。两页均为明确标注的模拟建设内容：服务项目横向分区＋尾部共同时间，记录要求纵向分区＋首部共同访问条件。
- [最新灰稿 PPTX](run-03/gray-draft.pptx)，[第一页](run-03/preview/slide-01.png)、[第二页](run-03/preview/slide-02.png)。PPTX 已重导入预览，原生文字完整性通过；实际查看两页，未见明显裁切或重叠，短稿外框留白仍较多，不视为视觉定稿。
- `run-01/02/03` 均调用正式 Agent 入口、测量选择和交付协议。模型标识明确为 `scripted-fixed-plan-construction`：选择和审稿回执来自脚本，逐字引用仅检查这份固定样本，**不证明独立语义判断**。三份运行都保持 `awaiting-user-review`。
- [重复回放核对](replay-verification.json)：三次计划 JSON、组内实际测量结果和两张重导入 PNG 的 SHA-256 分别一致。不宣称 PPTX 字节相同或模型一万次新判断一致。
- [纯文字交接脚本](handoff.mjs) 通过 `loadGrayState`、正式工具 `read_catalog/upsert_page_plan` 和 `compileDeck` 构建 [中性 Skin 样本](handoff-04/deck.pptx)。两页正文的 label/body/note 均在原生文字中；[字号、几何、换行审计](handoff-04/verification.json)通过。美化坐标是工程固定输入，非模型生成或已建成的确定性风格能力。
- 本轮实际预览发现并修复中性 Skin 长标题挤入窄页眉的问题：测量后转为全宽标题，下移分隔线；超出全宽单行容量则返回规划，不删标题。

## 失败和修复记录

- `handoff-01/failure.json`：灰稿 Agent 发布候选时未把计划的 deckBrief 写回状态，成稿封面读取 null。已修复发布；历史状态从已交付计划恢复同一 brief，两处都没有则明确拒绝。
- `handoff-02/`：已导出，但几何审计发现纯文字页没有 QA 契约，封面标题换行；实验文本检查直接查 XML 连续串产生断行误报。修复为解析所有原生文本节点后比较，补齐实际区域/内容框的几何见证。
- `handoff-03/`：正文与几何已通过，保留封面标题换行失败。`handoff-04/` 修复后重验。
- 旧灰稿交接按 section 序号对应原 blocks，遇到附注合段会错位。现按原始 block ID 绑定；整组图示使用已分配正文区域，嵌入图示只使用蓝区。原 `gray-regions` 失败断言原样保留，现通过。
- [首次扩展回归](tests.txt) 192 项：191 通过，1 项失败。失败为 `gray-agent-flow.test.mjs:831` 要求提示词包含一条 HEAD 运行时已不存在的逐字句子；未为使测试变绿增加提示。它与映射执行失败不同。引擎变动前最终回归 `final-regression-tests.txt` 共 199 项，198 通过、同一旧逐字断言失败；[最后定向检查](final-focused-tests.txt) 23 项通过。不是全仓全绿结论。

## 能力边界与下一项

目前支持**同一纯文字语义组内**的平级或独立视觉块和一条共同说明带。跨组共同范围、对象×维度比较、条件分支、含局部图示组的拆分不在此实现内；关系真实性仍需语义审查，程序只能拒绝不支持的声明，不能识破模型把比较谎称并列。整组图示不拆分。多图示成稿仍明确返回缺口，零或一个图示交接才被接受。

初版交接使用旧自由坐标接口，不能强制保持组内映射拓扑/共同作用范围。随后已新增下文受限文字程序；旧接口仍保留兼容，不能把它的自由方案当作程序支持范围。下一项先恢复当前引擎实际字号/行盒证据，再补多组/长短文本视觉样本及真实模型选择；比较、顺序能力按盘点清单随后扩展。大学 Skin 模板与 note-card 基线失败本轮未修，不能据中性 Skin 样本宣布两套 Skin 全通过。

## 复现

```powershell
node experiments/visual-block-mapping-20260929/run.mjs run-new
node experiments/visual-block-mapping-20260929/handoff.mjs handoff-new
node experiments/visual-block-mapping-20260929/verify-replay.mjs
```

前两条使用不存在的新目录，保留此前证据；handoff 固定消费 `run-01/state.json`，同时覆盖历史 brief 恢复路径。记录的是本机现有 PPT 引擎/字体环境，未联网调用生成模型，未改变默认模型、提交或推送。


## 继续建设：受限纯文字成稿程序

`src/render/gray-text-program.mjs` 的 `source-text-v1` 已接入 `read_catalog`、工具 Schema、`upsert_page_plan`、实际编译与 QA。模型每组只选 `{itemId,reason,program:"source-text-v1"}`，不能传坐标、复制正文、改方向或追加装饰。整页纯文字/text+note 才支持，图示及混合路径拒绝；原始区域与视觉块映射重验后消费。标题 26px，正文整页选可承载的 22/20/18px，附注 16px，字体/颜色用 Skin 角色。共用灰稿测量程序，不另建求解器，容量不足返回规划。状态为 construction-candidate，未晋升或用户验收。

- [无坐标请求与正式工具调用脚本](program-handoff.mjs)、[原生 PPT](program-03/deck.pptx)、[重导入服务页](program-03/reimport-preview/slide-02.png)、[重导入记录页](program-03/reimport-preview/slide-03.png)。已实际查看全部三页；两个正文页标签、附注与共同范围保持，未见明显裁切/重叠。封面只带项目标题，是现有生成线产物；整体仍是稀疏建设样本，不作商业成稿验收。
- [77 项相关检查](program-regression-tests.txt)通过：映射和程序绑定、横纵布局、多个原组、局部/共同条件、长文容量拒绝、坐标/媒介/派生正文注入反例、Skin 文字角色和 v5 证据缺失返回。没有重跑真实模型。
- `program-01/check-result.json` 保存首次真实编译失败；本轮继续时同一依赖路径的引擎已输出 `openai.presentation.layout/v5`（当前包版本 2.8.77），早前 `handoff-04` 是 v4。已核对包内文档并用 `detail:full` 导出 [探针](program-01/full-layout-probe.json)，依然没有旧 `resolvedFontSize/textLayout.lines`。未修改或安装依赖，不能确定其变动由谁触发。
- 审计器现兼容 v5 的 `position`，几何检查可运行；缺少实际字号和行盒时明确返回 `missing-rendered-font-evidence` / `missing-rendered-line-evidence`，**不以声明字号、输入换行或测试通过冒充实际排版**。`program-03/check-result.json` 的正式检查仍为 false；[验证摘要](program-03/verification.json)明确保留此阻塞。`program-02` 保留测试脚本未展开封面 issues 列表的失败，脚本已修复，只允许上述证据缺失继续导出人工审阅资料，不放行正式交付。
- 早前 v4 条件下通过的 `handoff-04` 和三次灰稿回放证据继续保留；它们不能宣称在 v5 环境已经再次通过。M1/M2 仍未通过。

复现程序样本：`node experiments/visual-block-mapping-20260929/program-handoff.mjs program-new`。运行会保存正式失败状态和可查看产物，不调用 finish_visual。下一步首先修复实际排版证据供应接口；拿到真实证据后重新验证，而非继续扩大提示或放宽门禁。

最终接线检查曾因把程序常量跨模块导入 Schema 触发循环初始化错误（program-final-tests.txt）；已撤回该导入，保留 Schema 枚举边界，修复后 program-final-tests-repaired.txt 的 22 项通过。该错误及修复均保留，不覆盖失败日志。
