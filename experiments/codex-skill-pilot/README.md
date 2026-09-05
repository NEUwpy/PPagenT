# Codex 原生结构 Skill 验证

本实验先验证 Codex 能否按规则使用真正的结构 Skills，再讨论移植 Harness。工作分支保持 `codex/penguin-harness-v2`；另一台电脑 main 继续建设 Skin、结构资产与具体设计规则。

## 输入与执行者

- 输入：[共享设备预约虚构试稿](manuscript.md)，无逐页答案、无照片素材。
- 执行：新的空白 Codex 任务，`gpt-5.6-luna / high`，显式读取 [结构 Skill](../../.codex/skills/ppagent-structure/SKILL.md) 与 [排版规则](../../docs/工作流/正式生成/Agent排版规则.md)。
- 任务 ID：`01a06ff6-2a2f-7121-8ea6-aada85500ad9`。设置与边界见 [dispatch.json](evidence/setup/dispatch.json)。没有使用 DeepSeek/Penguin，也没有给它旧试跑成品。
- Luna 编排与修订没有接收页面图片；父任务末端查看全部预览并给出可由 Native 数据复核的问题。此结果是“独立初稿 + 父任务审查反馈”的协作验证，不是无人审查的一次成功。

## 已观察到的行为

Luna 自主形成 7 页：封面、问题与边界、流程、收益代价、复盘标准、批准条件、结尾。流程采用 `sequence-flow-001` 三步状态，安全暂停作为独立的贯穿规则；同一试点决策的收益代价采用 `comparison-pros-cons-balance-005`，倾向有稿件依据。其余正文直接用原生文字和少量形状编排，没有使用固定文字模板。

目录脚本从真实登记与可达性信息发现 35 个核心结构、18 类逻辑，按逻辑查询后再读取具体契约。两种被选资产通过 `invokeStructure → renderStructureAsset` 真正加入当前 slide；单次调用分别新增 29、26 个原生形状对象。成功调用不等于整页检查通过。历史重跑会重复调用同一资产，不能把日志次数当作独立选型次数。

## 实际问题与修正

| 问题 | 证据与处理 |
| --- | --- |
| 参数示例未暴露 | 准备期发现 package loader 不直接返回 previewParameters；catalog 改为按资产声明读取实际导出。修复发生在空白任务启动前。 |
| 工具路径与 Windows 路径解析 | Luna 首次 marker 路径错误；builder 直接使用 URL.pathname 得到重复盘符。自行定位并使用 fileURLToPath 后继续；均不是结构调用失败。 |
| 仍使用旧文字槽位 | 父任务静态审查发现 singleTitle/dualBody 等旧角色；退回后改为语义字号配置，未修改正式 Skin。 |
| 同页对齐与检查不足 | 父任务指出结构外说明与正文对齐不一致、只验证输入框；Luna 统一正文对齐，并读取实际导出对象检查。编号标记单独归类，普通说明仍计正文。 |
| 实际换行与预估不一致 | 第 2 页正文产生单字“时”；第一次局部修订又出现独立句号。Luna 再调区域宽度，保持 20 号字，最终实际三行且“临时取消”未拆散。 |
| 日志覆盖 | 父任务指出初始 builder 清空调用日志；后续改为追加，首次调用另有 setup 快照。 |
| 模板继承对象与导出主题 | 原模板封面/结尾有横线超出画布；与新生成内容分开披露。导出还会改写主题格式方案，要求在导出后保留源主题并验证。 |

结构渲染本身在已观察调用中均成功；没有人为制造结构参数失败。`evidence/setup/validation.json` 中区域不足的拒绝是独立包装器边界测试，不属于稿件试做失败。

父任务根据真实问题补强了 Skill 调用说明。最终代码与记录位于 `evidence/luna-1/`；以实际产物和验证记录为准，不以某条“success”或模型自述替代检查。

## 最终验证与复现

- [最终核验](evidence/setup/final-audit.json)：7 页均包含原生文字与来源备注，源主题逐字节一致；14 次历史结构调用全部成功，实际只验证了 2 个不同资产。
- [独立 overflow 输出](evidence/setup/final-overflow.txt)：父任务使用明确的 bundled Python 入口检查最终 PPTX，返回 `Test passed. No overflow detected.`。Luna 先前通过 Windows 文件关联调用 .py 的退出码不能单独证明测试通过，记录已更正。
- 全部 7 页预览由父任务查看；问题页的孤字已修，正文页实际对齐分别为 left / center / center / left / left。保留源模板封面/结尾的零高度延长线，新生成内容未越出画布。
- [归档 builder](evidence/luna-1/builder.mjs) 从自身目录实际重跑成功，约 6.1 秒；这是确定方案的离线编译，不是新稿件的模型生成时间。
- 主 Skill 与两个逻辑子 Skill 已出现在当前环境可用列表中；本次仍是显式指定入口，未验证无提示自动选择行为。

复现时在仓库根先按 presentations Skill 调用 `load_workspace_dependencies`，设置返回的 `RUNTIME_NODE / RUNTIME_NODE_MODULES / RUNTIME_BIN_DIR`；确保 builder 目录的 node_modules 指向该工作区运行时（本地 junction 不入 Git）。然后执行：

```powershell
& $env:RUNTIME_NODE experiments/codex-skill-pilot/evidence/luna-1/builder.mjs
```

该命令不调用模型，会重新生成同名最终 PPTX、更新 QA 并追加调用记录。要验证新稿的自主决策，应另建独立实验目录而非只重跑这个已确定方案。最终 PPTX 位于 `output/codex-skill-pilot/共享设备预约-技能调用验证.pptx`。

## 结论边界

本轮证明显式读取的结构 Skill 能让一个空白 Luna high 任务选到合适资产并生成原生对象，同时普通文字可直接编排。它也暴露了需要改进的地方：旧接口会把模型拉回槽位思维；输入框合法不代表最终文字排好；检查必须返回具体位置和实际数据。

没有证明自动 Skill 发现、35 个资产全部可用、含图结构、跨稿稳定性、无人审查质量保证或 DeepSeek/API 成本。两个模型不因参数档位相近就性能等价。文字页的留白和间距仍有优化空间，本轮未把单一密度阈值当作审美证明。

下一步先用新稿检验补强后的 Skill 能否减少同类返工，再将已稳定的检索、调用、状态与检查接口移植 Harness；不为了增加数量批量制造无实用差异的 Skills。
