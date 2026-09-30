# 2026-09-28 能力盘点证据

结论与建设任务维护于[现有能力盘点与首批建设](../../docs/架构/现有能力盘点与首批建设.md)。这里只存可核对数据，不作为资产审批、模型生成或视觉验收。

- `inventory.json`：35 项结构元数据、实现和文件存在性，Logic/布局清单，最近八个工作台运行的状态与选型摘要。示例文件存在不表示本轮渲染成功；工作台路径为本机证据，未复制全部运行目录。
- `interface-probes.json`：现有函数对纯文字、多图区、note 与 label 的最小接口表现；另记录动态布局清单和公开文字库。
- `test-output.txt`：11 个测试文件的完整输出，51 项中 43 通过、8 失败。未改生产代码或既有断言。

从仓库根目录复现盘点和探针（会更新本目录对应 JSON 快照）：

```powershell
node experiments/capability-inventory-20260928/inventory.cjs
node experiments/capability-inventory-20260928/interface-probes.mjs
```

本次定向测试命令如下；重跑时另存新日志，保留此次失败基线：

```powershell
node --test --test-concurrency=1 tests/gray-layout-selection.test.mjs tests/hybrid-layout.test.mjs tests/content-layout-calibration.test.mjs tests/gray-expressions.test.mjs tests/gray-visual-plan.test.mjs tests/gray-regions.test.mjs tests/structure-skill-profile.test.mjs tests/structure-skill-execution.test.mjs tests/preserved-structure-build.test.mjs tests/runner-run.test.mjs tests/runner-build-tools.test.mjs
```

人工抽查既有 PNG：工作台运行 `20260927222844-7d6dce` 的 preview/slide-01、02，以及 `20260927115217-cc59a8` 的 preview/slide-01；同时读取其 source.md。抽查不构成全部运行的质量评价。
