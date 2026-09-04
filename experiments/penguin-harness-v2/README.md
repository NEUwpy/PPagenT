# PenguinHarness v2 纵向实验

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
