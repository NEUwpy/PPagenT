# Luna high：预留编排试验逐页 Review

## 输入与边界

- 稿件：`../manuscript.md`。三页使用同一稿件，仅改变编排位置。
- Skin / Layout：`northeastern-university-001` + 现行 `mckinsey` generation 规则。
- 页面先由 `createNortheasternUniversityStarter` 建立现行模板，再由 `invokeUniversityStructure` 的大学专用入口调用 `progression-maturity-steps-002`，执行方式为 `preserved-design`。
- 结构区来自 `reserveRegions(universityMckinseySkin.bodyFrame, arrangement)` 的真实返回值；没有改写 `regions.mjs`、没有改区、没有把正文降到 18 以下。
- 阶梯图内只保留三个阶段名；“基本台账齐全”“任务来源、执行参数与输出相互关联”“关键步骤经复核、适用边界清楚”、阶段门槛、三项扩围条件和暂停规则均在 narrative 区完整呈现。

## 区域记录

| 编排 | visual | narrative | 结构调用 |
|---|---|---|---|
| `visual-left`（左图右文） | `(55,166,662,492)` | `(745,166,480,492)` | success，21 个原生对象 |
| `visual-right`（左文右图） | `(563,166,662,492)` | `(55,166,480,492)` | success，21 个原生对象 |
| `visual-top`（上图下文） | `(55,166,1170,283)` | `(55,477,1170,181)` | success，21 个原生对象 |

完整 JSON：`regions-first-draft.json`、`regions-revision-01.json`。逐次调用日志：`structure-calls-first-draft.ndjson`、`structure-calls-revision-01.ndjson`。

## 首版与修订

- 首版：`renders-first-draft-validated/`。三页页眉标签为“预留编排 1–3”，用于确认同稿三种位置差异。
- 修订 01：`renders-revision-01-validated/`。只将页眉标签改为“左图右文 / 左文右图 / 上图下文”，保留相同稿件、真实区域、结构调用和字号，以便阅读者直接识别对照类型。修订没有通过缩小正文或改变计算区域制造成功。

## 逐页审查

### Slide 1：左图右文

- 类型适用：适用。成熟度阶梯承担能力递进主证据，左侧形成先图后文的阅读路径。
- 内容完整：通过。三个阶段名在图内，三个阶段定义、前一阶段证据门槛、尚未可复用不能宣称跨项目推广、人员/资源/方法三项条件、任一条件不满足的暂停规则和下一次讨论顺序在右侧完整可见。
- 布局：`visual` 与 `narrative` 间保留 28px 间隔；阶梯连续踏面、立面、投影线和随透视承托面均保留。右侧两组文字沿同一左轴对齐，无越过预留区。
- 字体：页外正文实际请求 18，局部标题 21；结构阶段名由入口使用 Microsoft YaHei 18，模板页首继续使用大学 Skin 字体角色。
- 图文关系：阶段图在左，解释紧邻右侧；没有在图内重复长释义。

### Slide 2：左文右图

- 类型适用：适用。适合先阅读门槛与条件、再查看能力递进图的读者路径。
- 内容完整：通过。与 Slide 1 同稿、同文字覆盖，顺序只随左右编排改变。
- 布局：左侧两组 narrative 文字保持 480px 预留宽度，右侧阶梯落在 662×492 visual 区；结构没有侵入文字区。
- 字体：正文与局部标题分别保持 18 / 21；未使用自动缩小伪装容量。
- 图文关系：左侧先给出能力定义与扩围边界，右侧阶梯作为对应的能力关系证据，语义对应清楚。

### Slide 3：上图下文

- 类型适用：可用但密度最高。283px visual 仍容纳阶梯，181px narrative 通过两列承载完整文字。
- 内容完整：通过。两列分别承载“能力形成”和“扩围三项边界”，完整保留阶段定义、证据门槛、不能宣称跨项目推广、三项条件、暂停规则和下一次讨论顺序。
- 布局：visual 与 narrative 严格按 `(55,166,1170,283)` / `(55,477,1170,181)` 排列；PNG 中两列文字均在底部区域内，未出现裁切或溢出。
- 字体：正文仍为 18，局部标题为 21；没有把下方密集文字降为 meta 字号。
- 图文关系：上方先展示阶段递进，下方按两列解释能力与扩围门槛；阅读顺序自然，但可读余量低于左右编排。

