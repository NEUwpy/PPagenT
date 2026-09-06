# PPagenT

PPagenT 面向工作型演示，把用户内容整理为表达清楚、视觉合适、原生可编辑的 PowerPoint。第一正式场景是东北大学，目标是让设计经验可复用，而不是让每页都套结构图。

## 当前状态

现行生产线仍是内容导演编排、程序筛选候选、视觉导演选择、Native 生成与检查。它已支持已披露的文字加结构混合页，尚不是自主工具循环的 Agent Harness；正式 CLI 仍使用东北大学 Skin。

现行设计与角色规则集中到根目录 [rules/](rules/README.md)，通过索引按用途读取。暂定每个 Skin 一个颜色体系、绑定一个排版体系；多个 Skin 可复用同一排版体系。当前中性 Skin 自动加载「杂志风」，可用于独立制作任务，其资产仍为 candidate，未接入正式 renderer。规则拆分不等于已经实现通用图文、复合页或四类输入自动处理。

## 入口

- [产品需求](docs/产品需求.md)：输入、交付与用户修改权限，不绑定实现架构。
- [产品定义](docs/产品定义.md)：唯一的现行架构与目标边界说明。
- [规则维护](rules/README.md)：单一规则来源、按需加载与经验沉淀。
- [正式生成工作流](docs/工作流/正式生成/工作流.md)：可运行命令与当前限制。
- [独立生成任务提示词](docs/工作流/正式生成/生成任务提示词.md)：新任务读取规则的短入口。
- [文档地图](docs/README.md)、[更新日志](docs/更新日志.md)：其余资料与状态记录。

## 使用与验证

安装 Node.js 20 或更高版本后：

```powershell
npm ci
npm run setup:workspace
npm run production:workbench
```

也可双击 `启动PPA生产工作台.cmd`／`启动PPA看板.cmd`。Provider 和密钥配置见[运行配置契约](docs/契约/运行配置信息.md)；真实密钥不进入 Git。

只读取独立制作所需规则，不启动模型或生成 PPT：

```powershell
npm run rules:load -- --profile generation --skin neutral-editorial-001
```

`npm test` 执行契约、程序测试和公开审计；本地有 `PPT源/` 时可额外运行 `npm run audit:local`。程序测试不能替代成品逐页视觉检查。

主要目录：`rules/` 管规则正文；`assets/` 管资产声明与实现（含候选）；`catalog/` 管目录数据；`src/` 管加载、编排与执行；`稿件/` 管原稿；`PPT源/` 是唯一原始 PPT 来源且被 Git 忽略。实验和历史文档不作为当前生成入口。
