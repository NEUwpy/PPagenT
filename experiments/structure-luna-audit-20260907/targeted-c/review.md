# targeted-c 复核记录

## 修订轮次

- 已保留首轮重导入 PNG：`review-before-fix/rendered-01.png`、`rendered-02.png`、`rendered-03.png`。
- case-12 按 `assets/结构图/简明转化漏斗-001/review.mjs` 的 `funnelGeometry` 与 `flowArrowMarkup` 重算：漏斗收窄到页面中轴附近，独立曲面层使用椭圆上下沿和多点曲面侧边，导流箭头按漏斗宽度函数分段逐层变窄并渐强。
- case-18 保留 7 项同级外围与中心向外支持关系，去掉“合规检查”的红框与加粗，七项恢复等权。
- case-30 将山体基底上移到正文注释上方，分面 seam 限制在山体内部，底部说明留在山脚下方的空白区。

## 当前验收边界

最终 `rendered-01.png`、`rendered-02.png`、`rendered-03.png` 来自最终 `candidate.pptx` 的重新导入。结构调用、PPTX 包完整性、layout geometry 和 PNG 视觉检查均需以最终轮产物为准；`invokeStructure` 的返回仍只代表原生对象已生成，不替代视觉验收。
