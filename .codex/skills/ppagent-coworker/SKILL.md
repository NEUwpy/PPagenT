---
name: ppagent-coworker
description: PPagenT 项目协作技能（Codex 发现入口）。协议正文唯一真源在 .agents/skills/ppagent-coworker/SKILL.md；本文件只做发现与转发，不含协议正文。当需要规划/评审/执行协作、监听或收发协作邮箱消息时使用。
metadata:
  version: 0.1.1
  updated_at: 2026-09-21T09:21:43+08:00
---

# ppagent-coworker（Codex 发现入口）

本文件是**发现入口**，不是协议真源。以下路径均**相对仓库根目录**；请完整读取并遵循：

- 协议正文（唯一真源）：`.agents/skills/ppagent-coworker/SKILL.md`
- 适配层调用：`coworker/mailbox.ps1`（中性角色 `executor` / `planner` / `reviewer`；旧别名 `deepseek` / `glm` 兼容）
- 版本与上游基座：`.agents/skills/ppagent-coworker/VERSION.json`

角色契约：planner/reviewer 负责规划与独立评审；executor 负责实现、验证与汇报。换宿主不换协议。