## 实际验证

- `layout-reservation-luna-high-first-draft-validated.pptx` 与 `layout-reservation-luna-high-revision-01-validated.pptx` 均为 3 页可编辑 PPTX。
- 两版 finalizer：包完整性通过、页面尺寸通过、字体策略通过、Artifact Tool 重新导入通过，均无结构检查 finding 或 warning。回执见 `validation-first-draft.json`、`validation-revision-01.json`。
- `visual-audit.json`：两版三页均满足结构对象在 visual、narrative 标题在 narrative、正文字号 18、局部标题字号 21、对象在 1280×720 页面内。
- 已逐页查看修订版真实 PNG：`renders-revision-01-validated/slide-1.png` 至 `slide-3.png`。三种编排本轮均成功，没有失败方案需要隐藏或重试。

## 产物入口

- 当前修订交付：`layout-reservation-luna-high-revision-02-validated.pptx`
- revision-02 PNG：`renders-revision-02-validated/`
- 首版留档：`layout-reservation-luna-high-first-draft-validated.pptx`
- revision-01 留档：`layout-reservation-luna-high-revision-01-validated.pptx`
- 首版 PNG：`renders-first-draft-validated/`
- 构建与审计脚本：`build.mjs`、`finalize.mjs`、`render-validated.mjs`、`audit.mjs`

## revision-02 真实复核

revision-02 继续使用同一稿件、同一 `reserveRegions` 返回值、正文 18 和局部标题 21，并对三页都执行真实大学 Skin `preserved-design` 结构调用。左右两页只在既定 narrative 区内整体上移文字组约 60px，保留原有组内间距、并列条件分行和结论分段。

### Slide 1：左图右文

- 类型适用：适用。成熟度阶梯承担能力递进主证据，右侧 narrative 按“能力形成”和“扩围三项边界”分组。
- 内容与阅读：通过。阶段定义、阶段门槛、跨项目推广边界、人员/资源/方法条件、暂停规则和下一次讨论顺序均保留，未出现行首逗号或结论挤段。
- 布局：通过。结构对象保留在 `(55,166,662,492)`；narrative 文本框落在 `(745,166,480,492)` 内，整体上移后底部留有余量，视觉重心比 revision-01 协调。

### Slide 2：左文右图

- 类型适用：适用。左侧先给出门槛与边界，右侧阶梯提供对应关系证据。
- 内容与阅读：通过。与 Slide 1 使用同稿，三项条件逐行呈现，暂停规则与下一次讨论顺序分开，正文仍为 18。
- 布局：通过。结构对象保留在 `(563,166,662,492)`；左侧 narrative 文本框落在 `(55,166,480,492)` 内，整体上移后底部留有余量，图文重心可接受。

### Slide 3：上图下文

- 类型适用：失败。visual 区仍可放入成熟度阶梯，但 narrative 区固定为 `(55,477,1170,181)`，无法在正文 18 下承载完整五组语义层级。
- 处理：保留为失败诊断页，页内明确写出容量不足、保持正文 18 时无法同时承载完整层级的原因，并保留结构调用作为失败证据。该页不作为完整内容页，也没有通过删条件或缩字制造通过。

## revision-02 验证

- `layout-reservation-luna-high-revision-02-validated.pptx` 为 3 页可编辑 PPTX，finalizer 包完整性、页面尺寸、字体策略和 Artifact Tool 重新导入均通过，无结构 finding 或 warning。
- `visual-audit.json` 已覆盖三版记录；revision-02 三页结构对象均在 visual 区，narrative 文本框均在 narrative 区，实际正文与标题字号分别为 18 / 21，所有对象均在 1280×720 页面内。
- 已逐页查看 `renders-revision-02-validated/slide-1.png` 至 `slide-3.png`。Slide 1 与 Slide 2 通过人工 PNG 检查，Slide 3 按固定容量明确失败。
- 本轮属于有人工反馈的修订测试，尚未进行独立重复生成，不能据此宣称稳定性已验证。
