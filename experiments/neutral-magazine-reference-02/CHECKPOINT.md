# 用户认可的中性杂志风检查点

- 日期：2026-09-06。
- 用户反馈：“当前这个排版我很喜欢”，要求保存 main、远端同步，以便改差后回滚。
- Git 标签：`neutral-magazine-approved-20260906`。
- 冻结内容：本次项目代码、规则、结构 Skill、文档、实验构建脚本、可编辑 PPTX、预览及审查证据。
- 认可稿：`experiments/neutral-magazine-reference-02/deck.pptx`，9 页。
- PPTX SHA256：`db261f82854607b4dde3a3e0f18c7d9c580e62fe246a4174b337f4d2f5a0d812`。

用户认可当前视觉，后续调整应保留这一基准用于对比。之前的审查记录继续留存；本次保存不修改 PPT 内容，也不把单稿认可表述为跨稿稳定性验证。

## 以后找回

先同步标签：`git fetch origin --tags`。

最稳妥的查看方式是在独立目录恢复完整版本，不覆盖当前工作：

```powershell
git worktree add --detach C:/PPagenT-approved-20260906 neutral-magazine-approved-20260906
```

若只需要恢复本稿，在已妥善保存当前改动的工作区执行：

```powershell
git restore --source neutral-magazine-approved-20260906 -- experiments/neutral-magazine-reference-02
```

随后核对预览并提交恢复改动。整项目回退应根据届时的新提交进行 revert 或恢复提交，不默认强推改写远端历史。
