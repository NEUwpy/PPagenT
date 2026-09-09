# M1：整稿与单页覆盖边界验证

## 验证问题与输入

现有单页分组校验能否发现分页前的遗漏？使用既有模拟稿 `experiments/visual-balance-cold-run/manuscript.md` 的 N1 三段原文，未改写。独立于页面分配冻结来源 ID，原稿哈希和原文见 result.json。这是主任务构造的机制对照，不是新稿冷启动、自动分页或视觉验收。

## 复跑与结果

运行 `node experiments/page-content-boundary/probe.mjs`。

| 对照 | 单页入口 | 整稿来源核对 |
| --- | --- | --- |
| 完整三段进入页面 | complete-verbatim | 无遗漏 |
| 分页时去掉第三段，再提交单页 | complete-verbatim | N1.p3 遗漏；包含特殊依赖限制、试点安排、结果不确定性和回退动作 |
| 同样内容放入两页 | 两页均 complete-verbatim | 三段均重复；是否合理仍需语义判断 |
| 固定完整单页原文后，分组漏掉第三段 | 正确拒绝 | 页内覆盖机制有效 |

## 诊断与边界

主要断点是整稿来源到页面分配的核对缺席。prepareContentDraft 的输入本来就是单页原文，因此本结果不是其页内算法失效；调用方不能把单页 complete-verbatim 提升为整稿完整声明。

来源 ID 核对在此仅作为实验判据，不是已接入生产的接口。它不证明页面职责、证据与条件共存或重复是否合理，也不支持摘要及跨段拆组。没有生成 PPT，M1 保持进行中。

本轮相关既有测试：`node --test tests/content-stages.test.mjs tests/composition-intent.test.mjs tests/composition-resolve.test.mjs`，12/12 通过。

## 下一步

在不预分配页面的新稿上形成一次整稿到页面的内容组织产物；先从原稿冻结来源，再核对分配，验证遗漏检查与真实分页是否能共同工作。根据该产物决定最小接入方式，不先建设完整新 Schema 或排版引擎。
