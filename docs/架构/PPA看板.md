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

提供 HTML 审查组件和示例参数的资产可以直接切换登记的数量 State。正式运行方式与是否提供 HTML 审查相互独立：核心结构统一由 Native Builder 生成；没有 HTML 审查组件的旧资产仍可查看来源和 PPT 结果。

## 数据与预览来源

- `assets/`：核心资产与正式可调用 Skill；
- `备选资产/`：候选资产，只展示，不自动晋升；
- `catalog/`：Composition、Purpose、覆盖主题、契约和失败经验；
- `PPT源/`：唯一原始 PPT 来源目录；
- 每个资产目录的 `example.pptx`：看板中对应的真实 PPT 外观。

PPT 预览在首次进入可视区域或打开详情时生成，缓存在 `.tmp/asset-dashboard-previews/`。源 `example.pptx` 修改后，缓存会自动失效并重新生成。

## 重新构建应用

开发者需要重新生成 EXE 时运行：

```powershell
npm run assets:dashboard:exe
```

生成的 `PPA看板.exe` 是本机产物，已被 Git 忽略；构建源码和实时接口源码进入版本管理。
