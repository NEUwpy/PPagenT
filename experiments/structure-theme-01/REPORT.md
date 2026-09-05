# 存量结构主题统一报告

## 结论

- 35/35 个核心 Structure Group 已接入同一个可执行主题边界。
- 默认结构主色为 `#315F91`，来源是 `阶段门禁流程-004` 门禁勾选块的最强强调蓝。
- 蓝色与紫色主题共执行 70 次真实浏览器解析；所有有彩度的最终颜色均来自共享离散色阶，无固定蓝、青、红残留。
- 换色前后除颜色与带色 SVG 数据外，ResolvedVisualTree 的文字、节点、坐标、尺寸、路径、层级和透明度一致。
- 阶段门禁、行列交叉矩阵、优劣权衡天平、中心辐射、中心径向关系（向外与向内两个 State）、双向结论对比已生成蓝紫 HTML 对照，并编译为 14 页原生可编辑 PPTX 后重新渲染 PNG 核验。

## 实现边界

主题入口位于 `src/visual-runtime/html-component-theme.mjs`。历史组件颜色并未伪称为全部源码令牌化：代表状态的 CSS/markup 字面量已在 `INVENTORY.md` 和 `output/theme-audit.json` 显式盘点；新 Skin 的 `primaryColor` 在浏览器解析前把有彩度字面量归入 `primaryDeep / primaryDark / primary / primaryLight / primaryPale / primaryWash` 六个固定角色。灰色、黑、白及透明度保持。

颜色编译只进入 CSS 声明值、inline style 和 SVG/HTML 颜色属性；正文中的色号、CSS ID 选择器、URL、`id/href/data-*` 与脚本不参与转换。主题 CSS 带已解析标记，不会被二次映射。

正式运行、Native 编译与生成脚本通过 `resolveHtmlComponent` 使用该入口；PPA 的 standalone HTML 预览分支也显式调用同一编译函数，因此没有只改看板或只改 PPT 的分叉。

## 视觉核对

代表图中蓝、紫两种主题均保留浅底、主强调、深色文字和透明层次。天平的左右收益/风险仍由位置、标题与结构承担；双向对比的正负由左右位置、`×/✓` 符号与文案承担；矩阵由行列标题和单元标签承担语义，不依赖多色分类；中心径向关系的向内/向外阅读由箭头方向、中心与外围位置及文字角色继续区分。

## 证据

- `output/theme-audit.json`：35 项颜色来源和 70 次最终颜色记录。
- `output/*-blue-purple.html/png`：7 个代表案例的浏览器对照，其中中心径向关系分别覆盖向外与向内 State。
- `output/representative-native-blue-purple.pptx`：14 页原生可编辑输出。
- `output/native-render/*.png` 与 `*.layout.json`：构建时 Native 预览及对象布局。
- `output/representative-native-blue-purple/slide-*.png`：父任务从最终导出 PPTX 重新渲染的14页；复核紫色阶段门禁、矩阵、天平和向外径向案例。
- `output/generator-primary-purple.pptx` 与 `output/generator-theme-purple.pptx`：standalone generator 分别通过显式主色和主题 JSON 生成的紫色 Native 结果。

## 已知边界

- 未显式提供 `primaryColor` 的旧调用保持历史色，属于兼容行为，不等于新单主色契约。
- 本轮没有修改几何、字体、数量容量、minimumFrame、stateFootprints，也未扩展缩放能力。
- 既有 `core-html-assets-smoke` 仍暴露 `branching-scenario-fan-004` 的字号契约问题（实际 10.5pt，小于声明 12pt）；目标资产未在本轮改动，和主题颜色实现无关。

## 定向复验

- 上轮 `structure-theme + html-component-runtime + dashboard-components`：47/47 通过；最终解析器定向测试：9/9 通过。
- 安全边界覆盖正文色号、CSS ID 选择器、`url(#id)`、SVG `href`、`data-*`（包括属性值内形似 `fill='#E97132'` 的文本）和脚本不被改写；颜色属性及 inline style 正常换色。
- CSS 注释原文保持，位于前置或间隔注释后的真实颜色声明仍正常换色。
- CSS 声明值内部注释（如 `color:/* note #E97132 */#E97132`）同样保持注释色号，只转换真实颜色值。
- 35 个核心结构蓝/紫审计：70/70 解析通过，无非主题有彩度输出。
- standalone generator 的 `--primary-color` 与 `--theme` 均生成并重新渲染成功；batch generator 两种参数解析探针均返回 `built=0`，未写资产示例。

## 父任务审核

已检查主题入口、原生运行与看板路径，并复跑三组相关测试47/47；最后补充声明值内注释保护后，主题解析定向测试9/9通过。此前发现的正文/属性文本误换色、注释声明漏换色均已用精确用例覆盖。七组蓝紫浏览器对照已查看，最终PPTX重新渲染的代表案例也已查看。批准本轮存量主题接管，不将它表述为35个源码全部令牌化，也不将代表状态审计等同于所有组合状态穷尽验证。
