# 首张完整整页：真实汇聚结构接入

exact tip：`acaf72e306db0b6f16b5a50b12cf92816f00a789`。只新增 `experiments/html-library-reuse-20261119/`，上一轮冻结44项已逐项核对不变；现有未提交文档和资产原件未改。

## 已完成的对象

- 完整HTML：`outputs/page-a.html`；完整PNG：`outputs/page-a.png`（2560×1440），已打开整页及原结构预览对照。PDF也已实际浏览器导出。
- 真实源设计：`convergence-many-to-one-003` 的 `review.mjs`。直接沿用其中 normalize、pathMarkup、inputMarkup、resultMarkup、renderAdaptiveMarkup；不是手写几个方框箭头，也没有把预览PNG贴进页面。
- 页面使用大学Skin的原校标、颜色主题、字体和academic-report几何；正文18px，块标题21px。三项障碍的原文按两行形式分工，合并可逐字重建原段落；没有省略版正文或重复全文。

## 核查到的缺口与任务局部适配

- 先实际运行了共享 `sharedPreservedComponent`：首输入内容发生裁切，原始渲染保存在 `evidence/convergence-shared-adapter.png`。
- 直接运行原 `renderAdaptiveMarkup`＋原component.css：CSS固定left/width/height未完整消费新变量，形状与路径错位；保存在 `evidence/convergence-adaptive-original-css.png`。
- 最终只在本任务副本 `src/convergence-local.mjs` 调整输入宽度下限190→240、输入高度下限58→64；原三次贝塞尔路径函数和连接计算未改。另用 `src/asset-adapter.css` 绑定原markup输出的尺寸变量、去掉旧TextRegion兼容样式的多余padding，并按Skin角色定字号。没有回写结构库或声称原共享接口已自然成功。
- 调用参数、源文件hash、局部变化、两种区域和布局数据见 `evidence/structure-calls.json`。

## 实际检查

`evidence/page-a-audit.json`：六块标签／正文覆盖均true，父层裁切及画布越界0；三条路径的输入端与结果边界误差均小于0.006px；3个分离输入、3条平滑粗曲线、唯一结果均保留。原预览只作来源造型参照，未嵌入新页。

## 后续继续

折角便签自然接口对第一项全文明确拒绝；其实际自适应试排及等权卡片共享适配都出现标题／正文裁切，失败HTML、PNG和测量已保留在 `evidence/library-probes.json` 及同目录。按任务允许的替代路径，正在收尾同一汇聚结构的另一种合理整页分配对照、gallery和可选原生导出，不会靠删正文或持续压字号硬套第二资产。

本报告只提交page-a完整样例供先审图；其余继续，不自评或代替用户验收。
