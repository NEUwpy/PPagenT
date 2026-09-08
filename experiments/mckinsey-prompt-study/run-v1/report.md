# run-v1 简短报告

## 交付

- `deck.pptx`：四页中文、原生可编辑 PowerPoint。
- `slide-01.png` 至 `slide-04.png`：最终 PPTX 渲染的逐页预览。
- `montage.png`：四页总览；`first-pass/` 保留首轮成品。
- `builder.mjs`：Artifact Tool ES module 构建脚本。

## 实际技能调用与页面选择

| 页 | contentRelation | projectCandidates | fitReason | selectedSkill | actualInvocation | outputKind | nativeEditablePptx | unresolved |
|---|---|---|---|---|---|---|---|---|
| 1 | 年份→完成量与中位等待的并行趋势 | Lieflat Charts；argument-evidence | 数值趋势适合图表；项目论点证据结构不提供双轴趋势编码 | `ppagent-charts` + adapted-native | `skills/library.mjs bind lieflat-charts` 返回 descriptor-only；按接入边界重建为柱＋线原生形状 | adapted-native | yes | 无；为模拟数据，不能推断因果 |
| 2 | 两类用户在同四维障碍上的并列比较 | `comparison-dual-verdict-001` | 候选要求正负极性与明确取舍；本页是并列描述，故不强套 | autonomous native aligned comparison | `catalog.mjs list --logic comparison`、`guide comparison-dual-verdict-001`；按共同维度原生重建 | native shapes | yes | 样本为模拟多选，不能推广 |
| 3 | 三阶段先后＋相邻阶段门禁＋贯穿规则 | `sequence-phase-gates-004` | 与阶段推进和门禁条件完全匹配 | adapted-native sequence gate | `catalog.mjs list --logic sequence`、`guide sequence-phase-gates-004`；原生多边形河道、门闸、文字重建 | adapted-native | yes | 指标无预设数值，收益未验证 |
| 4 | 预约频次×支持需求定位四类设备并映射行动 | `matrix-quadrant-priority-001` | 与二维分界、四象限行动建议完全匹配 | adapted-native quadrant matrix | `catalog.mjs list --logic matrix`、`guide matrix-quadrant-priority-001`；原生坐标、象限、点位与标签重建 | adapted-native | yes | 50 为本次讨论分界，不代表行业尺度 |

## 数据与事实校验

- 页 1：完成量 `1200, 1560, 1920`；中位等待 `8, 7, 6 天`；图轴分别为 `0—2200` 与 `0—10`；页标题改为“中位等待”以保持口径一致。
- 页 2：校内、校外各 `n=100`；四个维度和原稿比例逐项一致；明确多选比例不相加为 100%。
- 页 3：三阶段、两个门禁、每阶段交付与观察指标、授权暂停规则均保留；未绘制未经原稿支持的改善曲线。
- 页 4：四个点位逐项为显微成像 `(85,80)`、基础检测 `(80,25)`、材料制备 `(35,75)`、常规加工 `(30,30)`；坐标 0—100，50 为讨论分界。

## 检查结果与限制

- 已使用 Artifact Tool 导出 PPTX、逐页 PNG、montage，并生成布局 JSON 与 inspect NDJSON。
- `slides_test.py`：通过，未检测到溢出；最终 PPTX 已重新渲染并逐页查看。
- 编辑性：图表、轴、点、门闸、象限、连接形状、正文和页脚均为原生 PowerPoint 对象；未嵌入截图或 HTML。
- 视觉限制：大学品牌标识未找到可用来源，未编造 Logo；当前版采用 Skin 已确认的 `#315F91` 蓝、白底、Microsoft YaHei 和克制蓝灰层次。页面为独立试验，不代表正式入口或东北大学实测数据。
