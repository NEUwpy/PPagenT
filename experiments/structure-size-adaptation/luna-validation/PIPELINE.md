# 实际调用后的复用 pipeline

本目录已经准备一个仅针对旧 baseline 的工具连通 harness。它不调用结构，也不读取进行中的尺寸适配实现。

## 当前 fixture

复制自 `experiments/neutral-core-convergence-06/build/candidate.pptx` 的三页原生可编辑 PPTX。该 deck 只用于确认“导入 → layout/PNG/montage 导出 → 画布/对象检查 → 对照页”工具链可运行。

## 执行顺序

使用 `load_workspace_dependencies` 返回的运行时设置：

```powershell
$env:RUNTIME_NODE = 'C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$env:RUNTIME_NODE_MODULES = 'C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$py = 'C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$pptx = 'experiments/structure-size-adaptation/luna-validation/fixture/neutral-core-convergence-06-baseline.pptx'
& $env:RUNTIME_NODE experiments/structure-size-adaptation/luna-validation/run-baseline-pipeline.mjs $pptx experiments/structure-size-adaptation/luna-validation/pipeline-output experiments/structure-size-adaptation/luna-validation/pipeline-evidence
& $py 'C:\Users\ilove\.codex\plugins\cache\openai-primary-runtime\presentations\26.826.12353\skills\presentations\container_tools\render_slides.py' $pptx --output_dir experiments/structure-size-adaptation/luna-validation/reimport-render
& $py 'C:\Users\ilove\.codex\plugins\cache\openai-primary-runtime\presentations\26.826.12353\skills\presentations\container_tools\slides_test.py' $pptx
& $py 'C:\Users\ilove\.codex\plugins\cache\openai-primary-runtime\presentations\26.826.12353\skills\presentations\container_tools\create_montage.py' --input_dir experiments/structure-size-adaptation/luna-validation/reimport-render --output_file experiments/structure-size-adaptation/luna-validation/comparison/baseline-montage.png
```

`slides_test.py` 的输出要和 `pipeline-evidence/pipeline-report.json` 对照；若 deck 没有越界，报告中 `outsideSlideCount` 应为 0。`reimport-render/` 是 presentations 官方重新导入渲染产物，`comparison/` 用于后续把首轮与反馈后的最终版本并排保存。

## 四场景记录

正式适配调用沿 `cases.json` 执行，按 `RECORD_TEMPLATE.ndjson` 追加：

1. discovery：保存重新发现和 inspect 的契约快照；
2. invocation：保存每个真实 `invokeStructure` 的参数、区域和结果；
3. feedback：保存原始失败/空间反馈、来源和处理动作；
4. render/review：保存最终 PPTX、重新导入渲染、montage、对象与视觉检查。

四个核心场景建议优先覆盖：大区域汇聚、局部流程+侧栏、长稿循环、矩阵空间不足后重排。因果局部场景作为第五个结构类型保留，以避免只验证同一种几何。

## 结论边界

baseline harness 通过，只能说明工具和目录组织可复用。它不等于 `invokeStructure` 成功，不等于结构尺寸适配通过，不等于正式资产或新页面 QA 通过。

