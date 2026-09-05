# 原生调用接口

本文件相对于 Skill 入口；所有示例仓库路径从项目根解析。

```javascript
import { invokeStructure, closeStructureRuntime } from "<到本 Skill>/scripts/invoke.mjs";
// slide 来自 @oai/artifact-tool；skin 使用仓库现有轻量 Skin contract。
await invokeStructure({
  root, slide, skin,
  assetId,                 // catalog inspect 返回的真实 ID
  parameters,              // 根据所选 runtime 的实际参数接口绑定稿件
  targetFrame,             // {left, top, width, height}，1280×720 设计单位
  evidencePath,            // 本次运行的 .ndjson；调用前后自动追加事件
  pageId, regionId,
  reason,                  // 内容关系为什么需要这个结构
});
// 整份构建脚本的 finally 中调用（释放 HTML 浏览器）。
await closeStructureRuntime();
```

不要传 slide JSON 代替实际 slide 对象。`invokeStructure` 加入元素，整套 PPTX 的导出、文字/区域检查仍由构建脚本完成。事件 `success` 只证明渲染调用完成，不等于整页 QA 通过。

目录命令：

```text
catalog.mjs list
catalog.mjs list --logic sequence
catalog.mjs inspect sequence-flow-001
```

`inspect` 返回的 `previewParameters` 是参数形状示例、不是稿件；原始 manifest 与实现路径保留用于更深入核查。参数中的 `items` 不适用于所有结构；有些使用 `sides / layers / pros / cons / structuredData`，按选中资产实际接口处理。不得把所有结构统一塞进 items。

执行器：`src/runtime/assets.mjs` 的 `renderStructureAsset`；资产发现：`src/runtime/core-asset-packages.mjs`。当前包装器自动检查正文区边界与声明自然尺寸；语义及全部可变字段仍需依据 inspect 和组件返回的实际错误核查。

可参考 `experiments/penguin-harness-v2/grid-native.mjs` 复用模板页、写备注、导出与保留主题的方法，但不要继承它的固定 27/20 字号、等高槽位或每个区域都必须 skillId 的限制。

文字可直接使用 `src/asset-runtime/component-builders.mjs` 的 `addText(slide,text,frame,style)`；不设置 shrinkText。`fontSize / typeface / alignment / verticalAlignment / autoFit` 显式指定，之后检查实际导出文字行和包围盒。图片、线条和形状使用原生 API。首次编写构建脚本前按 presentations 技能加载运行时与 API 文档。

## 当前 Codex 试做发现的调用要点

- `theme.typography` 由 `htmlComponentThemeCss` 写成 CSS pt，原生 `shape.text.style.fontSize` 则使用设计 px。例如要输出 20 px 正文，结构主题传 15，原生文字传 20；最终检查实际字号，不把两个接口当成同一单位。

- Skin 旧契约仍有 `singleTitle / dualBody / bandBody` 等版式槽位。新排版不要继续按这些槽位选字号；读取本次指定版本的 Skin 设计提示词，按核心判断、组标题、正文、辅助说明和注释建立语义样式配置。结构外的普通文字同样需要正向编排指导，不能成为调用结构后的剩余填空；不同时加载旧候选字号，不擅自增加更小字号。
- 结构外的说明也属于本页正文。例如结构居中时，其贯穿规则说明应遵守本次同页对齐要求；编号标记与正文的区别须明确，不能把普通句子排除出检查。
- 预估换行只用于排放。导出后读取 `slide-XX.layout.json` 的 `elements[].bbox / resolvedTextStyle / textLayout.lines`，并核对原生文本行；实际换行可能比预估多一行。检查最终文字框之间的遮挡、行高容量及异常短行，不能只断言自己写入的 frame 合法就报告 QA 通过。
- `presentation.inspect` 可提供对象与文字概要，但对文本容量的检查还需结合字号、实际行数和区域；源模板的有意叠放与正文碰撞分开处理，检查未覆盖的部分如实报告。
- 每次构建使用独立 attempt 标记或追加日志，不在重跑开头清空 `structure-invocations.ndjson`。历史 attempt 与最终采用版本分开记录。
- Windows 下用 `fileURLToPath(import.meta.url)` 解析脚本路径，不能直接用 URL.pathname。将脚本从临时目录归档到 evidence 后，重新检查相对导入和项目根定位，并实际从归档路径运行。

## 原生样式适配

仅本次 Skin 要求与现有组件样式不一致时使用。`invokeStructure` 的成功仍只表示原生生成完成；在当前 builder 中识别该次新增的对象，保留对象 ID、数量、文本、位置、路径与方向，再用 artifact-tool 已支持的文字样式、fill、line、shadow 属性对齐本次 Skin。`shape.shadow = "shadow-none"` 可去掉阴影。字体、颜色与对齐变化后重新读回实际行和边界。

不修改核心资产文件，不删节点、连线或带含义的标记；不得把位图或重画的结构冒充原调用。带正负、强弱、分类等含义的视觉编码需原样保留语义。保存适配前后 ID/文本/几何对照及实际输出样式。遇到不能用样式属性解决的结构问题，换表达或报告限制，不通过偷偷移动节点绕过契约。
