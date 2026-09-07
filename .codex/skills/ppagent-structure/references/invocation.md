# 原生构建接口

从项目根运行 catalog.mjs guide <assetId> 读取设计。资产参数、数量范围与 TextRegion 是历史样例实现细节，不再作为生产构建接口。

```javascript
import { invokeStructure } from '<到本 Skill>/scripts/invoke.mjs';
await invokeStructure({
  root, slide, skin, targetFrame, content,
  references: [{ assetId, preservedFeatures: ['本次保留的轮廓或层次'], changes: ['本次布局变化'] }],
  evidencePath, pageId, regionId, reason,
  async build({ slide, frame, skin, content, references }) {
    // 按本页内容计算几何，再通过 slide.shapes.add / connect 创建原生元素。
    // references 含设计原文及示例路径，不会自动执行原资产。
    // 文字正常排版：按语义字号、可用宽度和实际换行计算位置与高度。
  },
});
```

build 是当前构建脚本中的函数，不是字符串代码。使用实际 slide，不传 slide JSON；没有新增原生对象会报错。成功回执 validation=rendered-unreviewed，只证明执行产生对象，最终 PPTX 仍需检查与渲染。失败时 slide 可能包含局部对象，重试应使用新的 slide 或由调用方清理该次对象；日志保留失败。

执行器只检查参考存在、特征记录和本页区域边界，不使用资产旧字号、minimumFrame、stateFootprints、TextRegion、Slot Contract。实际文本需要有当前页的几何边界以便绘制和检查，这不等于恢复固定文字排版框。不要缩小文字来凑样例；可移动说明到图旁、调整比例或拆分页面。

初次编写 Native 构建方法时读取 presentations 的 API 文档。Shape 的 text.style.fontSize 使用设计 px；最终按 PPTX 的实际字号与行框检查。字体、颜色与文字角色来自当前 Skin 和绑定排版规则，不继承历史组件默认值。

旧调用参数 assetId + parameters 不会再触发旧执行器，需迁移为 references + content + build。closeStructureRuntime 为旧 finally 语句保留空操作；新执行器不启动 HTML 浏览器。导出、原生性、文字溢出、线条归属和视觉特征验证由本次构建负责。
