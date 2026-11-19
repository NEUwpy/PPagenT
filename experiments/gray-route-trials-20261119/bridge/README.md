# 单页 Markdown 到合规布局的独立验证

2026-11-19。三路比较稿之外，另用备件供应、汛期值班两份模拟 MD 检查语义到灰稿的交接，也复用了两种上线方案作为共同样本。

| 输入 | 语义中需要保留的内容 | 实测 |
| --- | --- | --- |
| 两种上线方案 | 两个可比较方案各有独立风险与准备事项，回退演练是共同前置条件 | [常规灰稿](output/options-standard-columns.html) · [布局](output/options-standard.layout.json) |
| 备件供应 | 5 个工作日与 1 个工作日以内、8%–12%、分级是建议、关键备件无论金额均须备案后加急 | [常规灰稿](output/spares-standard-columns.html) · [布局](output/spares-standard.layout.json) |
| 汛期值班 | 雨量两个触发条件为「或」，恢复须经确认；人员受伤或设备停机的规则适用于各类险情，留在险情分组中 | [常规灰稿](output/duty-standard-columns.html) · [布局](output/duty-standard.layout.json) |

GPT‑6.2 Sol 极高推理独立读取原稿并提交 [三份冻结语义响应](model-plans.json)。38 条引文与来源 ID 通过逐字匹配。备件原文同时使用「500 元以上」「500 元以下」，保留原词，具体等于 500 元时的归属仍需上游澄清。语义响应经人工核对。本地脚本从 MD 重读并校验来源、引用、分组、范围和绑定，再调用现有 TextFlow 与 Chromium。冻结响应读入后的生成无需逐页修改代码，重跑阶段没有模型 API 调用。

常规内容区 1170×492 和缩窄内容区 1020×450 各通过三页，正文均为 18px。770×270 时三页的比较列／分组列、分组行全部因正文越界被拒绝，保留失败 HTML、PNG 和诊断。正常及缩窄框的汛期稿行布局也能容纳，当前固定列优先的试验规则没有进行整页美学排名。通过几何检查的备件页仍有独立背景说明弱化重点的问题，适合用作语义精简和视觉层级回归样本。

首次以字形边界紧贴标题框，所有候选均出现同一标题越界。给标题容器增加 5px 安全区后才通过；另外将仅约束单组的附注放入相应组内。[首轮测量](first-pass-results.json) · [最终测量和拒绝记录](output/results.json)

反例注入中，虚构引文和不存在的范围 ID 被结构门拒绝。文案改成「无需完成回退演练」但仍保留真实引文，以及把上报义务绑到一个存在却语义无关的组，这两例均通过结构门。重复校验几何无法补足这两个缺口，内容审查必须直接核对源文与上屏语义。

## 真实模型调用

同一脚本用仓库配置的 DeepSeek 适配从三份模拟 MD 各请求一次 JSON，直接交给来源门、排版与布局导出。三页在标准区均有产物。上线页的引文引用了具体上线方式，实际文案却省去了周末切换和反馈分批推广。备件页也漏了中心库统一采购配送与各站点自行采购。汛期页重复了两组规则，默认区约用 463px，在 450px 的窄区被拒。呼叫日志、完整回复与每页诊断均已留存。[真实调用结果](live-output/results.json) · [原始响应](live-output/model-responses.json)

独立审稿再请求一次同一模型。备件页补回两种执行方式，汛期页去掉重复后窄区可排下；汛期日期仍放在值班组，整页适用范围须再核对。上线页的审稿清单正确指出上线执行方式漏项，但修订稿正文依旧没有补回。审稿「指出问题」与「修订后问题已消失」需要两次不同的核对。汛期首次审稿请求发生传输失败，仅重试这一条后得到响应。[审稿与复跑](review-output/results.json) · [首次失败](review-output/first-attempt-results.json) · [复跑响应](review-output/model-responses.json)

重跑使用本机 Chromium 和仓库既有依赖。默认读冻结响应，`--live` 限定这三份仓库模拟稿与官方配置端点，`--review-live` 读首次响应作审稿样本。

```powershell
node experiments/gray-route-trials-20261119/bridge/run.mjs
# 需项目现有 DeepSeek 配置，依次运行
node experiments/gray-route-trials-20261119/bridge/run.mjs --live
node experiments/gray-route-trials-20261119/bridge/run.mjs --review-live
```
