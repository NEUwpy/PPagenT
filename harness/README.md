# PPT Harness 使用入口

从 2026-09-12 的 Git 基线 `d5efa449` 起，PPagenT 正式以轻量 Harness 为重构主线：先让一份稿件通过可恢复、可返工的闭环交付实际 PPT，再按失败证据增加机制。旧 API 生产线保留兼容，不再主导新架构。

先读 [AGENTS.md](AGENTS.md)、[架构与运行流程](运行流程.md)、[角色与提示入口](角色与提示入口.md)。生产阶段为分页内容 Markdown → 页面蓝图与实文草稿 → Skin/排版适配与 PPT 构建 → 实际渲染、检查和修正。默认交付完整 PPT；初模仅在用户明确要求时作为交付终点。

## 运行资料

| 入口 | 职责 |
| --- | --- |
| [运行流程](运行流程.md) | 架构唯一说明、中间产物、返回路径与轻量边界 |
| [任务入口](任务/新任务入口.md) | 新任务输入模板 |
| [任务协议](docs/工作流/正式生成/生成任务提示词.md) | 制作要求与实际交付 |
| [产物审查](产物审查.md) | 基础检查与失败证据，不要求独立审查 Agent |
| [runs 约定](runs/README.md) | content.md、blueprint.json、state.md 与产物留存 |
| [外部依赖](外部依赖.md) | 宿主、PPT 工具、字体与可选外挂能力 |
| [项目执行进度](../docs/方向讨论/页面编排能力计划.md) | R0–R3 里程碑；仓库维护资料，不是远端运行前提 |

多轮工具调用循环现由仓库自建运行器 `src/runner/` 提供（见下节），不再依赖 Codex 宿主；R1 实测模型为 DeepSeek，密钥走 `config/deepseek.local.json` 且不入库。当前不安装 Penguin。包内规则读取示例：

```powershell
node src/tools/load-rules.mjs --profile generation --skin neutral-editorial-001
```

上述命令只加载规则。执行者可完整读取适用设计上下文，再按需要调用工具和补充资料；模块化维护不要求分阶段截断上下文。首个闭环选择一种已有风格，具体输入与风格在 R1 任务启动时记录，不默认同时验证两套。

## 运行器

`src/runner/` 只拥有四件事：循环、状态落盘、工具派发、恢复。构建、字号/几何审计、规则加载、
来源核对、结构调用一律调既有模块——这条边界写在代码注释里，别让它长成第二个 `workflow.mjs`。

```powershell
# 首次运行：读原稿建 state，跑完内容阶段与视觉阶段
node src/runner/run.mjs --input harness/runs/<任务名>/原稿.md --run-dir harness/runs/<任务名>

# 中断续跑：不重做已冻结的页面
node src/runner/run.mjs --run-dir harness/runs/<任务名> --resume

# 零模型重编译交付物（用于验证确定性，不调用模型）
node src/runner/run.mjs --run-dir harness/runs/<任务名> --replay
```

阶段闸门由**工具写下的状态字段**驱动，不由模型自述完成：内容阶段以 `finish_content` 冻结
（来源有遗漏即拒绝），视觉阶段以 `finish_visual` 收尾（每页必须是当前版本已通过）。
宿主依赖失败（缺引擎、缺浏览器）会记 `runtimeFailure` 并立即停止，不交给模型去补偿环境故障。

产物落在运行目录：`state.json`（唯一机器真源）、`state.md` / `content.md`（由它渲染）、
`blueprint.json`（实际被构建的蓝图）、`deck.pptx`、`qa/slide-NN.png` 与 `qa/montage.webp`（逐页预览）、
`tool-events.ndjson` 与各阶段 transcript（运行证据）。

## 内容包维护与部署边界

rules、部分 docs、配置及轻量工具由父仓库维护源同步；Harness 自有流程在本目录维护。`同步内容包.py` 重建包，`内容包清单.json` 记录镜像 SHA256；修改共享正文后同步，禁止两处分别维护。镜像正文里的相对链接会指向未随包搬运的证据（`assets/`、`experiments/` 等），这类链接逐字节保持源文、不改写，已逐条登记在清单的 `boundaryLinks` 里——包是给远端执行用的，不是导航用的。最初归拢是原字节复制，当前内容已随重构更新，不再将首次哈希当作永远冻结版本。

部署可复制本目录并排除旧 runs、缓存和 node_modules；执行不需要访问父仓库说明正文。大型结构资产、大学模板/执行器、PPT SDK 与字体仍是外部依赖，先核对实际接入。content/blueprint/state 是轻量文件约定，尚无强制状态机或通用新 Schema。目录完整不代表完整生产环境部署成功。

镜像项里原先有两处过时表述（`生成任务提示词.md` 仍写「当前为 Codex 项目＋Luna high」、`产品定义.md` 只写总控「可先由宿主承担」）。两处都已回维护源改完并重建本包，清单位点的源哈希与镜像哈希一致，因此不再并列在这里。
