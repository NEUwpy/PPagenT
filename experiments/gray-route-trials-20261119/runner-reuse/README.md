# 灰稿运行与模型分工试验

2026-11-19。用仓库内的两份模拟单页稿检查旧运行器、短 JSON 请求和现有 JEV 对接。浏览器布局和原生 PPTX 的证据见本轮其他实验。过程和结果保存在 [运行记录](runs/2026-11-19T15-20-12.787Z/summary.json)。

## 实测

| 路径 | 输入与结果 | 发现 |
| --- | --- | --- |
| 一次结构化生成 | `options` 3.39 秒 / 843 tokens，`services` 3.47 秒 / 875 tokens。两次 JSON 可解析，均通过旧 `validateSemanticPlan`。 | 原稿关键要求和各条实体文字保留，额外生成了重复的概览或标题组。这里只检查实文计划，未运行该计划的渲染和独立审稿。[上线方案](runs/2026-11-19T15-20-12.787Z/one-shot-options.json) · [园区服务](runs/2026-11-19T15-20-12.787Z/one-shot-services.json) |
| 旧灰稿 Agent 工具循环 | 同一 `services`，8 轮后 blocked，22.71 秒，131,016 total tokens，含 112,512 前缀缓存命中 tokens。 | 首轮在 `check_plan` 入参 `plan` 中放了完整 JSON，工具 schema 拒绝该额外字段。随后反复在非法入参与空正文、空入参之间切换，未进入语义审稿或排版。把首轮误放进工具参数的计划单独读出，旧语义校验也通过。瓶颈出在交互提交口。两路提示词与职责不同，数字仅描述本次运行。[循环回执](runs/2026-11-19T15-20-12.787Z/legacy-loop-services.json) · [离线回放](runs/2026-11-19T15-20-12.787Z/semantic-replay.json) |
| 现有 JEV 调用 | 分别用 `options`、`services` 冻结分组输入，官方 Decisions API 均返回 HTTP 401。 | 核实了当前配置调用结果和请求形状。JEV 的关系判断、候选排序质量与用量待独立验证。[上线方案](runs/2026-11-19T15-20-12.787Z/jev-options.json) · [园区服务](runs/2026-11-19T15-20-12.787Z/jev-services.json) |

DeepSeek 两路均使用现有配置请求 `deepseek-v4-flash`，服务端响应模型名为 `deepseek-flash`。JSON 请求另设 `response_format: {type: 'json_object'}`，返回文本随后走程序解析和校验。试验将单请求和全程时间限定，未做服务性能或费用对比。[DeepSeek JSON 输出接口](https://api-docs.deepseek.com/guides/json_mode/)

## 能复用的边界

- **来源与审稿。** 保留来源抽取、覆盖检查、可见位置、逐字引文、内容指纹与无效版本拒绝。离线回放以真实计划为起点，程序拦住未知来源 ID；把“需事先获得授权”改成“无需事先获得授权”，或把紧急电话从强制改成可选，两个改写仍通过程序语义计划校验。将独立事实复核放在冻稿前，要求指出改动的事实、作用范围、原文和上屏位置。[源稿回放](runs/2026-11-19T15-20-12.787Z/semantic-replay.json) · [现有审稿证据校验](../../../src/runner/gray-semantics.mjs#L477)
- **候选与绑定。** 保留“只绑定登记候选、容量失败不重交同版、保持已冻结文本”的规则和负例。旧候选测量依赖估字宽的 `grayBodyLayout`／`fitGrayText`，图示能力以占位高度估算。`options` 实测有 7 个几何候选，真关系 `comparison` 绑定全部拒绝；换成错误标签 `parallel`，7 个均能绑定。`services` 的 5 个几何候选只有主辅带支持 `support`。新编排应从已审关系和有明确能力声明的组件实例生成合法候选，交给浏览器测量内外实际几何。[受控布局回执](runs/2026-11-19T15-20-12.787Z/controlled-layout.json) · [旧候选与绑定](../../../src/runner/gray-layout-selection.mjs)
- **运行入口。** 新 main 已接通原稿规范化。旧工作台入口另外挂载 `runGrayAgent`，提前构造 JEV、将 `check_plan`、语义审稿、渲染和完成交给模型调度。另一个顺序式 `runGrayDraft` 每轮仍分别调语义、表达、审稿及布局。优先复用 provider 传输、阶段记录、指纹和检查函数，改用程序固定阶段推进，按具体错误回到实文或编排。一次模型请求只返回实文分组、优先级、阅读顺序、关系和已知来源；容量修订局部重下发，通过复核后生成新的内容版本。[main 入口](../../../src/workbench/main-flow.mjs) · [旧工作台入口](../../../src/tools/serve-production-workbench.mjs#L623) · [旧顺序式运行器](../../../src/runner/gray-draft.mjs#L441)
- **JEV 的可选位置。** 旧接法逐页同时重判关系与选择候选，输入只有候选家族、方向、分配、支持关系，无各候选的框、内容余量或预览，候选 choice 缺少 `none`。先以确定性规则比较已编译候选。只有质量相近且存在阅读次序、层级或作用范围歧义时，才试附预览与必要测量的受限评分。固定提供方版本，以人工标注的页对比程序基线、同一生成模型的独立复核、JEV，记录关系错判、拒答、改选带来的实质改善、调用开销及复现率。当前 API 401 的结果不参与质量对比。[旧 JEV 请求](runs/2026-11-19T15-20-12.787Z/jev-options.json) · [OpenRouter Decisions API](https://openrouter.ai/blog/insights/what-is-jev/)

## 复现

从仓库根目录运行。默认只重复受控布局校验。`--live` 使用现有配置，对固定的两份合成稿件请求官方 DeepSeek 和 OpenRouter；重新运行会创建一份带时间戳目录。离线回放直接利用保留的真实响应。

```powershell
node experiments/gray-route-trials-20261119/runner-reuse/probe.mjs
node experiments/gray-route-trials-20261119/runner-reuse/probe.mjs --live
node experiments/gray-route-trials-20261119/runner-reuse/replay-semantics.mjs
node --test --test-concurrency=1 tests/gray-layout-selection.test.mjs tests/jev-provider.test.mjs tests/runner-chat-provider.test.mjs tests/source-fidelity.test.mjs tests/workbench-main-flow.test.mjs
```

最后一条既有测试共 20 项通过。扩到 `gray-agent-flow.test.mjs` 和 `gray-cost-guards.test.mjs` 后共 73 项，72 项通过。失败项为 `gray-agent-flow.test.mjs:836` 的现有提示词字面断言，要求的短句未出现在当前 Agent 提示词。
