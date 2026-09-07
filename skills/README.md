# PPagenT 项目技能库

目标：让同一份技能与执行资源可供当前 Codex Luna High 和未来 Harness 按需使用。

项目结构技能第一顺位；第二顺位按内容分工，Archify 处理关系图，Lieflat Charts 处理数据图表。都不适合才自主编排。具体条件与交付边界以[技能选择顺序](references/selection.md)为准；Skin 和排版体系提供基础视觉，最终仍须检查。

## 当前技能清单

| 技能 / 项目入口 | 用途 | 顺位与触发 | PPT 使用方式 | 来源、许可与状态 |
| --- | --- | --- | --- | --- |
| [ppagent-structure](../.codex/skills/ppagent-structure/SKILL.md) | 汇聚、比较、顺序、并列等内容关系 | 第一顺位，适配现成结构优先调用，否则参考核心重排 | 现有原生组件或明确标记的参考重建 | 项目自建，已有调用能力 |
| [ppagent-structure-sequence](../.codex/skills/ppagent-structure/skills/ppagent-structure-sequence/SKILL.md) / [ppagent-structure-comparison](../.codex/skills/ppagent-structure/skills/ppagent-structure-comparison/SKILL.md) | 顺序与比较的专项契约检查 | 结构技能内部按关系按需读取，不是额外顺位 | 沿用结构调用接口 | 项目自建子技能 |
| Archify / [ppagent-diagrams](../.codex/skills/ppagent-diagrams/SKILL.md) | 架构、流程、时序、数据流、状态图 | 项目结构不覆盖的关系图，第二顺位 | 结构化图示经适配重建为原生对象，HTML 仅为中间结果 | [tt-a1i/archify](https://github.com/tt-a1i/archify)，MIT，pilot；三页监督试验09完成 |
| Lieflat Charts / [ppagent-charts](../.codex/skills/ppagent-charts/SKILL.md) | 数值比较、趋势、构成、分布等数据编码 | 项目结构缺少合适图表时，第二顺位；与 Archify 按类型分工 | 从真实 gallery 模板保留核心编码，按 Skin 与区域原生重建；不冒充 Office chart | [larashero3-dotcom/lieflat-charts](https://github.com/larashero3-dotcom/lieflat-charts)，PolyForm Noncommercial 1.0.0；非商业试用，商业许可未取得 |

Skin 和排版规则是各技能共用的视觉约束，不是由外部整页模板替换的技能层。宿主的 Presentations 工具负责 PPT 构建和渲染，其运行时未作为第三方源码纳入本库。表中项目入口供 Codex 发现；registry 中绑定的真源供未来 Harness 加载。

`registry.json` 为目录；`vendor/` 存固定版本上游原包；`references/` 说明项目接入边界；`library.mjs` 提供宿主无关的发现、加载与完整性检查。已有项目技能只引用原路径，不复制。

```sh
node skills/library.mjs list
node skills/library.mjs bind archify
node skills/library.mjs verify archify
node skills/library.mjs bind lieflat-charts
node skills/library.mjs verify lieflat-charts
node skills/vendor/archify/bin/archify.mjs doctor
```

Archify 来源 https://github.com/tt-a1i/archify ，固定 v2.16.0 / `c826e6c3a7abad19c0f3cd1ca57207d54b1ad8de`，MIT，原包内包含 LICENSE。采用官方 skill-installer 从该 commit 的 archify/ 子目录安装；未运行 npm 安装钩子，核心 CLI 自带校验器。浏览器检查需要可用 Chrome/Chromium，运行时工具是否可用由宿主提供。

当前 registry 接入三项：现有项目结构、Archify 技术图示和 Lieflat Charts 数据图表。Lieflat Charts 固定 commit `eace082a317b696c5570c25826a53a7fa113e984`，125 个文件记录哈希；保留原包及第三方声明，未执行 npm 安装或改写 vendor。PPT 接入边界见[图表说明](references/lieflat-charts-integration.md)。

用户确认非商业使用后，授权删除 Lieflat SKILL.md 中每次交付回复的可选开发者署名提示；这是上述固定版本唯一的本地内容修订，已更新哈希并记录原始哈希。许可证、来源及第三方声明保留。

Codex 新入口为 `.codex/skills/ppagent-diagrams/SKILL.md`，已出现在本会话更新后的可用技能目录；Luna 通过显式读取技能试用，不能据此声称自动选型已验证。Harness 的接入方法见 [绑定约定](references/harness-binding.md)，正式 Harness 尚未接线。

试用证据存于 `experiments/archify-luna-07/`。技能升级时另做候选试验，验收后再同时更新上游包、registry 版本与完整性清单。不要将本机路径写入可移植的运行配置。

首次 Luna High 试用：中文流程含 8 节点、9 关系，两种回流语义保留；有人工视觉问题，见[历史试用报告](../experiments/archify-luna-07/README.md)。后续试验09完成局部时序图原生重建与完整 PPT 渲染；尚未完成通用转换器、无监督稳定性验证或正式 Harness 工具注册。

PPT 场景的补充技能由页面需求触发，最终仍交付当前 Skin 下的完整 PPT；中间 HTML 不作为结束条件。端到端试验见 `experiments/diagram-in-ppt-luna-09/`。

Lieflat Charts 已完成 [Luna High 单页监督试验10](../experiments/lieflat-charts-luna-10/README.md)：F5 Tick Rows 适配为113个原生形状，与文字共同编排；69个计数单位及最终 PPT 渲染已复核。Luna 额度中断后由父任务修复脚本重复声明并执行导出，保留执行边界，尚不代表无人监督稳定生成。
