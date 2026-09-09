# 东北大学共享结构入口整页验收

## 交付物

- 可编辑 PPTX：`northeastern-shared-entry.pptx`
- 实际逐页渲染：`northeastern-shared-entry/slide-1.png`、`slide-2.png`、`slide-3.png`
- 全稿缩略图：`montage-final.png`
- 首轮结构调用日志：`round1/invoke-log.ndjson`
- 修订轮结构调用日志：`invoke-log-revision.ndjson`
- 构建元数据：`build-meta.json`
- 首次失败记录：`build-error.json`
- 首轮候选：`round1/`
- 原稿：`manuscript.md`
- 规则/反馈记录：`rules-prompt-snapshot.md`、`revision-feedback.md`

## 输入与入口

- 模型记录：`gpt-5.6-luna`，`high`。
- 规则入口：`npm run rules:load -- --profile generation --skin northeastern-university-001`，成功加载 `mckinsey` 排版绑定。
- 已读取并按现行入口执行：`docs/工作流/正式生成/生成任务提示词.md`、`docs/工作流/正式生成/大学结构调用.md`、`rules/skins/东北大学.md`、`rules/排版体系/麦肯锡式.md`。
- 每页先由 `createNortheasternUniversityStarter` 建立现行东北大学模板页，再由 `invokeUniversityStructure` 调用保留原造型实现；没有改写源设计、Skin、规则或资产。

## 页级检查

| 页 | 观点标题与依据 | 结构 | 页外独有说明/行动 | 视觉结果 |
|---|---|---|---|---|
| 1 | “登记口径先覆盖四类信息，后续追溯才有据可查”；依据为申请来源、审批依据、执行结果、异常处置四项独立信息 | `parallel-folded-notes-grid-002`，4 项 | 右栏解释四类字段各自承担的追溯责任，并提出保留字段的依据 | 折角、卷页、投影、通栏标题带和居中阵列保留；4 个便签为可编辑原生对象 |
| 2 | “三类来源进入试点，都要依次通过三道纳入关”；依据为三类来源依次进入资格核对、责任确认、记录准备 | `convergence-simple-funnel-001`，3 层、3 个入口 | 图标下直接标注三类来源；右栏说明完成记录准备后才纳入试点 | 曲面圆台、共享中轴、分层留白和随形导流保留；入口与中文标签一一对应 |
| 3 | “当前处于统一登记级，下一步先关联执行与异常记录”；依据为四级能力、当前第 2 级、目标第 4 级 | `progression-maturity-steps-002`，4 级 | 右栏解释先建立关联记录，再用积累数据定期复盘 | 连续踏台、立面、接缝、共同消失点和随形承托面保留；当前/目标标记正确 |

## 字号与技术检查

- 按东北大学 Skin 读取：展示字体 `HYWenRunSongYun U`，正文字体 `Microsoft YaHei`；独立制作字号基准为标题 32、局部标题 21、正文/标签 18、辅助 14（设计像素），结构主题字号由大学入口换算为 15.75/13.5/10.5pt 档位。
- 三页标题均为单行观点标题；页外说明、来源标签和结构内文字均实际渲染查看，未见标题折行或文字越界。
- `slides_test.py`：通过，`No overflow detected`。
- 每次结构调用产生 `attempt` 与 `success/failure` 记录；修订轮最终 3 页调用均成功，日志中的 `nativeShapeDelta` 为 28、14、34。
- 漏斗第一次因 805×415 区域内三个入口文字无法容纳而失败；第二次仍失败；第三次改用已登记图标槽位并将完整来源放到页外说明后成功。失败重试次数：2。
- 实际 PPTX 字体/字号提取：页标题为 `HYWenRunSongYun U`、24pt；结构标题为 `Microsoft YaHei`、13.5–15.75pt；结构正文为 `Microsoft YaHei`、10.5–13.5pt；P2 来源标签为 `Microsoft YaHei`、13.5pt。结果详见 `validation-revision.json`。
- 几何检查：48 个文本框均在 1280×720 页面边界内；P2 标签框已无相交。仅剩三处模板页眉的章节标题与两位页码框相交，逐项核对为原模板的有意紧邻布局，不属于正文碰撞。

## 未解决问题

模板页眉的三处文字框相交属于已人工核对的边框报警，实际字形未碰撞，保留模板原样。漏斗入口使用已登记图标槽位，完整中文来源名称直接贴近图标，右栏补充纳入条件；这是在结构字号容量内保持对应关系的整页分工。稿件没有实施成效数据，因此未生成任何数量、通过率或转化率图表。
