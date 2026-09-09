# Semantic composition pilot

本实验在真实东北大学 Skin 模板上，用 `src/composition/resolve.mjs` 的 `resolveComposition` 和 `buildComposition` 驱动三页组合，并通过 `build.mjs` 生成可编辑 PPTX。页内内容是明确标注的模拟材料，不对应真实学校或平台。

最终交付：

- PPTX：[final/semantic-composition-pilot-validated-20260909.pptx](final/semantic-composition-pilot-validated-20260909.pptx)
- 稳定文件名（与上列 SHA-256 相同）：[final/semantic-composition-pilot-final.pptx](final/semantic-composition-pilot-final.pptx)
- 最终 PNG：[renders-validated-20260909](renders-validated-20260909)
- Finalizer 回执：[.codex-finalizer-20260909/semantic-composition-pilot-validated-20260909.validation.json](.codex-finalizer-20260909/semantic-composition-pilot-validated-20260909.validation.json)
- 首轮接管归档：[archive/first-available-20260909](archive/first-available-20260909)

三页分别保留方案比较、阶段与关口、三证据论证。P1 保留六项比较维度和管理员工作日单位；P2 保留三个阶段、进入条件、关口与失败回退；P3 保留 74/120、14/78、17.9%、9/14、5.0、3.5、2.6 和模板稳定后 1.4 等口径。证据二的 9/14 只作文字说明，因为它与 17.9% 的分母不同。

生成与验证：

```powershell
$env:RUNTIME_NODE_MODULES='C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$node='C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node 'C:\PPagenT\experiments\semantic-composition-pilot\build.mjs'
& $node 'C:\PPagenT\experiments\semantic-composition-pilot\finalize.mjs'
& $node 'C:\PPagenT\experiments\semantic-composition-pilot\render-validated.mjs'
```

结构调用证据在 `structure-calls.ndjson`，解析和构建回执在 `resolved-P1.json`、`resolved-P2.json`、`resolved-P3.json` 及对应 `receipt-*.json`。
