# targeted-c

指定补测 3 页：case-12 / convergence-simple-funnel-001、case-18 / hub-directed-outcomes-002、case-30 / progression-growth-curve-004。

构建脚本会通过 `invokeStructure({ references, content, targetFrame, build })` 记录真实调用，导出原生 PPTX，重新导入后生成逐页 PNG 与 layout JSON。

当前进度：首轮 3 页已构建并完成最终 PPTX 重导入；已发现并修正中心径向箭头方向（artifact-tool `head` 在当前运行时落到 from 端，改为原生线段加目标端三角形），同时收短漏斗入口导流箭头，避免压住第一层标题。正在重跑并复核 PNG/layout。

修订轮完成：旧版 PNG 已保留在 `review-before-fix/`；case-12 已按真实 review geometry 重建曲面圆台与 6 段逐层显现导流箭头，case-18 外围七项恢复等权，case-30 山体分面收回基底并将注释移入留白。最终候选已重新导出、重导入并通过结构包与 layout 检查。

最后文字修订：case-12 五个编号固定在箭头左侧，标签放在每层箭头右侧有效区，按最窄层宽度限制并允许层内换行，避免文字跨箭头或越出圆台。
