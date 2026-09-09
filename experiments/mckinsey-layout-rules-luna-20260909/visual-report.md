# 麦肯锡式排版复测报告（reviewed）

本文件记录的是父级否决后的反馈修订，不是独立首轮通过。现行规则按合并提交 `787f0dc3` 重新加载；原始 stdout 保存在 `rules-load-stdout.txt`，合并前旧文件保存在 `rules-load-stdout-before-merge.txt`。

## 范围

固定东北大学 Skin，读取唯一输入稿件中的三张正文：准入与推进、记录与处置、能力与扩围。未制作封面、目录、尾页；未改共享代码、规则、其他实验或 Git。

## 成品

- 最终可编辑 PPTX：`mckinsey-luna-reviewed.pptx`
- 首次成功 PPTX：`mckinsey-luna-first-success.pptx`
- 最终逐页 PNG：`reviewed-render/slide-01.png` 至 `slide-03.png`
- 首版逐页 PNG：`first-render/slide-01.png` 至 `slide-03.png`
- 构建脚本：`build-deck.mjs`

## 排版取舍

- 第 1 页用左侧三道准入关口和右侧三阶证据阶梯，保留“筛选解决谁能进入，阶梯解决进入后如何推进”的边界。
- 第 2 页把四类并列记录与三道异常处置关口分开，右侧保留意见不一致时的协调路径。
- 第 3 页用能力阶梯与扩围评审三项并列边界配对，底部单独保留暂停条件。
- 第 1 页明确区分三类申请来源（课题自荐、平台推荐、合作项目）与资格核对；补回“前一阶段证据具备才进入下一阶段”。
- 第 2 页将四类记录改为横向并列文本，避免窄栏竖排；扩大关口与分歧说明区域，按语义换行。
- 第 3 页通过 `src/runtime/invoke-university-structure.mjs` 调用登记的 `progression-maturity-steps-002`，保留连续阶台、共同消失点和随形承托面；移除暗示条件已满足的对勾，补回暂停后保留当前试点规模并明确补齐任务。
- 采用东北大学模板的页眉、校徽、蓝色标题带、分隔线和底线；正文对象均为可编辑文字、形状和线条，没有用整页截图替代。

## 实际检查

- 全部 3 张最终 PNG 已逐页查看。
- 首版看图发现第 1 页编号拆行、阶梯与结论相碰，第 3 页阶梯说明压线；已修正后重新导出并重新查看。
- 最终第 1 页两位编号保持单行，阶梯说明保持语义换行；第 2 页四类记录、三道关口和分歧处置各自有清楚空间；第 3 页阶梯与右侧边界表分区，暂停条件靠近对应评审。
- 最终三张 reviewed PNG 已逐页查看；第 1 页说明区、前阶段证据条件和横线净距，第 2 页关闭关口和分歧语义行，第 3 页结构承载面与暂停任务均已复核。
- 角色核对依据最终 PPTX inspect 的实际文字对象：模板观点标题使用 `HYWenRunSongYun U`；自绘正文、局部标题、标签与说明使用 `Microsoft YaHei`，字号来自 `universityMckinseyTypography`；主题色、浅色和线色来自 `universityMckinseySkin` 经 `resolveStructureTheme` 解析。
- 通用 `audit-rendered-typography.mjs` 仍不能作为完整通过证据：当前 layout/v4 对自绘对象的 `resolvedFontSize` 覆盖与 `qaParentCount=0`、`connectorCount=0` 不能代表实际角色或图内几何全覆盖。本轮以最终 inspect 的文字 bbox/runs、构建坐标与三张 PNG 逐项复核为准，未把 audit 的 passed 字样当作目检替代。

## 未解决限制

本稿没有数据，所有表达保持拟议方案和门槛语气；没有绘制暗示实测比例的图表。结构组件的字号由登记入口按区域适配，组件文字相对自绘正文更小是入口既有适配结果，已检查其边界与承载面。模板页脚保留其既有外观，正文构图只使用安全区。

## 最终文件 SHA256

- `mckinsey-luna-reviewed.pptx`：`012D0DD34A2687CC73DB4C38E2DC897A07AC2ABAAC4E838F57B1DECFDE0B058C`
- `reviewed-render/slide-01.png`：`A4A3F1475231432011B914C5B72EADEDD30127D08182F047D3E009029DBB42D8`
- `reviewed-render/slide-02.png`：`49A103EF40F0CFD0E50441185CCE3623058F4DED59B96E76D3004734824AC4BD`
- `reviewed-render/slide-03.png`：`639FDDCF6F1917FD9C008CA1B56214CE2ACC07551D5B14CF60EEED58D652A806`
- `rules-load-stdout.txt`：`E9C4967B1025F55159007877FA3661A6302722808A7E77B8F89BFAEE0FF27B16`

`mckinsey-luna-final-v2.pptx` 及其旧报告保留为父级否决的失败版，不能作为本轮通过证据。本轮是在多轮父级具体反馈后完成的反馈修订，基本可读性获得接受，不证明麦肯锡式规则在无历史上下文下稳定独立复现。
