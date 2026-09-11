# A / C / B 提示与内容包等价性复核

> 主任务补充核验：下文“B”主体是包内静态差异，不能全部当成本轮已执行路径。`B-split/input-record.md` 明确记录实际为 generation、完整视觉制作模式；`rules/index.json` 的generation没有加载执行/内容导演.md和执行/视觉选择.md。因而初模默认与旧selector限制只能列为包内潜在歧义，未证明造成B本轮退化。当前能确认的实际约束包括generation中的页面组合流程；不能用“包里存在”替代“本轮使用”。

本复核只读取以下输入：`A-long/input/prompt.md`、`C-staged/input/00-05.md` 与 `manifest.json`、`B-split/input` 当前内容包及三组 `input/manuscript.md`。没有读取或修改 G，也没有读取旧成品、外部 REVISE 结论或其他实验组产物。本报告接受本轮用户审美基线：A > C > B；该排序作为评价基准，不用旧外部结论否认。

## 已确认的字节关系

| 对象 | 字节数 | SHA-256 |
|---|---:|---|
| `A-long/input/prompt.md` | 11,399 | `40e516ef029cab81c041fd91add28d03cfac36af2c8e10cfc663618236b51ad2` |
| `C-staged/input/00.md` 至 `05.md` 原始拼接 | 11,399 | `40e516ef029cab81c041fd91add28d03cfac36af2c8e10cfc663618236b51ad2` |

独立按 `00.md, 01.md, 02.md, 03.md, 04.md, 05.md` 读取并原始拼接后，`byteEqual=true`。`C-staged/input/manifest.json:1-7` 也记录了同一 SHA、同一 chunk 顺序及 `concatenation_byte_identical: true`。因此 A→C 是纯文件拆分，没有文字新增、删除、改写或顺序变化。

三组原稿也相同：

- `A-long/input/manuscript.md`、`C-staged/input/manuscript.md`、`B-split/input/manuscript.md` 均为 11,482 字节，SHA-256 均为 `7b97aa070cc6e2ced362d6a31c0e9bd6bd334850a858c142f2512d7743a6a288`。

这排除了本轮 A/C/B 产物之间由稿件内容版本不同造成的解释。

## A 与 C：内容相同，读取行为可能不同

`A-long/input/prompt.md:5-80` 是一个线性上下文，顺序为内容与设计目标、视觉语言、先编排再绘制、可用排法、输出检查。`C-staged/input/00-05.md` 是完全相同的字节，只增加了文件边界；`00.md:3` 保留了“历史实验快照，不再作为当前生成入口或同步规则”的退役说明。

因此，只有在执行器实际采用阶段读取、遗漏某 chunk、重复某 chunk、或把阶段边界当成额外指令时，A 与 C 才会产生运行时行为差异。文件本身没有新增或删除规则。C 的 `manifest.json` 只规定拼接顺序和校验，不包含比 A 更多的视觉规则。

## B：不是纯拆分，而是运行协议与规则包

### 会改变输出模式的新增默认值

最强的行为差异是 B 把“初模”和“完整视觉制作”分成不同模式，并给初模设了默认倾向：

- `B-split/input/package/AGENTS.md:7`：当前默认交付“原稿与黑灰白布局初模对照 PPT”。
- `B-split/input/package/README.md:23-25`：按包内工具加载规则，并明确“当前初模不套品牌外壳，不自动加载完整 Skin 美化流程”。
- `B-split/input/package/docs/工作流/正式生成/生成任务提示词.md:9-19`：M1 是“已填入真实内容的整页初模”，要求白底、黑灰文字、最少功能性线条或形状。
- 同文件 `:27-29` 才进入“完整视觉制作模式”，而 `:33-55` 另写完整成品流程。

A/C 的原始提示从一开始就要求“原生可编辑 PPTX，完成逐页渲染与视觉修正”（A `prompt.md:5`，C `00.md:5`），并在 `02.md:19-34` 直接规定纸色、浅承载面、字体和砖红强调。B 的 M1 默认会把这些完整视觉身份推迟，可能产出黑灰初模而不是 A/C 的中性杂志成品。这是规格层差异；本报告不把单次 A > C > B 样本进一步归因成某个结构化或注意力机制。

### B 新增持久状态、动态上下文与读取顺序

- `B-split/input/package/AGENTS.md:5` 要求先读 `README.md`、`角色与提示入口.md`、`运行流程.md`、`产物审查.md`，再按包内正文工作。
- `B-split/input/package/角色与提示入口.md:20-27` 把任务输入、共享执行协议、generation 规则、Skin/排版、按需能力上下文、审查与恢复拆成不同层；`:41` 明确用动态上下文和工具反馈替代越来越长的初始提示。
- `B-split/input/package/运行流程.md:38-42,79-96` 引入 `runs` 持久状态、候选/渲染/审查/失败返回与中断恢复；`:81-85` 要求内容导演、视觉导演、工具和审查形成多轮闭环。

这些内容不在 A/C 的单文件提示中。它们改变有效上下文的组成和顺序，即使最终加载的部分视觉规则与 A/C 相似，也不能称为字节等价。

### B 收紧工具、坐标与候选能力边界

