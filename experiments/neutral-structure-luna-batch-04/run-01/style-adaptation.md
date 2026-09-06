# 原生结构样式适配记录

按 `ppagent-structure/references/invocation.md`，先调用结构并从 `presentation.inspect` 取得稳定 `sh/...` 对象 ID，再保留对象 ID、文本和几何，只修改本次 Skin 明确允许的文字样式、承载、边线和阴影。

| 对象 | 稳定 ID | 几何（适配前后相同） | 适配后样式 |
| --- | --- | --- | --- |
| `merge-input-1` | `sh/fu94fe98` | `[63,188,310,78]` | 填充 `#F5F4EF`；边线 `#D8D5CC / 1`；无阴影 |
| `merge-input-2` | `sh/hofulsf2` | `[63,384,310,78]` | 填充 `#F5F4EF`；边线 `#D8D5CC / 1`；无阴影 |
| `merge-input-3` | `sh/4r6dg7et` | `[63,580,310,78]` | 填充 `#F5F4EF`；边线 `#D8D5CC / 1`；无阴影 |
| `merge-result` | `sh/3qxwn2x8` | `[917,282,300,260]` | 填充 `#EEECE5`；边线 `#A35D4F / 2`；无阴影 |
| 输入标题 | `sh/utg3698n` 等 | `[89,201.83,265,24.52]`（同级位置按各路保留） | Noto Serif SC，21px，炭黑，bold，left |
| 输入说明 | `sh/wn6dc7eh` 等 | `[89,232.34,265,19.83]`（同级位置按各路保留） | Noto Sans SC，17px，正文灰，left |
| 结果标签 | `sh/sfqdkrep` | `[963,346.86,208,18.39]` | Noto Sans SC，15px，辅助灰，center |
| 结果标题 | `sh/dgzetcfa` | `[963,380.25,208,35.77]` | Noto Serif SC，21px，炭黑，bold，center |
| 结果说明 | `sh/1cvuxc7e` | `[963,431.02,208,54.13]` | Noto Sans SC，17px，正文灰，center，语义两行 |

`slide-01-authoring.layout.json` 是适配后原生布局与 resolvedTextStyle 的证据；`render-before/slide-01.png` 和 `render-imported/slide-01.png` 分别保留适配前后视觉结果。最终 PPTX 导入后的 layout 导出仍显示部分字体为 Artifact Tool 的默认解析值，但实际 PNG 已按适配后的颜色、承载和文字层级渲染，最终化器字体策略检查也仅观察到 `Noto Serif SC` / `Noto Sans SC`。
