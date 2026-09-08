# 结构构建接口

运行 catalog.mjs guide <assetId> 查看当前实现。优先使用 skill.implementation.mode = preserved-design 的登记实现：直接复用原造型，按本页区域计算图形和文字。

```javascript
import { invokeStructure, closeStructureRuntime } from '<到本 Skill>/scripts/invoke.mjs';
try {
  await invokeStructure({
    root, slide, skin, targetFrame,
    execution: 'preserved-design',
    content, // 按该结构的现有语义字段提供；见 review.mjs 的 previewParameters
    references: [{ assetId, preservedFeatures: ['designBoundary 中的全部不变项'] }],
    evidencePath, pageId, regionId, reason,
  });
} finally {
  await closeStructureRuntime();
}
```

首批支持折角便签（items，4–8 项）、简明漏斗（inputs，0–7 项；steps，3–6 层）和成熟度阶梯（levels，3–6 级；可选状态）。当前数量范围沿用原实现；区域不再锁死 1170×492，按真实文字测量判断能否容纳。没有声称任意小区域或任意数量都可用。

图形由原 review.mjs 的路径、曲面或透视函数生成，按区域保持比例、居中；文字按允许档位匹配尺寸并重新换行。默认沿用基础文字组件字号阶梯，最低 12 pt；Skin 明确指定的 typography 角色固定，只有同时提供 typographyTiers 对应角色数组时才允许在其中选档。到了选定档位仍容纳不下则拒绝，不在测量后继续逐字缩小、裁剪或删稿。HTML/DOM 为测量和编译中间结果；曲面、折页和阶台编译为可编辑路径，图标仍沿用现有 SVG 图像节点。用户不需要填写旧 State 或文字框坐标。

成功回执 validation=rendered-unreviewed 只证明生成了对象，最终 PPTX 还需渲染并对照原样例检查不变项。每次成组构建结束调用 closeStructureRuntime 关闭浏览器；不要在其他并行构建尚未结束时关闭共享运行时。

尚未登记适配实现的结构，现有 references + content + targetFrame + build 接口暂留给迁移和实验。build 是实际函数，接受 { slide, skin, frame, content, references }，不是字符串代码。保留造型模式不接受自定义 build，也不会自动退回自由重绘。

共同检查：targetFrame 必须在 Skin.bodyFrame 内；引用必须存在；构建需产生原生对象；失败事件会记录。失败可能留下部分对象，重试使用新 slide。旧 assetId + parameters 不会悄悄回退旧执行器，旧双导演 API 工作台仍独立使用 legacy 实现。

编写迁移代码时，以实际最终页面检查箭头方向。artifact-tool 的 head 位于 from 端，tail 位于 to 端；层级页同时核对实际上下位置。图形和文字的 authoring 单位使用 CSS px，PPTX 导出自行转换为 pt。

## 三个试点的尺寸与文字

推荐从原尺寸的 100% / 85% / 70% 三个样本选占区，分别为 1170×492、994.5×418.2、819×344.4；这是验过样稿的尺寸示例，不是任意内容的容量保证，也不是三套独立图形。仍通过 targetFrame 传实际区域，中间尺寸由同一原实现适配。漏斗按中心实际占区计算比例。

Agent 先用内容、区域与 Skin 正常调用。需要统一字号时，在 skin.typography 指定角色，整组同类文字统一；需要允许两档时，可另给 skin.typographyTiers，例如 componentBody: [17, 15]。不提供档位数组则尊重显式字号。图标、编号圆、内边距由实现联动，不向 Agent 暴露逐零件坐标。

特殊需求可以复制原 review.mjs 的绘制方法到本次任务，以原路径和不变项为基础局部调整，通过已有 build 接口执行，再重新检查 HTML 与最终 PPTX。局部调整只属于本次产物，不能自动覆盖库内实现或绕过字号边界。

最新样例：experiments/structure-size-pilot/index.html。原 preserved-pilot 保留上一阶段字号锁定的结果用于比较。

中性 Skin 的整页压力实验见 experiments/structure-neutral-luna-20260908/README.md。中性角色规则中的数字是设计 px，传给结构 typography 前乘 0.75 转为 CSS pt（17px→12.75pt，15px→11.25pt）；显式 Skin 合法字号优先于默认结构阶梯下限，不能混用单位。id 为 neutral-editorial-001 时，35 个已审批结构（包含这三个尺寸样板）统一经过 neutral-structure-theme.mjs 转换；没有样板专用的颜色分支。保留原稿色阶与透明度，卡片与背景区分。颜色转换不能替代尺寸、容量或整页排版检查。

恢复失败前先核对结构区域与页面其余内容是否相交；若改短正文或将说明移到图外，要明确记录内容分工变化，不能声称“同稿仅扩区”。筛选收敛不能仅因有多个阶段而改画成能力成熟度。
