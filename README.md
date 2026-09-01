# PPagenT

PPagenT 是一个面向固定使用场景、以可靠生成原生可编辑 PowerPoint 为核心目标的项目。

系统使用 AI 理解稿件并把内容转化为固定、可校验的结构化字段；具体的资产调用、页面绘制和质量检查由确定性的规则与程序完成。

## 当前阶段

两份真实稿件已经用于校准正式生成线。当前冻结 Shell 与 Content Frame，并已验证 `Logic → Structure Group → State → Native PPT`：HTML/CSS 组件负责响应布局并向通用编译器提供最终几何，编译结果仍是原生可编辑对象。正式库现有 35 个结构组件，覆盖 20 类 Logic 中的 18 类；当前状态见[当前阶段](docs/当前阶段.md)，逐项覆盖见[资产覆盖清单](docs/工作流/资产积累与入库/资产覆盖清单.md)，几何和颗粒度见[Shell 与 Logic 契约](docs/Shell与Logic契约.md)。

## 核心工程取舍

PPagenT 采用“AI 理解与选择、参数化代码确定性绘制”的生成方式，以减少重复生成消耗并提高结果可靠性。核心库按 Logic 组织语义能力；每个 Logic 可包含多个经验证的 Structure Group，每组再确定性适应数量和容量 State。具体规则见[产品定义](docs/产品定义.md)。

## 已确定的基本原则

- 第一阶段从一所学校开始，形成成熟流程后再复制到其他学校。
- 学校模板负责固定视觉规范，正文内容可以在规则内采用不同布局。
- 组件采用参数化程序实现，并保持统一的视觉风格。
- 内容导演负责整套叙事和拆页，视觉导演负责版式与节奏，程序负责确定性绘制。
- 正式流程不包含审查 Agent；但包含每次必跑的确定性渲染质量门禁。内容和视觉审查只用于当前研发阶段校准工作流。
- 视觉导演只能调用具有复现或蒸馏来源的核心资产，不得临时创造结构图。
- 最终输出必须是原生可编辑的 `.pptx` 文件。
- 第一阶段优先支持 Markdown，其他输入形式以后逐步扩展。

## 项目文档

- [当前阶段](docs/当前阶段.md)
- [方向校正](docs/方向校正.md)
- [产品定义](docs/产品定义.md)
- [Shell 与 Logic 契约](docs/Shell与Logic契约.md)
- [运行配置信息](docs/运行配置信息.md)
- [产品叙事：为什么做 PPagenT](docs/产品叙事.md)
- [外部项目学习](docs/外部项目学习/README.md)
- [资产积累与入库工作流](docs/工作流/资产积累与入库/工作流.md)
- [资产覆盖清单](docs/工作流/资产积累与入库/资产覆盖清单.md)
- [正式生成工作流](docs/工作流/正式生成/工作流.md)
- [更新日志](docs/更新日志.md)
- [资产索引](assets/资产索引.md)

## 主要目录

- `assets/`：核心资产库，只放已进入正式调用并接受持续优化的版式家族；各资产目录的 `asset.json` 是唯一登记真源，不维护中央注册表。
- `稿件/`：正式生成线的统一原始稿件目录；当前优先保存 UTF-8 Markdown，不放导演中间产物或生成结果。
- `PPT源/`：全部原始 PPT 的唯一目录；整目录不进入 Git，换电脑时单独复制到仓库根目录。
- `src/asset-runtime/`：原生 PPT 共享原语、旧资产兼容 Builder，以及 HTML 组件到 Native 对象的编译支撑。
- `assets/<分类>/<资产>/asset.json + runtime.mjs + review.mjs + generate.mjs`：`asset.json` 用于轻量发现，`runtime.mjs` 暴露入围后才读取的组件容量与 Mapper，`generate.mjs` 只在实际编译时加载重型运行库；结构资产只维护一份 HTML 布局真源，看板缩略图、详情预览与下载共用按 State 生成的 Native PPTX。`example.pptx` 仅作兼容示例。
- `experiments/`：只保留仍在使用的最小架构实验和 Shell 标注，不再提交整套稿件运行输出或批量渲染物。

## 公开仓库范围

公开仓库保存项目代码、文档、资产元数据和可由代码生成的候选示例。第三方原始模板、从原模板提取的单页 PPT 与预览图，以及本地实验输出只保存在本地工作区，不提交到 Git。

## 换电脑继续工作

1. 克隆仓库或切换所需分支。
2. 把完整的 `PPT源/` 文件夹复制到仓库根目录；目录名和内部文件名保持不变。
3. 执行 `npm install`，再执行 `npm run setup:workspace`，连接当前电脑 Codex 自带的 PPT 运行依赖。

所有来源记录只使用仓库相对路径 `PPT源/<文件名>`，不写死电脑盘符或用户目录。`PPT源/` 整体由 Git 忽略，因此 Git 操作不会上传、删除或覆盖其中的原始模板。

## 本地验证

安装公开依赖后可执行：

```bash
npm install
npm test
```

`npm test` 会校验规则层契约、版式合法性筛选、公开仓库资产结构，以及资产覆盖清单中引用的 ID 与状态是否真实。完整资产库存直接扫描 `asset.json`，不靠清单登记。包含原始模板和样本文件的本地工作区可额外执行 `npm run audit:local`。

底层正式入口为 `npm run agent:run`，只接受原稿、Skin、输出位置、运行记录目录和 DirectorProvider；不接受人工准备的逐页 `pages`。日常使用及 Codex 代为生成统一通过 `PPA生产工作台.exe` 进入这条正式线，以便用户与 Codex 读取同一份过程记录。生成带文字统计的 `PageIntent` 可使用 `npm run intent:stats -- --content <page-content.json> --intent-draft <intent-draft.json>`。

项目内稿件统一使用仓库相对路径 `稿件/<文件名>`。当前两份回归稿件为 `稿件/为什么做PPagenT-v1.md` 和 `稿件/让六地红-v1.md`；具体放置和命名规则见[放入稿件说明](稿件/放入稿件说明.md)。

默认实时模型入口为 `npm run agent:run:deepseek`，使用 `deepseek-v4-flash`；它读取环境变量或 Git 忽略的 `config/deepseek.local.json`。OpenAI Provider 仍可通过 `npm run agent:run:openai` 使用。正式入口默认只调用内容导演和视觉导演；具体配置与密钥边界见[运行配置信息](docs/运行配置信息.md)。

正式生成线对结构资产使用本地浏览器求解受控 DOM/CSS/SVG，再由通用编译器生成 Native 对象；这不是截图转 PPT，也不是面向任意网页的转换器。PPA 看板读取同一资产声明、Shell 代码和 HTML 组件进行审查；槽位地图也从这些真源即时解析，不另维护坐标表。PPTX 对象生成依赖 Codex 工作区内置、尚未公开发布的 `@oai/artifact-tool`，因此不把后者写入公共 npm 依赖。
