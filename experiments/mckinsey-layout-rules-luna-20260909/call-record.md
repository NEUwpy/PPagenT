# 调用记录

| 时间 | 调用 | 结果 |
|---|---|---|
| 2026-09-09 | `npm run rules:load -- --profile generation --skin northeastern-university-001` | 成功，加载 `mckinsey` |
| 2026-09-09 | `build-deck.mjs --first` | 首版 PPTX 成功，3 页 |
| 2026-09-09 | `render-pptx-evidence.mjs mckinsey-luna-first-success.pptx first-render` | 成功，3 张 PNG |
| 2026-09-09 | `build-deck.mjs` | 修正版 PPTX 成功，3 页 |
| 2026-09-09 | `render-pptx-evidence.mjs mckinsey-luna-final-v2.pptx final-v2-render` | 成功，3 张 PNG |
| 2026-09-09 | `audit-rendered-typography.mjs final-v2-render` | typography/geometry 均 passed |
