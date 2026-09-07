# Archify Luna High 试验报告

## 结论

最终交付为 `candidate-v3.json` 渲染的工作流 HTML。v2 的语义内容被保留并重新组织为一条泳道中的横向主线；三段阶段标题、8 个节点、9 条关系、适配失败回到调整再重新判断、检查失败回到编排器、检查通过交付等语义均保留。该图表达的是未来目标流程，不代表 PPagenT 当前已经实现完整链路。

最终状态：

```text
diagram_type: workflow
output: C:\PPagenT\experiments\archify-luna-07\archify-luna-07.html
specification: C:\PPagenT\experiments\archify-luna-07\candidate-v3.json
specification_sha256: 5f589065422c0b77064df883cbbc689b85738f827581e73d1100c917c67a3388
specification_bytes: 3642
artifact_sha256: ea6cc4949e9a8b2a78277c8c5ed8a5dccf802dcdf0a81cdbce05378922f764e4
artifact_bytes: 714306
validation: 9/9 showcase, 0 errors, 0 warnings
visual_check: pass, exit 0
visual_review: failed (1440x900 light screenshot has a top-title crop in the current evidence)
correction_rounds: 1
```

## 命令与结果

所有命令使用固定运行时：

```text
C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
```

1. `node .../archify/scripts/check-update.mjs` → exit 0，`status: silent, reason: current`。
2. `node .../archify/bin/archify.mjs validate workflow experiments/archify-luna-07/candidate-v2.json --quality showcase --json` → exit 0，9/9 checks，0 composition errors，0 warnings。
3. `node .../archify/bin/archify.mjs validate workflow experiments/archify-luna-07/candidate-v2.json --layout-json` → exit 0，`viewBox: 831×1204`，`diagnostics: []`。
4. `node .../archify/bin/archify.mjs deliver workflow experiments/archify-luna-07/candidate-v2.json experiments/archify-luna-07/archify-luna-07.html --quality showcase --json` → exit 0；随后 v2 视觉检查发现桌面纵向溢出。
5. `node .../archify/bin/archify.mjs visual-check experiments/archify-luna-07/archify-luna-07.html --json` → exit 1。v2 在 1440×900、1600×1000、1920×1080、2048×1320 的 light 与抽查 dark 视口均有 `viewer/viewport-overflow`；1440×900 的 `scrollHeight=2217`，2048×1320 的 `scrollHeight=2399`。原因是 831×1204 的狭长 authored viewBox 在桌面宽度下等比放大，主图无法与标题、图例、流程边界卡片共存于首屏。
6. 创建 `candidate-v3.json`，将 4 条垂直堆叠泳道重组为 `全流程主线与回流` 单泳道，保留三段 phase header；将 `adjust` 与 `handoff` 分别置于对应主节点下方，保持所有关系和回路。
7. v3 首次校验 `node .../archify/bin/archify.mjs validate workflow experiments/archify-luna-07/candidate-v3.json --quality showcase --json` → exit 1；诊断为 `core` 与 `adjust` 在同泳道同列重叠。
8. 为 `adjust` 增加 `yOffset: 76` 后重跑同一 validate → exit 0，9/9 checks，0 errors，0 warnings；`--layout-json` → exit 0，`viewBox: 926×418`，`diagnostics: []`。
9. `node .../archify/bin/archify.mjs deliver workflow experiments/archify-luna-07/candidate-v3.json experiments/archify-luna-07/archify-luna-07.html --quality showcase --json` → exit 0，生成最终 artifact 收据中的 hash 与字节数如上。
10. `node .../archify/bin/archify.mjs visual-check experiments/archify-luna-07/archify-luna-07.html --json` → exit 0；四个 light containment 视口及 1440×900、2048×1320 的 light/dark 截图全部通过，`scrollWidth`/`scrollHeight` 均不超过 viewport，readability 与 viewerChrome 均 pass。
11. `Get-FileHash` 独立复核 → HTML SHA-256 `EA6CC4949E9A8B2A78277C8C5ED8A5DCCF802DCDF0A81CDBCE05378922F764E4`，v3 SHA-256 `5F589065422C0B77064DF883CBBC689B85738F827581E73D1100C917C67A3388`，与 deliver/visual-check 收据一致。

## 视觉复核

已打开并检查以下四张当前 sidecar 截图：

- `archify-luna-07.visual-check.1440x900.light.png`
- `archify-luna-07.visual-check.1440x900.dark.png`
- `archify-luna-07.visual-check.2048x1320.light.png`
- `archify-luna-07.visual-check.2048x1320.dark.png`

自动化 containment 在四个桌面尺寸均通过，截图文件也全部生成；但当前证据中 `1440x900 light` 截图存在顶部标题裁切，因此这里不把感知层视觉复核记为通过。其余已检查区域中，主线从稿件进入编排器到检查通过交付可见；适配失败→调整页面区域→重新判断与检查失败→回到编排器两条回路可追踪；图例和“流程边界”卡片可见。该标题裁切未在本轮继续启动新的浏览器或绕过 URL 安全策略处理，需后续在允许的本地预览入口复核。

保留两个视觉局限记录：节点左上角图标与标题的间距偏紧，部分节点视觉上接近重叠，但未观察到字符被图标覆盖；1440 宽度下最小自动测得上下文文字为 7.7px，自动 readability 通过但正文偏小。两项属于当前 vendor renderer 的视觉约束，未修改 vendor，也未用 CSS 隐藏溢出掩盖问题。

## 产物清单

```text
candidate-v1.json
candidate-v2.json
candidate-v3.json
archify-luna-07.html
archify-luna-07.visual-check.json
archify-luna-07.visual-check.html
archify-luna-07.visual-check.1440x900.light.png
archify-luna-07.visual-check.1440x900.dark.png
archify-luna-07.visual-check.2048x1320.light.png
archify-luna-07.visual-check.2048x1320.dark.png
```

未修改 `skills/vendor/archify`；所有试验输出均位于 `experiments/archify-luna-07`。
