# 三个结构：尺寸、字号与小配件匹配

2026-09-08，接续用户认可基本造型后的修正。范围仍为双排折角便签、简明转化漏斗、成熟度阶梯。

原尺寸 L（1170×492）、85% M（994.5×418.2）、70% S（819×344.4）共 9 例，同结构使用同一份四项稿件。三个档位只是代表尺寸，仍使用一份原造型实现，并接受中间区域尺寸。另有 3 例 Skin-M，明确指定标题、正文、标签 17 pt，辅助文字 15 pt；便签与阶梯为此另备短稿，没有在运行时删减输入。

## 本次修正

- 字号范围继续复用基础文字组件阶梯。选最接近比例目标的允许档位，同角色统一；默认最小 12 pt。不是将文字乘任意小数，也不在测量失败后暗中继续缩字。
- Skin 显式 typography 优先并固定；仅当 Skin 同时提供 typographyTiers 时在其允许数组内选档。Agent 可统一安排这些角色，不需逐零件调参。
- 便签图标与标题字号联动，图标位保持在标题带中；漏斗图标、圆形容器、描边和内边距联动，收窄层文字使用实际可用宽度并调整位置；阶梯编号圆保留可读空间，状态标签和说明区底部留白随之调整。
- L 同尺寸的原有非文字图形几何与填充仍通过原实现对照测试。未将另外 32 个结构迁移为此入口。

## 验证证据

12/12 样例通过真实 invokeStructure preserved-design 入口导出可编辑 PPTX、重新导入并生成 PNG；源文字保留和原生对象检查见 deliverable-checks.json。report.json 记录每例实际字号与构建状态。已查看三张联系表覆盖 12 例，并放大检查窄层漏斗与小号阶梯；按检查结果修正了文字位置和底部留白后重新渲染。

相关定向测试 23/23 通过，覆盖原造型对照、字号下限、显式 Skin 固定及允许档位、长稿拒绝、主题与 Native 转换。源文字完整检查不等同于视觉检查，两者分别执行。

index.html 使用相同大小的背景画布显示真实占区比例；点击可看原尺寸 PNG、HTML 或下载 PPTX。上一阶段 24 例锁定字号的产物保留在 structure-preserved-pilot 供比较。

这是三个结构的样例验证，尚未完成自动 Layout 的整页端到端调用、全部 Skin 和更密内容的验收；本轮也没有重新运行 Luna 选择结构审计。尺寸百分比不保证任意稿件均可容纳，超出允许字号的实际容量时明确拒绝。

## 复现

```powershell
node experiments/structure-preserved-pilot/build.mjs --sizes
node experiments/structure-preserved-pilot/verify-deliverables.mjs experiments/structure-size-pilot
node experiments/structure-preserved-pilot/contact-sheets.mjs experiments/structure-size-pilot
```

单独更新某一结构可在 build 命令末尾加 notes、funnel 或 stairs。gallery.mjs 可单独重建展示页。
