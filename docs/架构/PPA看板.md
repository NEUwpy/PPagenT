# PPA 看板

PPA 看板是 PPagenT 的本地资产建设与审查入口。它不保存第二份资产数据库，也不把当前资产清单写死在应用里。正式运行时两个导演只输出内容和选择结果；看板展示的 HTML 与 PPT 来自 Structure Group 资产包中已经保存的确定性代码。

## 使用

把 `PPA看板.exe` 保留在项目根目录，双击即可。应用会：

1. 识别当前 PPagenT 仓库；
2. 结束这个仓库上一次遗留的看板进程；
3. 重新启动只绑定本机的实时只读接口；
4. 用新的启动地址打开正式 Logic 审查区，并重新读取仓库数据；

因此，关闭网页不会强制结束后台服务，但再次双击 `PPA看板.exe` 会自动重启它，不需要手工结束 Node.js 进程。

页面右上角的“刷新仓库”会重新读取仓库声明。

点击资产后，建设链区域依次显示：

1. `PPT源/` 中由文件和页码定位的主要来源与辅助参考组；
2. Structure Group 资产包中的专属实时 HTML Component；
3. 同一 HTML 布局经通用 Native 编译生成的 PPT 示例图像。

提供资产专属 HTML 审查组件和示例参数的资产，在点开一个 Structure Group 后会按维度列出 State 标签。例如组织树分别选择“部门数”和“每部门成员数”，鱼骨图分别选择“原因类别数”和“每类因素数”；任一选择都会刷新当前资产声明的 HTML 与 Native 结果，不必把所有组合并排铺开。HTML 由看板直接调用资产包代码实时渲染，修改组件后刷新页面即可看到结果，不再额外生成 HTML 审阅截图。来源页和 Native PPT 预览均可点击查看大图。

资产声明 `slotContract` 时，详情页还显示 Content Slots 契约。它表示父 State 将从同一布局中解析真实可填区域、容量和兜底方式；不是看板另存的坐标，也不表示子 Logic 已经接入正式生成。当前循环闭环已能展示该声明，子 Logic 选择与嵌套预览仍属于下一步最小实验。

`runtime.review.implementation` 只有明确声明为 `asset-specific-html` 时，才计入 HTML 迁移完成度。共享通用组件只能用于早期试验或占位，不得作为黄金状态复现完成的证据。`goldenState` 记录来源页对应的默认参数；用户先在看板核对黄金状态，再审核数量扩展与 Content Slot 边界，最后检查 Native 编译结果。

## 数据与预览来源

- `assets/`：核心资产与正式可调用 Logic；
- `备选资产/`：候选资产，只展示，不自动晋升；
- `catalog/`：Composition、Purpose、覆盖主题、契约和失败经验；
- `PPT源/`：唯一原始 PPT 来源目录；
- 每个资产目录的 `example.pptx`：看板中对应的真实 PPT 外观。

PPT 预览在首次进入可视区域或打开详情时生成，缓存在 `.tmp/asset-dashboard-previews/`；State 对应的 Native 预览缓存在 `.tmp/asset-dashboard-native-state-previews/`。来源页在 Windows 下优先调用本机 PowerPoint 只导出声明页，没有 Office 时回退到 Artifact Tool；首次读取大模板会显示加载提示，生成后缓存在 `.tmp/asset-dashboard-source-previews/`。

预览 URL 带有由真实输入文件修改时间生成的版本号，并允许浏览器长期缓存。文件没有变化时，重新打开或刷新看板直接使用已加载预览；资产代码、源 PPT、Skin 或 HTML 运行时变化后，版本号自动改变，只让对应预览失效。仓库数据本身不缓存，因此资产增删和状态变化仍会立即出现。

`example.pptx` 不是手工拼出的另一份状态库。运行 `npm run assets:examples` 时，工具读取每个 `asset.json` 的 State 控件，并用同一 `review.mjs` 参数解析器和资产声明的 Native 出口生成整个家族。

## 重新构建应用

开发者需要重新生成 EXE 时运行：

```powershell
npm run assets:dashboard:exe
```

生成的 `PPA看板.exe` 是本机产物，已被 Git 忽略；构建源码和实时接口源码进入版本管理。
