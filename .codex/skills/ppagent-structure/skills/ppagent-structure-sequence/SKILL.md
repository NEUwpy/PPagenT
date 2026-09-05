---
name: ppagent-structure-sequence
description: 为 PPagenT 的真实先后步骤查找并调用顺序结构，检查顺序、分支、回流与数量容量。
---

# 顺序结构

查询 `node .codex/skills/ppagent-structure/scripts/catalog.mjs list --logic sequence`，再 inspect 选中的 ID。

先后关系须来自稿件。时间刻度、条件分支、闭环回流不是普通顺序；贯穿所有步骤的规则独立排放，不能冒充额外步骤。用 items 的原始逻辑顺序，编号由资产生成。

只使用参数契约允许的字段。查看所选数量对应的文字容量与 `stateFootprints`，给出足够区域；说明可在结构外单独排放，但不能无依据删除条件或改写事实。调用入口见父 Skill 的 invocation.md。
