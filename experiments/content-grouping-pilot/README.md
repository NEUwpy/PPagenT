# P3 分步内容流程试点

输入：`../visual-balance-cold-run/manuscript.md` 的 P3，全部为模拟材料。

本次先运行 Luna high 做分组，完成后由主任务核对完整原文及语义关系，再生成实文草稿并查看图像。通过后才继续让同一个 Luna 选择媒介。Luna 没有获得整页构建任务，主任务负责试排、构建及验收，因此这不是一次独立生成成功率测试。

## 实际数据路径

1. `luna-grouping.json`：模型原始输出，十个正文组加主题，原文不改写。
2. `prepare.mjs` → `content-draft.json`：仅将 relations.from 序列化为数组；检查每段原文归属、遗漏和重复。
3. `build-draft.mjs` → `text-draft.html/png`：实文放入逻辑分区；调整了三列解读共同起线与底部间距。
4. `grouping-review.json`：主任务针对该内容哈希的语义及实文草稿复核。
5. `selections.json`：Luna 第二阶段提出三表七文。`select-and-check.mjs` 实测三表侵入解读区，保留失败图；本轮完整原文约束下回到文本，不删边界。`bound-expressions.json` 将最终选择与既有正文绑定。
6. `build-page.mjs`：从绑定产物读取正文，测量行数与容量，经 resolveComposition/buildComposition 执行大学 Skin 单页；没有调用结构库组件。主题条采用简要主题，完整主题段在草稿和备注，十组正文原文均保留。
7. `finalize.mjs`：PPTX 包与几何检查、重新导入渲染、逐组检查导出 XML 正文。`index.html` 汇总各阶段。

主任务已检查实文草稿及原生渲染，修正了垂直居中、各列剩余空间造成的解读轴错位、段首标点及默认阴影。这里的布局与媒介选择仍包含人工判断；内容哈希、覆盖校验不能替代这种判断。

## 复跑

依次运行本目录 `prepare.mjs`、`build-draft.mjs`。查看草稿并生成针对当前哈希的真实复核后，再运行 `select-and-check.mjs`、`build-page.mjs`、`finalize.mjs`、`build-preview.mjs`。修改原文后不能沿用旧复核记录。

本实验验证一页内容在分步流程中不被组件选择吞并。未验证其他稿件、所有结构、自动审批、语义判断的确定性或正式生产线接入。全文保留模式尚不支持带依据的摘要改写。
