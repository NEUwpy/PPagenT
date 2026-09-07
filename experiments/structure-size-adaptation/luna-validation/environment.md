# 编排环境与正式入口

## 当前准备环境

- 工作区：`C:\PPagenT`
- 分支：`codex/structure-size-adaptation`
- 准备基线：`fa1f4f305efd3797c804c75c14a7032071082802`
- 运行时由 `load_workspace_dependencies` 返回：
  - Node：`C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
  - Node packages：`C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules`
  - Python：`C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`
- 画布：1280×720，默认 16:9。

## 已读取的规则

- `.codex/skills/ppagent-structure/SKILL.md`
- `.codex/skills/ppagent-structure/references/invocation.md`
- `.codex/skills/ppagent-structure/skills/ppagent-structure-sequence/SKILL.md`
- `C:\Users\ilove\.codex\plugins\cache\openai-primary-runtime\presentations\26.826.12353\skills\presentations\SKILL.md`
- presentations `style_guidelines.md` 与 `artifact_tool_docs/API_QUICK_START.md`

## 后续构建约束

1. 构建脚本导入 `.codex/skills/ppagent-structure/scripts/invoke.mjs`，传入真实 `slide`、本次 Skin、`assetId`、契约允许的 `parameters`、`targetFrame`、`evidencePath`、`pageId`、`regionId` 和调用理由。
2. 使用真实 `slide` 对象，不能用 slide JSON 冒充。
3. 每次 attempt 使用独立标识或追加日志，不清空历史失败；首轮失败原因、重排决策与重试都要留在 evidence。
4. 最终导出后读取 layout JSON 的实际文本行、包围盒和对象数量，再独立渲染 PPTX；不能只检查目标框数值合法。
5. 需要空间反馈时，优先改页面区域、旁栏位置或结构 State；不强行缩小字号、不删除事实、不把重画结果冒充正式调用。
6. 使用 presentations 技能的本地 PPT workflow；最终交付应包含原生可编辑 PPTX、重新导入渲染、检查输出和可浏览对照页。

## 未来证据目录（尚未创建）

建议在实现 ready 后按本目录的父级建立独立运行目录，例如 `build/`、`evidence/`、`deliverables/`、`final-render/`，避免覆盖 `neutral-core-convergence-06` 的历史结果。路径和命名由实际 builder 决定，但每次重跑必须可追溯到 `caseId` 与 `attempt`。

