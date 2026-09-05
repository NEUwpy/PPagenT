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
