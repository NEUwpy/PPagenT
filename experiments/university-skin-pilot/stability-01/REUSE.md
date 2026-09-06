# 在 Luna/high 中复用本轮编排规则

当前可复现包是 `inputs-v9-execution-02/`：`layout-guide.txt` 负责整页论证、主次和语义分区，`theme.json` 负责主题，`execution-contract.md` 负责绘图端点与文字检查，`task-prompt.txt` 负责完整执行流程。

在一个空白 Luna/high 上下文中，给出下面的任务，并替换两个路径：

```text
完整阅读 C:/PPagenT/experiments/university-skin-pilot/stability-01/inputs-v9-execution-02/task-prompt.txt，按其要求生成完整、原生可编辑 PPTX。
原稿：<原稿绝对路径>
输出：<独立的新输出目录>
不要读取历史生成结果或参考图片，不使用视觉；可检索结构 Skill，使用文字、几何和最终文件检查工具。
```

运行环境仍是项目现有 Codex Agent 与 artifact-tool，不是单次裸 API 的替代提示。不要将该提示直接视为已经验证过的 DeepSeek/Harness 系统提示。

最后一次生成后重新检查最终 PPTX 和最新 layout；过期日志不能证明新文件通过。源稿按段落逐一核对，尤其检查整段方案比较、条件和职责是否被跳过。保留第一提交，再另存修订。输出图形问题、源稿覆盖问题与人工风格判断分别记录。

当前实验发现执行补充改善了实际箭头和几何问题，但独立复验仍漏掉一段方案权衡。后续复验应加强逐段内容覆盖，不能只以“文字和图都没溢出”为合格。测试成绩和最终可查看版本见 `RESULTS.md` 与 `index.html`。
