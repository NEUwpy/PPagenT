# B：异步导出任务消息时序

## 稿件关系

这是四个参与者之间的消息时序：用户端提交请求，导出 API 入队并立即返回任务编号；导出 Worker 后台领取任务并生成文件；用户端稍后查询，API 再向 Worker 查询状态，最后把文件地址返回用户端。请求与返回必须区分，且任务编号返回不等于导出完成。

## 项目结构库检索

使用运行时：`C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`

命令：

```text
C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .codex\skills\ppagent-structure\scripts\catalog.mjs list --logic sequence
```

结果：`sequence-flow-001`、`sequence-phase-gates-004`。

实际 inspect：

```text
C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .codex\skills\ppagent-structure\scripts\catalog.mjs inspect sequence-flow-001
C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .codex\skills\ppagent-structure\scripts\catalog.mjs inspect sequence-phase-gates-004
```

适配判断：`sequence-flow-001` 是 3–6 个有先后关系的语义节点，只有单条连续编号轨道和正文容器，不承载参与者、消息方向或请求/返回样式；`sequence-phase-gates-004` 要求 3–5 个阶段且相邻阶段各有一个必须通过的门禁，稿件没有门禁语义。因此第一层没有可直接调用的适配结构。

为核验父侧补充候选，又检索并实际 inspect：

```text
C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .codex\skills\ppagent-structure\scripts\catalog.mjs list --logic role-stage
C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .codex\skills\ppagent-structure\scripts\catalog.mjs inspect role-stage-collaboration-001
C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .codex\skills\ppagent-structure\scripts\catalog.mjs list --logic network
C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .codex\skills\ppagent-structure\scripts\catalog.mjs inspect network-internal-external-ecosystem-001
```

`role-stage-collaboration-001` 需要 3–5 个阶段、2–4 个角色和职责任务，契约要求二维 `role-stage` 数据；它能表达角色归属，但不能表达本稿的逐条 API/队列/Worker 请求与返回时序，所以不适配。`network-internal-external-ecosystem-001` 明确要求无序、多对多内外主体关系，且把时间顺序列为不可用，直接排除。

## 第二层选型

按 `skills/references/selection.md` 与 Archify 技能选择顺序，B 属于消息时序，项目结构库没有参与者/消息契约，故进入第二层 `Archify` 的 `sequence` 类型。读取了 `skills/vendor/archify/schemas/sequence.schema.json`、`schemas/common.schema.json` 和 `examples/async-job-roundtrip.sequence.json`，按字段形状重新编写本稿事实。为保留“Worker 从队列领取任务”的方向，后台段采用 Worker→队列“领取导出任务”（请求）与队列→Worker“返回任务数据”（返回）；生成文件写入返回消息的 `note`，避免不受支持的 Worker→Worker 自消息。

最终选型字段：

```json
{
  "contentRelation": "四参与者异步请求、入队、后台生成、查询与返回；请求/返回方向有区别",
  "projectCandidates": [
    "sequence-flow-001",
    "sequence-phase-gates-004",
    "role-stage-collaboration-001",
    "network-internal-external-ecosystem-001"
  ],
  "fitReason": "项目库候选无法同时承载参与者归属、消息方向、异步立即返回和后续状态查询；Archify sequence 契约直接支持这些字段",
  "selectedSkill": "Archify sequence（第二层）",
  "actualInvocation": "bin/archify.mjs validate/deliver sequence",
  "outputKind": "standalone HTML with inline SVG",
  "nativeEditablePptx": false,
  "unresolved": ["visualReview 未执行；因先前浏览器 URL 安全策略拒绝，未用浏览器/CDP 绕过，视觉状态未验证"]
}
```

## 实际执行日志

Archify 更新检查：

```text
C:\Users\ilove\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe scripts\check-update.mjs
=> {"status":"silent","reason":"current"}
```

第一次候选校验失败，保留诊断：

```text
validate sequence ...\run\B\async-export-sequence.json --quality showcase --json
=> ok=false; Sequence layout validation failed: Message "生成导出文件" spans 0px (minimum 60px)
```

首轮将自消息压缩为队列→Worker“领取任务并生成文件”虽能通过几何约束，但把主动领取的方向归给了队列，语义不足；经复核后最终修复为删除 Worker→Worker 自消息，改为 Worker→队列“领取导出任务”、队列→Worker“返回任务数据”，并用 `note` 保留“Worker 领取后生成导出文件”；随后校验通过：

```text
validate sequence ...\run\B\async-export-sequence.json --quality showcase --json
=> ok=true; checks=9/9; composition=pass; errors=0; warnings=0
```

最终交付：

```text
deliver sequence ...\run\B\async-export-sequence.json ...\run\B\async-export-sequence.html --quality showcase --json
=> ok=true; checks=9/9; composition=pass; errors=0; warnings=0
=> specification sha256=c7bf2ace69a17e8c0dc9ae2fac41543751a47fd2d825cb9ce97eb68b1fc9a8a1, bytes=2928
=> artifact sha256=3f0dd96d0cc8135af8d8b672aad190ef87635d7e6ca8366558e6c5ed58744083, bytes=709384
```

机器回执已分别保存为 `validate-final.json` 与 `deliver-final.json`。未执行 `visual-check`，因为该命令会启动本地浏览器检查；本次因先前浏览器 URL 安全策略拒绝而保留 `visualReview` 未验证状态，并非用户取消视觉验收。
