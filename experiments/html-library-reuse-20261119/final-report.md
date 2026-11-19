# 完成报告：HTML实际接入现有汇聚资产

exact tip：`acaf72e306db0b6f16b5a50b12cf92816f00a789`。本次只新增 `experiments/html-library-reuse-20261119/`，不提交推送；既有未提交文档、生产代码、结构原件和上一轮冻结44项均未改。

## 交付入口与冻结清单

- `index.html`：两张新整页、上一轮两张临时HTML图、旧原生／生图并排放大；另列原资产造型参照、失败试排和两份原生候选。
- `outputs/overview.png`：六图总览；`README.md`：真实调用、任务适配、布局变化、接口缺口及编辑性边界。
- 冻结61项文件：`evidence/delivery-manifest.json`。
- 清单SHA256：`b4b4e329af2c9e30b4575f7f9579c3ecc1e32327c32482893eac745bba8a9e95`。
- A主图SHA256：`0840bd8056152542061500e9fef93c07602a317f8accafbd295cdafaba455f8c`。
- B主图SHA256：`642c68a167fc4d6e30721efc0ed68d0e29c02648bf21589c1990237da0a9714d`。

## 实际复用范围

真实执行 `convergence-many-to-one-003` 的资产源设计：原normalize、pathMarkup、inputMarkup、resultMarkup及renderAdaptiveMarkup保持字节一致，精确证据在 `evidence/final-audit.json`、`evidence/convergence-local.diff`、`evidence/structure-calls.json`。SVG曲线是原函数输出，不是手写简单箭头或预览PNG。

原共享适配及原自适应HTML＋固定CSS均先实跑，保留裁切／错位证据。当前任务副本只改两条输入宽高下限，CSS补齐原变量绑定、旧TextRegion padding/gap与Skin字号；未回写资产或声称共享入口直接成功。

A采用大学外壳几何、左右两组，图示624×240。B将两点不足排在上方、四点感悟放下方，图示758×232，并压成单层页头；因此B同时包含整页重排作用，不宣称纯资产单变量比较。两张PNG均2560×1440，已逐张看图。

第二资产确有实际尝试：折角便签自然接口拒绝全文，自适应514×430出现标题／正文裁切；等权卡片共享1170×230也裁切。原始HTML/PNG和参数测量见 `evidence/library-probes.json`。按任务允许的替代路径使用同一汇聚资产的两种合理区域，不删文硬套第二资产，也不外推为任何区域都不能用。

## 检查及原生候选

- 两张HTML/PDF六块标签／正文覆盖均成立，父层裁切／画布越界0；最小正文18px；3条原曲线连入唯一结果，输入／结果边界误差小于0.007px。HTML中仅原校标为图片，原资产预览未嵌入。
- Gallery实际在本地浏览器打开，图片、链接、两个选择器、放大弹窗通过，JS错误0，桌面和390px手机均无横向溢出；见 `evidence/gallery-check.json` 及截图。
- 现有 `resolveHtmlComponent → compileResolvedVisualTree → PresentationFile` 已运行，两份候选分别38／37个原生形状，各3条可编辑custom path和1张校标，全部六块标签／正文在XML中。已用本机PowerPoint实际重渲染并逐张查看；正文保留整段文本框。
- **原生外观未达HTML一致性：** 输入单侧强调边丢失，单侧分隔线变框或丢失，内嵌编号样式丢失、B隐藏编号重现，A渐变方向变化，部分文字换行不同。文件明确命名为 `page-a-native-candidate.pptx`／`page-b-native-candidate.pptx`，只保留导出证据，不作为正式成品通过，也未修改引擎。

没有其他阻塞。等待reviewer对冻结产物与声明范围给出revise／approve；不自批、不代替用户验收。