- `B-split/input/package/rules/执行/视觉选择.md:3-5,7,15,25` 把正式视觉入口定义为候选选择器，受输入候选卡和输出 Schema 限制；禁止自由绘图，`selectionMode`、候选 ID、可派生字段和合法文字区域决定可选范围；输出不得包含坐标、字号、间距、CompositionPlan、HTML/CSS 或内容细化。
- `B-split/input/package/rules/执行/内容导演.md:7-19` 强制结构化的 H1 页面、H2 主节点、pageMetadata 与编译回写；`:45-50` 限制 H2/body 容量，并禁止输出 assetId、familyId、variantId、Structure Group、容器、坐标、颜色、图标和组件槽位。
- `B-split/input/package/rules/页面组合.md:3,13-22,49-65` 要求先写 `composition-intent.json`，再由 `resolveComposition` 按 `bodyFrame`、最小容量契约和 row/column/grid 解析区域；builder 必须使用传入 group frame，不能在外部另写组级坐标。`annotate` 锚点未实现时明确拒绝。
- `B-split/input/package/rules/排版.md:3,7,11-18` 将页面绘制权限和正式候选选择器权限分开，要求局部结构按技能选择顺序调用，且全路径服从 Skin、排版与交付要求。

A/C 只要求按内容关系选择结构、区域与媒介（A `prompt.md:10-13,38-50`；C `01.md:4-7`、`03.md:3-15`），没有候选 ID、Schema、composition-intent、最小容量契约或禁止坐标输出的正式入口。这是实质的自由度与角色约束差异。

### B 保留双导演，但把角色切成协议边界

- `B-split/input/package/角色与提示入口.md:5-12` 保留内容导演与视觉导演，总控承担状态、预算、工具调度、审查和恢复。
- `:29-33` 要求每个角色交代职责边界、输入、判断、工具、交付证据和失败返回；内容导演与视觉导演共同形成页面职责、实文、宏观区域和阅读关系，但结构/图示/图表不能接管分页。
- A/C 的角色是一个负责整套演示稿的设计执行者（A `prompt.md:5`；C `00.md:5`），没有上述结构化角色协议或 selector Schema。

因此 B 同时增加了“可持续运行”的职责分工和“正式视觉选择器不可自由绘图”的约束，不能把它看成 A/C 的文件拆分。

### B 的 Skin 色彩来源和数值发生了可见变化

A/C 直接规定：

- 纸色 `#F5F4EF`、浅承载面 `#EEECE5`、强文字 `#20201D`、正文 `#4B4A45`、辅助 `#85837B`、分隔线 `#D8D5CC`、强调 `#A35D4F`（A `prompt.md:19-21`；C `02.md:5-10`）。

B 改为从 Skin 资产和派生调色入口读取：

- `B-split/input/package/rules/skins/中性编辑排版.md:8,14-16,21-31`：字体来自 `asset.json`，唯一颜色输入是 `mainColor`，用途色由派生逻辑生成。
- `B-split/input/package/rules/skins/中性编辑排版.md:23-29` 给出的当前值为浅承载 `#EEECE4`、强文字 `#201F1D`、正文 `#4D4A42`、辅助 `#84827A`、分隔线 `#D7D4CA`、强调 `#A35D4F`。
- `B-split/input/package/assets/主题/中性编辑排版-001/asset.json:28-33` 确认字体为 Noto Serif SC / Noto Sans SC，`mainColor` 为 `#F5F4EF`。

也就是说 B 的字体名称与 A/C 一致，但多数颜色 token 不是同一字节值，且颜色由 Skin/派生逻辑间接决定。另有一个可验证的包内缺口：Skin 文本 `中性编辑排版.md:14` 引用 `src/runtime/skins/primary-tone-palette.mjs`，但该路径在 B 当前输入包中不存在；这会影响实际调用该入口时的可运行性，但不能据此断言 B 样本一定走过或未走过该路径。

### B 的包清单与入口存在性不完整

- C 有明确的 `C-staged/input/manifest.json`，记录 chunks 和源 SHA。
- B 当前 `input` 下没有 `manifest.json`，`package` 根目录也没有 `内容包清单.json`；这是按当前文件清单和路径存在性检查确认的。
- 但 `B-split/input/package/README.md:31` 写明“`内容包清单.json` 记录同步文件及 SHA256”，`README.md:11` 又引用 `任务/新任务入口.md`，该路径在当前包中同样不存在；`README.md:23` 则要求使用 `node src/tools/load-rules.mjs`，该工具文件存在。

这些是输入包的可复现性/入口差异，可能改变实际启动行为；本报告不把它们夸大为已经发生的样本故障。

## 规则新增、删除与冲突的结论

- A→C：零文字新增、零文字删除、零规则冲突，只有文件边界和 manifest 校验。
- A/C→B：新增了 M1 黑灰初模默认、完整视觉模式分层、持久状态/恢复、composition-intent/容量契约、候选 Schema 和 selector 禁止自由绘图，以及 Skin 派生色彩来源。以上均有 B 文件原句和路径支持。
- A/C 的中性杂志审美规则大部分在 B 的 `rules/skins/中性编辑排版.md` 与 `rules/排版体系/杂志风.md` 中被重述，诸如 56 边距、25/21/17/15/48/58 字号角色、章节编号、线条避让、自然高度、不要固定卡片墙和按内容选择页型，未发现同等级别的直接删除。
- B `rules/排版体系/杂志风.md:3` 额外写入“分离后 Luna high 首轮未通过视觉验收”的历史元叙述。它是 B 上下文新增文字，不作为本报告对 A > C > B 的反证或审美裁决。
- 仅凭 A/C/B 一次生成样本，不能把差异归因于“结构化导致”“注意力下降”或其他单一机制。能确认的是：B 实际给执行器的模式、读取顺序、动态上下文、Skin token 来源、工具入口和角色自由度都已改变。

## 面向 Harness 的行为基线

如果目标是达到本轮用户确认的 A 效果，应该把 A/C 的中性杂志完整视觉模式作为回归基线，同时保留 B 中对状态、工具反馈、审查和恢复有帮助的运行机制；B 的 M1 黑灰初模应只在用户明确要求初模时启用，正式完整 PPT 不能默认停在该模式。候选 Schema、组合解析和角色约束需要与完整视觉模式一起验证，不能用它们的静态存在替代实际渲染结果。
