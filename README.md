# PPagenT

PPagenT 是一个面向固定组织场景，使用受控视觉能力可靠生成原生可编辑 PowerPoint 的系统。

目标是让 Agent 依据内容和 Skin 的排版规则，直接编排原生文字、形状、线条和真实媒体；已有结构与 Skills 作为可选的经验复用。程序负责测量、生成和具体问题反馈，Agent 在预算内局部修订。固定文字模板和庞大版式库不是前置条件。

> Agent 按规则编排；原生工具负责执行；已有资产按需复用。

## 当前里程碑

`Shell + Content Frame`、HTML 单源 Structure Group、Native PPTX 编译、资产看板和双导演正式线已经形成可运行基础。当前正式库有 35 个 Structure Group，覆盖 20 类 Logic 中的 18 类。结构资产的第一轮集中建设到此基本结束，默认冻结扩库。

当前分支探索一个 PPT 专用 Harness：一个 PPT Agent 分内容、视觉两个独立上下文，通过持久化 Deck Project 交接。PageBrief 保存语义，Layout 编排区域，区域 PageView 绑定展示文案与来源，Text / Media / Structure 按信息需要使用。模型默认无图片输入，通过网格、文字占用与几何反馈局部修正。正式入口尚未完成迁移。

本机 codex/penguin-harness-v2 验证有限能力下的稿件驱动闭环；另一台电脑的 main 丰富版式、结构和排版规则，见[分支分工](docs/分支分工.md)。

已完成一轮[空白 Luna high 的 Codex Skill 试做](experiments/codex-skill-pilot/README.md)：通过结构主 Skill/逻辑子 Skill 查找并真实调用两种现有结构，文字直接按规则排放，反馈修订后生成 7 页原生 PPTX。先在 Codex 验证，再移植 Harness；本轮不代表正式入口已迁移或产品成本已验证。

当前状态与历史统一见[更新日志](docs/更新日志.md)，阶段性判断见[方向校正](docs/方向校正.md)，产品边界见[产品定义](docs/产品定义.md)。

## 已确定的原则

- 第一阶段先服务东北大学等固定组织场景，再验证跨组织复制。
- `PPT源/` 是唯一原始 PPT 来源目录，来源记录只写 `PPT源/<文件名>`。
- Skin 提供组织视觉与排版规则；正文在 Content Frame 内按规则组合原生元素。
- 目标架构允许自组原生元素，不要求每个页面组合预先登记为 Skill；关系必须有内容依据。调用既有资产时遵守其契约，页面派生结果不自动写回核心库。当前正式入口仍是旧能力选择流程，尚未迁移。
- HTML 主要用于资产入库时的复现、审美调整和看板审核；目标正式生成线直接调用 Native PPT Skills，不把 HTML 当成每次生成都必须经过的中间真源。
- 最终输出必须是原生可编辑 `.pptx`。
- 现有程序继续作为测量、生成和验证执行器；复用 Skill 时遵守适配边界，直接编排时遵守任务与 Skin 规则。
- 资产入库与正式生成是两条不同工作流；候选资产不得自行晋升。
- 检查保持必要且轻量，不恢复全状态穷举、反复哈希和过重审查链。

## 文档入口

- [文档地图](docs/README.md)
- [产品定义](docs/产品定义.md)
- [产品叙事](docs/产品叙事.md)
- [方向校正](docs/方向校正.md)
- [更新日志与当前状态](docs/更新日志.md)
- [正式生成工作流](docs/工作流/正式生成/工作流.md)
- [Agent 排版规则初稿](docs/工作流/正式生成/Agent排版规则.md)
- [资产积累与入库工作流](docs/工作流/资产积累与入库/工作流.md)
- [资产覆盖清单](docs/工作流/资产积累与入库/资产覆盖清单.md)
- [Shell、Content Frame 与 Logic 契约](docs/契约/Shell与Logic契约.md)
- [运行配置信息](docs/契约/运行配置信息.md)

## 主要目录

- `assets/`：正式核心资产；各资产目录中的 `asset.json` 是登记真源。
- `catalog/`：Logic、Composition、Purpose、覆盖与失败经验等目录数据。
- `src/agent/`：当前稿件理解、候选生成、视觉决策和工作流编排；实验阶段按独立内容/视觉上下文验证页面编排。
- `src/runtime/`：Skin、资产发现、正式运行和确定性渲染支撑。
- `src/asset-runtime/`：现有 HTML 资产与 Native PowerPoint 之间的共享编译能力；迁移期继续复用，不再扩张为正式线唯一布局来源。
- `稿件/`：正式生成使用的原始稿件。
- `PPT源/`：唯一原始 PPT 来源；整目录由 Git 忽略。
- `experiments/`：仍有决策价值的最小实验，不作为正式能力。
- `docs/archive/`：已经被新决策取代的历史文档，只用于追溯。

## 使用与验证

安装 Node.js 20 或更高版本后：

```powershell
npm ci
npm run setup:workspace
```

双击 `启动PPA生产工作台.cmd`／`启动PPA看板.cmd`，或运行 `npm run production:workbench`／`npm run assets:dashboard`。底层正式入口为 `npm run agent:run`；DeepSeek 入口为 `npm run agent:run:deepseek`。真实密钥只放在 Git 忽略的 `config/deepseek.local.json` 或环境变量中，详见[运行配置契约](docs/契约/运行配置信息.md)。

公开依赖安装完成后可运行 `npm test`。本地含 `PPT源/` 时可额外运行 `npm run audit:local`；熟悉项目或只改文档时不需要重新渲染 PPT 或运行完整测试。
