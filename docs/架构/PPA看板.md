# PPA 看板

PPA 看板是 PPagenT 的本地资产建设与审查入口。它不保存第二份资产数据库，也不把当前资产清单写死在应用里。正式运行时两个导演只输出内容和选择结果；看板展示的 HTML 与 PPT 来自 Style Group 资产包中已经保存的确定性代码。

## 使用

把 `PPA看板.exe` 保留在项目根目录，双击即可。应用会：

1. 识别当前 PPagenT 仓库；
2. 启动只绑定本机的实时只读接口；
3. 打开正式 Visual Skill 审查区；
4. 重复启动时复用已经运行的看板，不再创建第二个服务。

页面右上角的“刷新仓库”会重新读取仓库声明。

点击资产后，建设链区域依次显示：

1. `PPT源/` 中由文件和页码定位的来源页；
2. Style Group 的实时 HTML Component；
3. 审核后 Native Builder 生成的 PPT 示例图像。

提供 HTML 审查组件和示例参数的资产，在点开一个 Style Group 后会按维度列出 State 标签。例如组织树分别选择“部门数”和“每部门成员数”，鱼骨图分别选择“原因类别数”和“每类因素数”；任一选择都会同时刷新 HTML 和 Native Builder 结果，不必把所有组合并排铺开。来源页和 Native Builder PPT 预览均可点击查看大图。正式运行方式与是否提供 HTML 审查相互独立：核心结构统一由 Native Builder 生成。

## 数据与预览来源

- `assets/`：核心资产与正式可调用 Skill；
- `备选资产/`：候选资产，只展示，不自动晋升；
- `catalog/`：Composition、Purpose、覆盖主题、契约和失败经验；
- `PPT源/`：唯一原始 PPT 来源目录；
- 每个资产目录的 `example.pptx`：看板中对应的真实 PPT 外观。

PPT 预览在首次进入可视区域或打开详情时生成，缓存在 `.tmp/asset-dashboard-previews/`；State 对应的 Native 预览缓存在 `.tmp/asset-dashboard-native-state-previews/`。来源页在 Windows 下优先调用本机 PowerPoint 只导出声明页，没有 Office 时回退到 Artifact Tool；首次读取大模板会显示加载提示，生成后缓存在 `.tmp/asset-dashboard-source-previews/`。源文件修改后缓存自动失效。

`example.pptx` 不是手工拼出的另一份状态库。运行 `npm run assets:examples` 时，工具读取每个 `asset.json` 的 State 控件，并用同一 `review.mjs` 参数解析器和 Native Builder 生成整个家族。

## 重新构建应用

开发者需要重新生成 EXE 时运行：

```powershell
npm run assets:dashboard:exe
```

生成的 `PPA看板.exe` 是本机产物，已被 Git 忽略；构建源码和实时接口源码进入版本管理。
