# 最终报告：五法同页对照

exact tip：`acaf72e306db0b6f16b5a50b12cf92816f00a789`。完成于2026-11-17；`git diff --name-only`为空，`git status --short`只新增本实验目录。未提交、推送或修改生产代码。

## 入口与实际范围

- 主入口：`experiments/layout-methods-20261116/index.html`；并排选择、原图放大、源码／PDF／原生PPTX链接齐全，含原灰稿、旧原生稿、生图参照。
- 八图总览：`outputs/overview.png`；精炼方法、责任、版本、适配、限制与复现命令：`README.md`。
- 五法全部真实执行：Marp CLI 4.5.1；SeaSlides HTML原模板及原编译器；Yoga 3.2.1实际测量／Flexbox；Slidev 53.1.0宿主整页设计／原生导出；Typst 0.15.2＋Touying 0.7.4实际编译SeaSlides navy-formal模板。
- SeaSlides HTML／Slidev落实三项障碍汇聚到落地阻力；Marp／Yoga／Typst明示为纯文字排版控制稿。没有运行外部模型自动设计链，也没有以同款手写HTML冒充不同框架。
- 共同内容：`content.json`；全部六块标签／正文保留，来源关系未加；历史三张图字节保留。全部方法PNG为2560×1440。

## 检查证据

- `evidence/output-audit.json`：五图尺寸，四份一页PDF的六项全文覆盖和文字span边界，两份PPTX的原生XML文本／形状数。所有覆盖为true，PDF文字span越界0。
- `evidence/yoga-measurements.json`：真实中文测量与Yoga几何，内容下界645／720px。
- SeaSlides `src/seaslides/output/dom-audit.json`：0 blocker；原 `--all --include-pptx` 生成8类产物及原编译收据。
- `evidence/gallery-check.json`：本地浏览器实际打开，图片加载、全部链接、两个选择器与弹窗通过；JS错误0，桌面／390px手机横向溢出0。截图留在同目录。
- `src/rebuild.ps1`已经实际完整运行，五法渲染、PDF/PPTX、PowerPoint重渲染、审计和gallery均更新；已逐张看图，SeaSlides总标题清楚可见。`evidence/delivery-manifest.json`冻结44个源码／主交付文件的字节数和SHA256。

## 必须保留的未通过范围

- SeaSlides官方最终delivery validator在Windows收据路径规则上未通过：9项反斜杠／POSIX canonical路径错误；原文 `evidence/seaslides-final-gate.txt`，原收据未改。真实编译、source gate、DOM检查与最终收据门分别陈述，不制造全通过。
- 原生PPTX是额外证据：SeaSlides55个原生形状＋1校标，Slidev48＋1校标，六项全文均在XML；两份都用本机PowerPoint打开重渲染并看图。Slidev有标点孤行／换行漂移，SeaSlides有字体映射／回退差异；均未声称达到网页图的一致性或正式交付质量，也未修上游。
- 只验证这一页；组件／整页设计仍有人工适配，不声称跨稿稳定、框架自动设计、商业选型或用户验收。

## 冻结的五张主图 SHA256

| 文件 | SHA256 |
|---|---|
| `outputs/marp.png` | `3897904a3522814571d71117d133e6b92463a9af3cd3de5fcf0ea8d18efba5f4` |
| `outputs/seaslides.png` | `465634916136216594bf08144a3db709777d4cb5f26ae474ed46d2c1fd578212` |
| `outputs/yoga.png` | `d94b4ed1357b57e661c657f9dea381ca4d010f2fce5a5a6865ecec5e6ebbaf7a` |
| `outputs/slidev.png` | `cbf1b049547694a27fe3d2a9c10cf980f40f650822cae5675ac97efa910a8f92` |
| `outputs/typst.png` | `0117349bb7199e564c71d968056aa7a6f35e3c4fe1cfaa077a3a2f100088f4f0` |

没有其他阻塞。等待reviewer对当前文件、图像和已明示边界给出revise／approve；不代替用户视觉验收。
