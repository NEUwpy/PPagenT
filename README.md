# PPagenT

PPagenT 是一个面向固定组织场景，使用受控视觉能力可靠生成原生可编辑 PowerPoint 的系统。

它不让 AI 自由绘制整份 PPT。AI 负责理解稿件、组织叙事、选择合法的表达能力；视觉能力约束可以发生什么；确定性引擎负责空间求解、HTML 预渲染、Native PPTX 编译与质量门禁。

> AI 负责理解与选择；受控视觉能力负责表达；确定性引擎负责求解、编译与验证。

## 当前里程碑

`Shell + Content Frame`、HTML 单源 Structure Group、Native PPTX 编译、资产看板和双导演正式线已经形成可运行基础。当前正式库有 35 个 Structure Group，覆盖 20 类 Logic 中的 18 类。结构资产的第一轮集中建设到此基本结束，默认冻结扩库。

下一阶段不再以“每页命中一个完整结构图”为目标，而是验证更普适的表达能力：普通页面重点探索 `Composition + Text + Media`，只有拓扑本身承载语义时才调用 Structure。复杂混合页面是否需要小型反馈闭环，仍须实验。当前生产代码继续按“一页一个主 Structure／Composition”运行。

当前状态与历史统一见[更新日志](docs/更新日志.md)，阶段性判断见[方向校正](docs/方向校正.md)，产品边界见[产品定义](docs/产品定义.md)。

## 已确定的原则

- 第一阶段先服务东北大学等固定组织场景，再验证跨组织复制。
- `PPT源/` 是唯一原始 PPT 来源目录，来源记录只写 `PPT源/<文件名>`。
- Skin／Shell 固定组织视觉规范；正文在 Content Frame 内使用受控能力。
- 正式生成只能使用已登记、已审批的能力；没有合适结构时回退到合法的文字或图文排版，不临时发明结构图。
- HTML 是受控布局真源和预渲染层，不是最终交付物，也不是任意网页转 PPT 工具。
- 最终输出必须是原生可编辑 `.pptx`。
- 资产入库与正式生成是两条不同工作流；候选资产不得自行晋升。
- 检查保持必要且轻量，不恢复全状态穷举、反复哈希和过重审查链。

## 文档入口

- [文档地图](docs/README.md)
- [产品定义](docs/产品定义.md)
- [产品叙事](docs/产品叙事.md)
- [方向校正](docs/方向校正.md)
- [更新日志与当前状态](docs/更新日志.md)
- [正式生成工作流](docs/工作流/正式生成/工作流.md)
- [资产积累与入库工作流](docs/工作流/资产积累与入库/工作流.md)
- [资产覆盖清单](docs/工作流/资产积累与入库/资产覆盖清单.md)
- [Shell、Content Frame 与 Logic 契约](docs/契约/Shell与Logic契约.md)
- [运行配置信息](docs/契约/运行配置信息.md)

## 主要目录

- `assets/`：正式核心资产；各资产目录中的 `asset.json` 是登记真源。
- `catalog/`：Logic、Composition、Purpose、覆盖与失败经验等目录数据。
- `src/agent/`：稿件理解、候选生成、视觉决策和工作流编排。
- `src/runtime/`：Skin、资产发现、正式运行和确定性渲染支撑。
- `src/asset-runtime/`：HTML 组件到 Native PowerPoint 的共享编译能力和兼容运行时。
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
