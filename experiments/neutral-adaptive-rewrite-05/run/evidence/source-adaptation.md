# adapted-source 说明

本页沿用 `assets/结构图/多路汇聚结果-003/` 的构造方法：三路同级输入卡、每路一条由输入右侧出发的渐变汇流路径，以及一个共同结果节点。原组件的内容语义和输入顺序保持不变，原资产仍为只读参考。

本地 `adaptive-component.mjs` 做了局部派生改写：

- 将原 1170×492 全正文设计帧改为目标区域参数 `TARGET = { left: 62, top: 140, width: 700, height: 470 }`，结构面积约占整页 35.7%，为右侧说明栏保留独立空间。
- 保留原“输入数量驱动 laneGeometry”的方法。目标区域的 width 参与输入卡宽度、结果卡宽度与结果位置，height 参与输入卡高度、三路 y 分布、结果卡高度及曲线控制点偏移。
- 原 SVG 三次曲线改为由同一 cubic-bezier 采样结果生成的原生 `custom` path 折线，保证节点和曲线来自同一布局模型，并保持三路平滑合流的视觉语法。
- 结构节点使用 Noto Serif SC 21 px 模块标题和 Noto Sans SC 17 px 正文；结果标题使用 Noto Serif SC 21 px，页首使用 Noto Serif SC 25 px。右侧说明栏使用 Noto Serif SC 21 px 组标题与 Noto Sans SC 17 px 正文。
- 本页右侧明确呈现“交接确认”“缺失待补”“事实边界”，并保留待补内容不能当作已核实事实、未宣称故障排除且无时间节约/完成率数据的边界。

本次没有执行 `invokeStructure`，因此报告模式为 `adapted-source`，不声称原库调用成功。未修改 `asset.json`、`review.mjs`、`runtime.mjs` 或 `component.css`；`source-hash-comparison.json` 记录了前后 SHA-256 一致。

本实验只验证这一页和这一组目标参数，不证明 3–6 路状态的通用响应式能力，也没有扩展全库。
