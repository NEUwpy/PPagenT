# PPA 看板

> 状态：当前资产建设与审查工具。它展示仓库已经登记的事实，不代表候选三路径生成架构已经实现。

PPA 看板是 PPagenT 的本地资产建设与审查入口，不是正式生成的运行监控页。它不保存第二份资产数据库，也不把当前资产清单写死在应用里。正式生成、API 调用、运行日志和交付结果统一进入 PPA 生产工作台。

## 四个能力域

看板顶层只保留四个长期能力域：

- **结构**：按 `Logic → Structure Group → State` 组织，不再设置“基础、常用、补充”层级；
- **文字**：统一管理受控 Markdown 语法、传统流式 Renderer 与命名区域模板，页面直接文字和 Structure 内文字共用同一套能力；
- **图像**：预留 Media、背景图、插画和截图的来源、裁切与安全区域管理；当前尚未建设，不用图标或装饰图形冒充；
- **排版**：展示 Skin、Shell、Content Frame、Composition 与 Surface，并为后续整页组合实验台提供容器边界。

“全部资产”、Manifest、规则目录和原始数据源只作为默认收起的技术记录，不再与四个能力域并列。Structure 的 HTML 与 Native/Skin 审批队列也默认收起，需要审查时再展开。

排版区只展示可复用的 Skin、Shell、Content Frame、Composition 与 Surface 能力，不再放置“人工代替视觉导演”的生成实验台。视觉导演的输入、输出和人工修改属于一次具体稿件的生成运行，统一进入 PPA 生产工作台。候选 `PageContentBlocks / PageExpressionPlan` Schema、固定内容原型与验证器仍作为多表达研究代码保留，但不会伪装成 PPA 已入库资产；Structure 第一轮集中建设已经冻结，看板以后还应能分别审查 Composition、Text 和 Media。

## 使用

把 `PPA看板.exe` 保留在项目根目录，双击即可。应用会：

1. 识别当前 PPagenT 仓库；
2. 结束这个仓库上一次遗留的看板进程；
3. 重新启动只绑定本机的实时只读接口；
4. 用新的启动地址打开 PPA 资产看板，并重新读取仓库数据；

因此，关闭网页不会强制结束后台服务，但再次双击 `PPA看板.exe` 会自动重启它，不需要手工结束 Node.js 进程。

页面右上角的“刷新仓库”会重新读取仓库声明。

看板不再展示正式生成流程、最近运行或调用统计。这些运行态信息由 PPA 生产工作台统一承载；资产看板只保留能力发现、预览和审批。入库不是顶层导航，HTML 与 Native/Skin 审批队列作为默认收起的建设链入口，需要时展开。

点击资产后，建设链区域依次显示：

1. `PPT源/` 中由文件和页码定位的主要来源与辅助参考组；
2. Structure Group 资产包中的专属实时 HTML Component；
3. 同一 HTML 布局经通用 Native 编译生成的 PPT 示例图像。

提供资产专属 HTML 审查组件和示例参数的资产，在点开一个 Structure Group 后会按维度列出 State 标签。例如组织树分别选择“部门数”和“每部门成员数”，鱼骨图分别选择“原因类别数”和“每类因素数”；任一选择都会刷新当前资产声明的 HTML 与 Native 结果，不必把所有组合并排铺开。HTML 由看板直接调用资产包代码实时渲染，修改组件后刷新页面即可看到结果，不再额外生成 HTML 审阅截图。来源页和 Native PPT 预览均可点击查看大图。

资产声明 `slotContract` 时，详情页还显示 Content Slots 契约。它表示父 State 将从同一布局中解析真实可填区域、容量和兜底方式；不是看板另存的坐标，也不表示子 Logic 已经接入正式生成。当前循环闭环已能展示该声明；子 Logic 选择与嵌套预览属于后续方向，当前暂缓。

每个 HTML Structure Group 的最终 DOM 通过 `data-slot-*` 暴露完整 Slot Contract。看板在当前 State 加载后自动列出字段、位置、尺寸、最大字数／行数以及图标来源与必填状态；同一结果叠加到 Native 与 Skin 预览。视觉导演收到的 `slotCapabilities` 也由这些容量与媒体声明展开，不为看板或导演维护第二份表。

`runtime.review.implementation` 只有明确声明为 `asset-specific-html` 时，才计入 HTML 迁移完成度。共享通用组件只能用于早期试验或占位，不得作为黄金状态复现完成的证据。`goldenState` 记录来源页对应的默认参数；用户先在看板核对黄金状态，再审核数量扩展与 Content Slot 边界，最后检查 Native 编译结果。

## 数据与预览来源

- `assets/`：核心资产与正式可调用 Logic；
- `catalog/`：Composition、Purpose、覆盖主题、契约和失败经验；
- `PPT源/`：唯一原始 PPT 来源目录；
- HTML Structure Group 的默认 Native State：能力地图缩略图、详情预览和 PPTX 下载共用这一份编译产物；`example.pptx` 只保留为旧资产或脱离看板时的兼容示例。

HTML Structure Group 的 Native PPTX 在默认 State 首次进入可视区域时生成，并由该 PPTX 渲染唯一 PNG，统一缓存在 `.tmp/asset-dashboard-native-state-previews/`。缩略图与详情页直接复用同一 URL；切换其他 State 时才按需生成一次并缓存，不预编译全部组合。旧资产示例仍缓存在 `.tmp/asset-dashboard-previews/`。来源页在 Windows 下优先调用本机 PowerPoint只导出声明页，没有 Office 时回退到 Artifact Tool；首次读取大模板会显示加载提示，生成后缓存在 `.tmp/asset-dashboard-source-previews/`。

预览 URL 带有由真实输入文件修改时间生成的版本号，并允许浏览器长期缓存。文件没有变化时，重新打开或刷新看板直接使用已加载预览；资产代码、源 PPT、Skin 或 HTML 运行时变化后，版本号自动改变，只让对应预览失效。仓库数据本身不缓存，因此资产增删和状态变化仍会立即出现。

正式 HTML 资产不再用 `example.pptx` 建立第二条看板预览线。默认 State 和按需 State 均由同一个 Native 出口生成，最终 PPTX、缩略图和详情图保持同源。

## 重新构建应用

开发者需要重新生成 EXE 时运行：

```powershell
npm run assets:dashboard:exe
```

生成的 `PPA看板.exe` 是本机产物，已被 Git 忽略；构建源码和实时接口源码进入版本管理。
