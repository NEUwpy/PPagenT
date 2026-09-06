# Structure Theme 01

验证一个 Skin 只给出一个结构主色时，35 个核心 Structure Group 的 HTML、SVG 与 Native 输出是否统一跟随主题，同时保持原有文字、几何、层级和透明度。

默认蓝来自 `阶段门禁流程-004` 的 `gate-check` 强调块：`#315F91`。替换主题使用 `#6F42C1`。

运行：

```powershell
$node = 'C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node .\experiments\structure-theme-01\audit-and-render.mjs
```

只复验 35 个核心结构的蓝/紫解析与颜色来源、不重画既有证据时使用 `--audit-only`。

脚本输出 35 项盘点、70 次解析记录、7 组 HTML 蓝紫对照（中心径向关系分向外/向内），以及 14 页真实 Native 编译渲染。
