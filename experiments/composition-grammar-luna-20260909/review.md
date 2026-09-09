# Luna high 独立实测复核

## 输入与范围

- 原稿：`experiments/neu-mckinsey-fixed-rules-20260909/inputs/manuscript.txt`
- 规则重新加载：`npm run rules:load -- --profile generation --skin northeastern-university-001`
- 页面组合：`rules/页面组合.md`
- 计划：`composition-intent.json`，`node src/tools/check-composition-intent.mjs experiments/composition-grammar-luna-20260909/composition-intent.json` 返回 `passed`，4 页、0 issues
- 成品：`final/deck.pptx`
- 预览：`final/rendered/slide-01.png` 至 `slide-04.png`
- 首轮与上一轮修订保留在 `first/` 与 `first/revised-01/`；旧的 `final/rendered/slide-01..04` 已移入 `final/rendered/archive-revision-before-02/`

## 页面复核

### P1 历史观察

- `recompose`：将请求量、及时答复计数、及时比例拆成三列共享月份基线；及时答复数保留为独立数字，避免把计数柱误读成比例。
- 文字换行：右栏解释改为四行语义断行，未出现孤字或孤立标点；4 月数据行的 `240 / 144 / 60%` 均可读。
- 线条与净距：右栏分隔线位于中位时间列表和解释之间；解释末行距承载面底边保留约 16 px，未与底边相碰。
- 纵向重心：主图占左侧约三分之二，右侧中位时间与判断同起线，底部口径独立放置。

### P2 原因复核

- `recompose`：合计判断移入主分析区标题行，四类原因改为带对应色块的图例，解决小段“其他”标签掉出主区和标签与色段错配问题。
- 文字换行：`材料不全 42（44%）`、`权限确认 30（31%）`、`需求反复 16（17%）`、`其他 8（8%）` 均完整呈现。
- 线条与净距：横条、色块、图例与下方两组解释之间留有独立间隔，无线段穿字。
- 纵向重心：主横条承担主要分析面积，分母背景和判断放在下方等宽区域，未把四类原因拆成等大卡片。

### P3 方案比较

- `unchanged after review`：全宽表格继续承担同口径比较，B 列的强调与“先选 B”的页面主题一致。
- 文字换行：6 个比较维度、三种方案和底部决策依据均完整，未发现窄列拆字、孤字或掉出表格。
- 线条与净距：行分隔线与文字基线分离，底部决策带与表格之间有清晰间隔。
- 纵向重心：比较表占据主体，顶部限定和底部决策依据形成证据到判断的自然收束。

### P4 有限试点

- `recompose`：三阶段统一使用同级浅底色，移除无来源的中间阶段深色强调；缩短门槛措辞并调整卡片高度，避免句号孤行。
- 文字换行：三阶段标题、行动、门槛和页底边界均完整；门槛使用两至三行自然断行。
- 线条与净距：阶段箭头仅表达前后依赖；回退路径改为卡片下方独立折线，文字与竖线、横线均有间隔，未穿过说明。
- 纵向重心：三张阶段卡共享起线和底线，回退说明位于卡片下方，页底边界保持独立。

## 字体与几何证据

- finalizer receipt：`.codex-finalizer/final-deck-v3.validation.json`，包完整性、模板覆盖、字体政策和首方导入均 `passed`；4 页、13.3333×7.5 in。
- 实际 run 字体从 `final/rendered/slide-01.layout.json` 至 `slide-04.layout.json` 的 `paragraphs[].runs[]` 读取：正文/图题/表格为 `Microsoft YaHei` 18/21/14，观点条带为 `HYWenRunSongYun U` 32，章节标记为 `汉仪粗宋简` 32，章节名为 `汉仪粗宋简` 29.33。
- `inspect_presentation_layout_geometry.py --expected-slide-size-emu 12192000,6858000 --validate-bullet-geometry --validate-heading-fit` 返回 `finding_count=0`、`warning_count=0`。
- 逐页 PNG 已实际查看。补充文本—线段边界扫描仅命中模板标题分隔线与章节标题/编号的预期邻接，P1 解释、P2 图例、P4 回退路径无非预期文本—线段相交。

## 保留限制

finalizer 报告的 `native_font_rendering_verified` 为 `false`，因此字体证据来自最终 PPTX 的 run 记录和 artifact-tool 重新导出的 PNG；未将此项表述为 PowerPoint 原生渲染验证。
