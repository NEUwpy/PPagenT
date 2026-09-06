# PenguinHarness v2 纵向实验

## 2026-09-05 当前入口：无图片网格闭环

当前架构为一个 PPT Agent、内容/视觉两个独立上下文和持久化 Deck Project。新切片位于 `grid-*.mjs` 与 `run-grid.mjs`，默认无图片输入。下方 `run-single.mjs` 等保留为前一轮候选选择实验。

本分支验证有限能力下的稿件驱动编排；另一台电脑的 main 丰富版式、结构和规则，见[分支分工](../../docs/分支分工.md)。试验只使用一个 24×12 区域网格、一个基本文字适配器和已登记的 `sequence-flow-001`，不新建正式版式全集。

```powershell
node experiments/penguin-harness-v2/run-grid.mjs --run-dir .tmp/penguin-harness-v2/grid-loop-1
# 中断后继续当前项目；不重做已冻结内容
node experiments/penguin-harness-v2/run-grid.mjs --run-dir .tmp/penguin-harness-v2/grid-loop-1 --resume true
# 已完成方案的离线复编译，不调用模型
node experiments/penguin-harness-v2/run-grid.mjs --run-dir .tmp/penguin-harness-v2/grid-loop-1 --replay true
node --test experiments/penguin-harness-v2/grid-project.test.mjs
```

运行需要原项目 Native 依赖与 Node 24；使用本机已配置 runtime 环境（`RUNTIME_NODE / RUNTIME_NODE_MODULES / RUNTIME_BIN_DIR`）。模型配置读取既有本地 DeepSeek 配置或环境变量，密钥和会话仅在被 Git 忽略的运行目录内。`--input`、`--output` 可覆盖试稿与输出位置。

状态在 `deck-project.json`；每页版本与文字/几何诊断在 `pages/<pageId>/revision-*`；`tool-events.ndjson` 记录模型实际操作；阶段统计记录请求、工具、usage 和耗时。渲染结果 PNG 只供人工 QA，工具不向模型发送图片。软性留白提示须修正或说明理由，几何硬问题不能豁免。

内容过少时允许一次受限反馈：视觉阶段通过 `request_content_revision` 指定问题页和相关页，内容阶段只重组这些 PageBrief，保留完整来源；其他页与产物保持。新视觉上下文只编排发生变化的页。宿主依赖失败立即停止，不让模型反复修改页面去补偿环境问题。

实验边界：PageView 暂只接受来源连续片段；来源完整内容留在项目和备注。网格热图使用 Native 实际文本框和行估算字形占用，不能证明全部审美问题。照片能力、自由改写与生产工作台迁移尚未实现。稀疏阈值在本分支对应用户本轮不留大片空白的要求，不是全产品的审美定律。

本轮结果见[无图片闭环记录](GRID-RESULTS.md)。

## 前一轮：候选选择实验

这是 PPagenT 的旁路实验，不是正式生成入口，也不会改变当前 `main` 的生产契约。

本轮验证的新指导思想：

1. 一个逻辑上的 PPT Agent 分内容、视觉两个阶段运行；两个阶段使用独立上下文，通过持久化 Deck Project 交接；
2. 内容阶段不再整份提交长 JSON，而是初始化项目、分批写页、查看状态、统一校验；视觉阶段按页读取内容、检查候选、保存选择；
3. Skin 与 Layout 分开，Layout 组织 Text、Media、Structure；
4. 最终仍交给 PPagenT 现有 Native 生产线，不能把实验成功等同于 PPT 质量已经达标。

## 运行

在本目录安装独立依赖：

```powershell
npm install
```

模型从 Git 忽略的 `config/deepseek.local.json` 或环境变量读取。当前机器需要配置 `apiKey`；没有密钥时只能做静态检查，不能执行真实模型试验。

```powershell
node experiments/penguin-harness-v2/run.mjs `
  --input 稿件/为什么做PPagenT-v1.md `
  --output output/penguin-harness-v2/为什么做PPagenT.pptx `
  --run-dir .tmp/penguin-harness-v2/run
```

当前更推荐单 Agent／双阶段入口：

```powershell
node experiments/penguin-harness-v2/run-single.mjs `
  --input 稿件/为什么做PPagenT-v1.md `
  --output output/penguin-harness-v2/为什么做PPagenT-single-agent.pptx `
  --run-dir .tmp/penguin-harness-v2/single-agent-run
```

Penguin 的 Agent State、子 Agent Trace 和中间状态都放在 `.tmp/penguin-harness-v2/`，不会写入 API Key 或核心资产。

## 这轮不是要证明什么

不把“能启动 Penguin”“能调用两个子 Agent”当成成功。真正比较：

- 内容是否比一次性输出更完整、分页更自然；
- 视觉导演是否先规划区域和整套节奏，再调用 Text／Media／Structure；
- 是否能使用已登记能力并生成原生可编辑 PPTX；
- 是否减少专稿补丁，而不是把补丁藏进更长的 Prompt；
- 调用数、Token、耗时和人工返工是否值得。
