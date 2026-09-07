# 对照页目录

`baseline-montage.png` 是旧 `neutral-core-convergence-06` 三页原生 PPTX 的重新导入渲染 montage，仅作为工具链连通基线。

正式适配后，每个 case 应追加同一命名规则的文件：

- `<caseId>-attempt-01.png`：首轮调用/失败或首轮页面；
- `<caseId>-attempt-02.png`：反馈后的重排或重试页面；
- `<caseId>-final.png`：最终重新导入渲染；
- `<caseId>-compare.png`：首轮、反馈轮、最终版的可浏览对照。

对照页必须标明 `caseId`、`assetId`、`attempt`、`targetFrame` 与状态，不把旧 baseline 图标成新适配结果。

