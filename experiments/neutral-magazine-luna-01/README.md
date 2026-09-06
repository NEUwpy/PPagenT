# 中性杂志风：通用结构与浅约束参考试验

## 本轮范围

2026-09-06，用户确认继续推进中性 Skin 与杂志风，并明确“结构可以通用或者浅约束多参考”。本轮修改现有规则入口、结构 Skill 与共享主题解析，不建设新 Harness，不修改大学 Skin、不晋升核心资产。

- 主色继续推导强调色阶；Skin 显式背景、承载、文字和边线色独立保留，修复暖纸色被替换为白色的问题。
- 独立制作入口按需连接结构 Skill；可以跨 Skin 直接调用，也可以按稿件关系参考重组。参考数量、构图和朝向不设固定配额；直接执行旧组件仍须满足其真实契约。
- 普通文字、媒体、图表不以命中结构库为前提。规则不自动把全库变成线框；局部样式按对象用途选择。

## 程序验证

- `node --test tests/structure-theme.test.mjs tests/rules-loader.test.mjs tests/html-component-runtime.test.mjs tests/dashboard-components.test.mjs`：58/58 通过。
- 随后新增真实浏览器到 Native 的用途色回归，以 `node --test --test-name-pattern='显式纸色' tests/html-component-runtime.test.mjs` 单独运行：1/1 通过；纸色、浅承载、分隔线、关系轮廓和深色文字分别保留，编译为原生对象。
- `node src/tools/validate-rule-layer.mjs .`：39 项契约通过，issues 为空。
- 结构 Skill 的 `quick_validate.py`：通过。捆绑 Python 缺 PyYAML；改用已有 Python 3.12 + PyYAML 6.0.2，以 `-X utf8` 运行，未安装或修改依赖。
- 以上为定向验证，没有运行全量测试，也不能替代 Luna 的内容与逐页视觉验收。

## 独立制作

- 执行者：`/root/luna_neutral_trial`，实际 spawn 参数 `model=gpt-5.6-luna`、`reasoning_effort=high`、`fork_turns=none`；是本任务内独立子代理，未新建用户侧任务。
- 原稿：`inputs/manuscript.md`，复制自现有实验原始输入，明确为虚构课题组归档试点讨论，非真实实施成效。
- 入口：`inputs/task-entry.md`，使用当前规则加载方式；执行者保存实际规则／技能输入快照。
- 输出：`round-01/`。只给原稿、受众、当前入口和通用工具说明，未提供旧页、旧脚本、主任务小样或逐页设计答案。页数自主，建议 7–9 页；没有强制结构调用／多参考配额。
- 本轮共享工作区而不继承本轮聊天历史；实际图片、记忆和参考读取范围以执行记录与报告核对，不以 `fork_turns=none` 宣称完全隔离环境。
- 状态：首轮与一次反馈修订已完成独立验收，均为 REVISE。父任务未修改执行者 builder 或成品。

## 结果

首轮执行曾因额度中断，用户要求继续后恢复同一 Luna high；仍计同轮，不算新的冷启动。执行者披露读取了本轮 PNG，也检索过环境记忆索引；不能宣称完全隔离环境。

| 版本 | 页数 | 原生形状／文本 | 原生连接器 | 图片 | 父任务结论 |
| --- | ---: | ---: | ---: | ---: | --- |
| round-01/deck.pptx | 8 | 181 | 8 | 0 | REVISE：章节断行、第二标题、内容遗漏与报告高估 |
| feedback-01/deliverables/deck-feedback-01.pptx | 9 | 220 | 3 | 0 | REVISE：内容与编号改善，仍有框内溢出和连线悬空 |

第二版有普通形状实现的线段，连接器计数不等于全部关系线数量。父任务分别从最终 PPTX 重新渲染并逐页查看；详见 [首轮验收](parent-review/review-round-01.md) 与 [反馈修订验收](parent-review/review-feedback-01.md)。

实际目录检索1次，具体资产reference读取与invoke调用均为0。此次验证的是自主原生编排，不能报告为多参考或直接调用成功。结构复用的开放边界已经写入规则，实际跨稿质量、真实参考采用及稳定性仍待验证。现有共享执行层还缺少可靠的文本承载净距、轮廓连接端点与内容覆盖闭环，本轮未将这些未完成能力写成已实施。

历史小样保留在 `../neutral-structure-probe-20260906/`，没有提供给 Luna，也不能作为此次制作通过的证据。
