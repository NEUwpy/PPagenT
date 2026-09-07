# Baseline pipeline check

状态：`baseline_toolchain_verified`；尺寸适配：`not_assessed`。

使用 fixture：`fixture/neutral-core-convergence-06-baseline.pptx`，由 `neutral-core-convergence-06/build/candidate.pptx` 复制而来。两者 SHA256 均为 `7bcf0a203ae78b1b08f2c97433489896d1f0001741b98da63256520d0e69eb39`。

已验证：

- Artifact Tool 可导入 3 页 PPTX；
- 每页可导出 layout JSON 和 PNG；
- 可导出 deck montage；
- presentations `render_slides.py` 可重新导入渲染到 `reimport-render/`；
- `slides_test.py` 在显式设置 `RUNTIME_NODE`、`RUNTIME_NODE_MODULES` 后通过：`Test passed. No overflow detected.`；
- montage 已生成到 `comparison/baseline-montage.png`，并完成目视检查；
- layout 检查：原生元素数 21 / 35 / 31，图片数 0，画布外对象数 0。

曾出现的工具限制：`slides_test.py` 依赖环境变量 `RUNTIME_NODE` 和 `RUNTIME_NODE_MODULES`；未设置时会直接报 `RuntimeError: RUNTIME_NODE is required.`。已把正确环境设置写入 `PIPELINE.md`，重新运行后检查通过。

这些结果只说明旧 baseline 的导入、渲染、检查和对照路径可复用。它们不表示正式目录调用成功、不表示首批组件尺寸适配通过，也不替代新页面的结构关系、文字和视觉 QA。

