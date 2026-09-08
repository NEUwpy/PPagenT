# run-no-hierarchy

两页原生可编辑 PPTX 试测，依据 `common.md`、`no-hierarchy.yaml` 与 `manuscript.md` 完成。

- 页面：1280×720；白底；Microsoft YaHei；标题 32、图题 21、正文/标签 18、注释 14；主色 `#315F91`。
- 第 1 页：用共享 0–80% 横向条形比较完整保留 8 个比例、两组各 n=100、多选限制，并把校内/校外讨论优先级贴近证据呈现。
- 第 2 页：用三行共同评价维度比较两种归档范围，保留新增试行建议、历史覆盖不完整的代价，以及不编造投入金额/工时/成功率的限制。
- 实际技能与工具：Presentations skill；`@oai/artifact-tool` ES module；从最终 PPTX 重导入导出两张 PNG；`slides_test.py`。
- 迭代：2 次构建。首轮发现第 2 页右列越界，调整列宽与位置后重建；最终逐页全尺寸检查通过。
- 验证：`slides_test.py` 输出 `Test passed. No overflow detected.`；两张 PNG 均由最终 `deck.pptx` 重导入生成。
- 外部来源/图片：无；材料均为本组提供的虚构模拟材料。

