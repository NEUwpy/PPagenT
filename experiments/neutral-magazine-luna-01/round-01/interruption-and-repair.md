# 中断与自修记录

1. 首次最终化失败：第一方导入缺少 `RUNTIME_NODE_MODULES`。使用 `load_workspace_dependencies` 返回的绝对捆绑依赖路径补齐环境变量后重跑。
2. 第二次最终化失败：回执路径位于输出父目录，违反 finalizer 的“回执在任务空间且不在最终输出目录”约束。将最终输出放入 `deliverables/deck.pptx`，回执保留于 `.codex-finalizer/`。
3. 第三次最终化失败：`deliverables` 目录尚未建立。创建目录后重跑成功。
4. 首轮逐页视觉复核发现 Artifact Tool 的 `head` 在导出图中落在起点。运行 `test-connect.mjs` 探针确认 `tail` 的目标端行为，将主流程箭头改为 `tail`，关系图连接线改为无箭头关系线。重新最终化并渲染 `rendered-v2/`。
5. 最终版本未再修改；保留首轮候选、修复前版本、探针与两轮 finalizer 回执用于审计。
6. 恢复后全稿缩略图复核发现第 2 页右下收束句因承载宽度不足发生语义拆行。扩大该文本框并以新文件名 `deliverables/deck-v3.pptx` 重新最终化；最终渲染目录为 `rendered-v3/`，并更新根目录 `deck.pptx` 与 `preview/`。
