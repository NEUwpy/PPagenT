# 麦肯锡正文风格收敛试验

当前交付 `gray-to-mckinsey-refined.pptx`，对照入口 `index.html`，状态真源 `state.json`。用户审阅仍为 pending。

输入为既有的一页灰稿，延续上轮主旨、内容归属与汇聚图分解。视觉参考为用户的 `docs/方向讨论/20260920.md` 及根目录参考 PNG。参考图里额外加入的原因解释不进入成稿。

## 已完成的主题关联

Home 的 `702d7c24` 将大学默认主色由通用结构蓝 `#315F91` 改为取自主旨条的 `#3361AE`；正文与结构通过共享主题函数派生色阶。现有 Skin 条带仍是模板图像，不能把这一改动称为整张 Skin 已参数化换色。本轮正文风格迭代未改 Skin。

## 对照与迭代

| 记录 | 实际变化与判断 |
| --- | --- |
| control-01 | 追加抽象风格提示，仍用旧执行器；渲染哈希与上一版相同，说明仅列宽／图示内容字段不足以落实风格。 |
| run-01 | 新增通用视觉选择；出现阅读轴、较清楚的编号与分隔，但缺少同口径短项整理。 |
| run-02 | 原文短项变为同行对照；编号弱、右侧上密下空，整体不如参考。 |
| run-03 | 尝试标题浅底与阅读轴；硬标题条偏重，短项因重复摘引被拒后退回段落。模型对拒绝原因的自然语言解释不作为事实。 |
| run-04 | 明确工具的非重复摘引要求；编号改为统一正文数字角色，浅底改为无边框的整条轻过渡面。短项与索引正确，但右侧组尾空白较大。 |
| run-05 | 从空白再生成又丢失浅底和短项；错误地把图示块送入短项工具被拦截。提示不保证每轮稳定成功。 |
| run-06 | 以上轮 run-04 有效候选为起点，只按通用余白反馈调整；保留其余选择，成为当前选用版本。 |

control-01 与 run-01…03 使用的绘制程序分别为旧实验 render-mckinsey.mjs、此处 renderer-v1.mjs；run-04…06 使用当前 render-body.mjs。每轮均保存系统提示、模型原始消息、工具参数与结果、候选和最终状态。run-06 的 refinementSource 为 run-04，非独立从空白成功。

## 可复用结论

共享网格、清楚编号、相邻解释、同口径短项、余白分配，比单纯气质词更有效；已写入 `rules/排版体系/麦肯锡式.md`。`rules/页面组合.md` 进一步区分阅读索引与真实步骤。新规则不包含稿件专名、固定条数、特定左右内容或专用坐标。

实验执行器仅增加 group visual bindings、轻浅阅读底面、条目间距及原文短项映射；没有另建信息关系系统。图示仍调用 invokeStructure / convergence-many-to-one-003 的任务局部原生适配，源设计特征保留，不把参考图的漏斗造型偷偷替换进去。没有图片或图表调用配额。

本轮改了提示、工具说明和绘制能力，不能宣称纯提示词导致全部视觉变化；只有新鲜模型请求、参数日志和对应渲染是实测证据。生产工作台未迁移这套实验字段，任意稿件与其他结构未验证。

## 验证

最终 PPT：1页，74个原生形状，全部6项原文标题／正文仍在原生 XML 文本中；参考图新增文字未采纳。结构调用成功只是执行证据，视觉由主 Agent 另行查看。

`final/verification.json` 核对主题和媒体字节相同、母版与版式解析关系后等价；正文安全区以外所有像素与前版完全相同。最终重放图片与 run-06 候选逐像素相同。33项定向测试通过，slides_test.py 报告 No overflow detected；绘制器文本框重叠检查为0。用户视觉验收与跨稿稳定性尚未通过。

## 重跑

按 presentations 技能设置工作区 RUNTIME_NODE / RUNTIME_NODE_MODULES / RUNTIME_BIN_DIR，MCKINSEY_PYTHON 使用同一依赖包的 Python；复用已配置 provider，不能提交配置和密钥。

```powershell
& $env:RUNTIME_NODE experiments/home-mckinsey-style-20260920/run-style.mjs experiments/home-mckinsey-style-20260920/run-new experiments/home-mckinsey-style-20260920/prompt-04.txt
& $env:RUNTIME_NODE experiments/home-mckinsey-style-20260920/run-style.mjs experiments/home-mckinsey-style-20260920/refine-new experiments/home-mckinsey-style-20260920/refine-feedback.txt --refine=experiments/home-mckinsey-style-20260920/run-04
& $env:RUNTIME_NODE experiments/home-mckinsey-style-20260920/build-final.mjs
& $env:MCKINSEY_PYTHON experiments/home-mckinsey-style-20260920/verify-final.py
```
