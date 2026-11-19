# HTML 接入现有结构库

2026-11-19，有界探索，基线 `acaf72e306db0b6f16b5a50b12cf92816f00a789`。入口：[并排 gallery](index.html)；[六图总览](outputs/overview.png)。本次不改生产代码、结构原件、未提交文档或上一轮冻结文件，不提交推送。

## 当前结果

| 整页 | 实际组织与区别 | 文件 |
|---|---|---|
| A | 大学原外壳和正文区；左为两点不足，右为四点感悟；汇聚区域624×240px | [HTML](outputs/page-a.html) · [PNG](outputs/page-a.png) · [PDF](outputs/page-a.pdf) |
| B | 同一汇聚结构758×232px；两点不足在上，四点感悟在下；页头压成单层、正文区随之扩展 | [HTML](outputs/page-b.html) · [PNG](outputs/page-b.png) · [PDF](outputs/page-b.pdf) |

两张主图均2560×1440，已逐张看图。B同时改变了整页分配和页头，不是只改变结构资产的单变量比较。正文18px；A块标题21px，B下方标题19px。没有靠删正文或连续缩字号获得空间。

共同内容取自上一轮 `content.json`，两组六块标签与正文保留；三项障碍按原文拆成标题／说明，顺序拼合可逐字重建原段落。原生旧稿、生图、上一轮临时HTML图均原样复制，只作对照；生图新增原因未采纳。[输入与源文件hash](evidence/input-manifest.json)

## 真实复用与局部适配

实际源是 `assets/结构图/多路汇聚结果-003/review.mjs`，由 [build.mjs](src/build.mjs) 载入任务副本并执行其 `renderAdaptiveMarkup`；输入与结果由原 `inputMarkup`／`resultMarkup` 及项目 `textRegionMarkup` 生成，连接仍来自原 `pathMarkup` 的三次贝塞尔公式。HTML中只有原校标是一张图片，结构由真实DOM与SVG路径组成，未嵌入原资产PNG。

保留分离输入、平滑粗汇聚路径、唯一结果和所有路径接入边界。[函数字节一致性／产物检查](evidence/final-audit.json)、[实际参数与区域](evidence/structure-calls.json)

原共享入口不能直接当作本次成功：

- 先实跑 `sharedPreservedComponent`，首输入裁切；[原图](evidence/convergence-shared-adapter.png)。共享CSS缩放仍把输入缩窄，并触及最低字号，未解决本稿容量。
- 原 `renderAdaptiveMarkup` 的几何变量与原固定CSS未完整绑定，形状、SVG和文字错位；[原图](evidence/convergence-adaptive-original-css.png)。
- 当前任务副本相对原review只有输入宽度下限190→240、高度下限58→64两行变化；原normalize、路径及输入／结果markup函数不变。[精确diff](evidence/convergence-local.diff)
- [asset-adapter.css](src/asset-adapter.css) 补齐原markup输出的尺寸变量绑定、TextRegion兼容padding/gap和Skin字号角色；所有输入锚点、曲线及结果边界由同一个原布局函数联动，不另画连接。未回写库内文件或晋升资产。

主题实际调用 `universityMckinseySkin`、`compileHtmlComponentTheme`、`htmlComponentThemeCss` 和 `htmlTextFlowCss`；校标沿用现有主题媒体。A采用academic-report的页头／正文几何，B是任务局部外壳重排。外围编号、分隔和四点感悟的普通文字布局借鉴既有home-mckinsey方法，由本次页面CSS编写，不冒称新调用了另一个结构资产。

## 第二资产为什么没有进入整页

实际尝试了 `parallel-folded-notes-grid-002` 和 `parallel-equal-cards-001`，使用四点感悟的完整标题／正文：

- 折角便签自然接口按4项状态52字容量拒绝第一项；其自适应HTML在514×430px下，标题超过纸面标题带，长段说明侵入折页／下排区域。
- 等权卡片共享适配在1170×230px下，几何按高度缩小后文字区域过窄，标题与正文裁切；未改成未经验证的多行卡片。

调用、失败HTML、PNG和测量均保留在 [library-probes.json](evidence/library-probes.json) 及同目录。它们只说明本稿已试区域未通过，不证明资产在所有区域都不可用。按任务约定，B转为相同汇聚结构的另一合理整页分配，不为凑第二资产删除原文或扩大迁移范围。

## 检查与编辑性

两张HTML的六块标签／正文覆盖、父层裁切、画布边界、logo比例和原设计不变项均检查；三条曲线起终点到输入／结果边界误差小于0.007px。两份PDF实际导出，原文覆盖成立。[A检查](evidence/page-a-audit.json) · [B检查](evidence/page-b-audit.json)

现有 `resolveHtmlComponent → compileResolvedVisualTree → PresentationFile` 已有界运行，两份候选PPTX用本机PowerPoint实际重渲染：[A候选](outputs/page-a-native-candidate.pptx)／[渲染](outputs/page-a-native.png)，[B候选](outputs/page-b-native-candidate.pptx)／[渲染](outputs/page-b-native.png)。A为38个原生形状、B为37个，各有3条可编辑custom path和1张原校标；六块标签／全文在原生XML中，正文以整段文本框保留，没有截图冒充可编辑。

**候选未达到HTML一致性：** 输入单侧强调边没有保留，单侧分隔线变为完整框或丢失，内嵌编号失去独立样式，B隐藏编号重新出现，A渐变方向改变；文本换行也有差别。当前只保留导出证据，不称为正式成品，不继续修改引擎。[原生试跑](evidence/native-probe.json)及[最初注释门错误](evidence/native-probe-initial.json)均保留。

这次证明的是有明确局部适配的源设计复用和当前两页实际效果，不代表原共享入口、全部结构资产或跨稿流程已成熟，也不代表用户验收。

## 复现

Windows、Node、现有项目依赖和本机Chrome即可重建主图；不调用模型API，不新增依赖。

```powershell
node experiments/html-library-reuse-20261119/src/prepare.mjs
node experiments/html-library-reuse-20261119/src/probe.mjs
node experiments/html-library-reuse-20261119/src/build.mjs
node experiments/html-library-reuse-20261119/src/render.mjs
# 可选的原生候选，保留上述外观差异
node experiments/html-library-reuse-20261119/src/native-probe.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File experiments/html-library-reuse-20261119/src/render-native.ps1
python experiments/html-library-reuse-20261119/src/audit.py
python experiments/html-library-reuse-20261119/src/gallery.py
node experiments/html-library-reuse-20261119/src/check-gallery.mjs
```

原生PowerPoint重渲染需本机Office。源、候选与最后图片hash见最终交付清单；上一轮44项及本轮读取的结构／运行时源文件已复核未改。
