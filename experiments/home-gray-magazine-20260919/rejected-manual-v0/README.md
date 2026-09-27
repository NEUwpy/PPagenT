# 灰稿到杂志风代表页（2026-09-19）

本轮在 `Home` 分支上验证后半段流程：把已存在的“两点不足／四点感悟”灰稿输入杂志风制作阶段，产出一页可编辑 PPTX。

## 输入

- 灰稿：`input/gray.pptx`，来自 `experiments/gray-checkpoint-20260916/latest/范本原稿-分区修订灰稿.pptx`。
- 灰稿计划：`input/gray-state.json`，对应 `gray-plan-3`，保留 `issues → implementation / compliance` 与 `insights → 4 blocks` 的归属。
- 灰稿规则快照：`input/opencode-gray-definition.txt`、`input/opencode-layout.txt`。
- `opencode` 读取版本：`input/opencode-revision.txt`。

## 本轮做法

- 使用中性 Skin `neutral-editorial-001` 与「杂志风」排版规则：纸色背景、衬线标题、无卡片墙的平面文字、细线和低饱和砖红强调。
- 左栏只把灰稿中标记为 `diagram` 的“变革落地阻力重重”转成局部汇聚结构；右栏的四点感悟保持编辑式文字展开。
- 通过 `invokeStructure` 记录 `convergence-many-to-one-003` 的结构参考，保留“分离输入 → 汇聚路径 → 唯一结果”三项视觉语法；本页用原生可编辑对象做本次区域适配。
- 灰稿中的蓝区说明没有直接上屏，转译成最终结构和文字；没有把结构内部节点当作灰稿内容重复显示。

## 产物与检查

- [可编辑 PPTX](gray-to-magazine.pptx)
- [最终渲染预览](gray-to-magazine.png)
- [重导入渲染](final-render/slide-01.png)
- [结构调用证据](evidence/structure-invocations.ndjson)
- [原生对象检查](build/candidate.pptx.inspect.ndjson)

已完成 `node --check`、PPTX 导出、重新导入渲染、结构调用成功记录和 ZIP 部件检查。首轮发现左侧局部结构与第二项不足发生高度冲突，已按真实高度重新分配后重跑。该页是代表页实验，仍待用户审阅；它证明本次灰稿输入可以进入杂志风成稿路径，不代表整套灰稿或跨稿稳定性已经验收。
