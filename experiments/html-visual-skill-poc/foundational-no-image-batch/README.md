# 基础无图片 Style Group 批次

本目录是首个 Radial 检查点通过后建立的统一候选批次。它只处理东北大学 Shell 的 `1170 × 492` Content Frame，不包含标题、Logo、页码和页脚。

## 当前范围

- 一份人类可编辑输入：`batch-input.json`；
- 八个无图片候选：`parallel`、`sequence`、`comparison`、`hierarchy`、`cycle`、`matrix`、`causal`、`layered`；
- 每组一个来自 `PPT源/<文件名>#页码` 的黄金状态；
- 一套 Content Frame 内的 HTML/CSS 组件预览；
- 一份固定 Shell 中的原生可编辑 PPTX 审阅稿。

黄金状态统一审核后，七组直接通过；原循环组改为第 57 页 PDCA 环形语法。`expansion-input.json` 与 `expansion-output/` 现包含八组主要数量/容量 State。这些状态仍未进入核心库；用户审核扩容稿后，再只对通过的 Style Group 整理正式容量契约和资产包。

## 复现

先用 `npm run setup:workspace` 准备仓库需要的 Node 依赖。运行时还需安装 Chromium/Edge，并设置 `BROWSER_EXECUTABLE_PATH`；不得写死电脑盘符或用户目录。然后执行：

```powershell
node experiments/html-visual-skill-poc/foundational-no-image-batch/generate-review.mjs
node experiments/html-visual-skill-poc/foundational-no-image-batch/generate-review.mjs --input expansion-input.json --out expansion-output
```

输出位于 `output/`：

- `foundational-no-image-style-groups-review.pptx`：用户统一审核稿；
- `html-<skillId>.png`：HTML 组件黄金状态；
- `pptx-<序号>-<skillId>.png`：回编译并嵌入 Shell 后的页面；
- `run-summary.json`：来源、状态和候选身份。

## 实现边界

HTML/CSS 负责组件语法与前端式布局表达；PPTX 编译器把相同输入变为原生文本框、形状和连线。当前复用既有可编辑 Builder 的几何实现，并列组使用批次内的原生 Builder；这不是把 HTML 截图贴回 PPT，也不是面向任意 HTML 的通用编译器。

所有组声明 `mediaContract=no-image`。需要中心图片的 `radial-p365` 仍在相邻实验目录中，它的中央图片为必填媒体；没有稿件或已登记图片时该组不合法。
