---
name: ppagent-coworker
description: PPagenT 项目自有的双角色协作技能（planner/reviewer 与 executor）：Markdown 邮箱排队、消费与归档，中性角色入口与旧别名兼容，供 Codex / OpenCode 等宿主以同一套协议使用。当用户要求规划、评审、执行协作，监听邮箱、收发任务或报告，或提及 coworker / mailbox / 协作邮箱时使用。
metadata:
  version: 0.1.0
  updated_at: 2026-09-21T09:05:50+08:00
  base: coworker 2.5.0
---

# PPagenT Coworker（项目协作技能）

本技能是 PPagenT 项目内**唯一权威**的协作协议入口。宿主与模型只是角色的实例：
谁负责规划/评审、谁负责执行，由**角色**决定，不由 `glm`/`codex`/`opencode` 名称决定。

## 角色与契约

- **planner / reviewer（规划/评审）**：定义目标、边界、阶段、验收与停止条件；基于**已完成的报告**独立审查（打开产物、diff、证据），给出 `APPROVE / REVISE / BLOCK`；不亲自实现。
- **executor（执行）**：在计划边界内选择实现路径，提交、验证、汇报；不自评。
- 同一宿主可承担任一角色；换宿主不换协议。
- 报告从简：exact tip、变更概要、关键证据路径、偏差、阻塞；细节留在文件里。
- 审批必须注明**对象与证据**（tip / 产物 / 检查输出）；协作工具通过不代表灰稿质量通过，更不代表用户验收。
- 角色不越界：规划者不实现，执行者不自批；冲突指令停止冲突部分并回报，不自行择一执行。

## 协议（duplex 邮箱）

双方各自守自己的收件箱，循环：**wait → 消费并归档 → 干活 → send → 再 wait**。

- 消息类型：`task | report | revise | approve | block | note`；每轮消息带 `message_id` / `reply_to`，归档 + `TRANSCRIPT.md` 是持久记录。
- 三分钟心跳超时不是事件：静默重等，不要因超时结束长任务、不要报进度。只有完成报告、阻塞、控制事件或用户干预才算事件。
- 执行方在收到 task/revise 前只等待；评审方在收到 report 前不看半成品。`APPROVE` 只能由评审方给出。
- 队列语义：先发先到；消费即归档（原子移动，防重复处理）。
- 不使用当前正式会话做传输测试；测试用临时 Git 仓库与独立 task-id。
- 不建控制平台、调度器或模型启动器；邮箱脚本只传输文件，不启动 agent 进程。

## 调用（项目适配层）

```powershell
# 初始化（每个 task-id 一次；不需要 -Role）
powershell -NoProfile -ExecutionPolicy Bypass -File coworker/mailbox.ps1 `
  -Action init -TaskId <task-id>

# 发消息（executor 发出 → reviewer 收；反之亦然）
powershell -NoProfile -ExecutionPolicy Bypass -File coworker/mailbox.ps1 `
  -Action send -TaskId <task-id> -Role executor -Type report -BodyFile <body.md>

# 等待并取走一条消息（3 分钟心跳；超时静默重等）
powershell -NoProfile -ExecutionPolicy Bypass -File coworker/mailbox.ps1 `
  -Action wait -TaskId <task-id> -Role reviewer -TimeoutSeconds 180

# 状态 / 暂停（manual）/ 恢复（auto）/ 终止（cancel）
powershell -NoProfile -ExecutionPolicy Bypass -File coworker/mailbox.ps1 `
  -Action status -TaskId <task-id>
```

**角色 → 传输槽位映射**（`coworker/mailbox.ps1` 内转译；传输脚本与旧邮箱槽位保持不变）：

| 角色入口 | 传输槽位 | 收件箱 | 兼容别名 |
| --- | --- | --- | --- |
| `executor` | `codex` | `to-codex` | `deepseek` |
| `planner` / `reviewer` | `opencode` | `to-opencode` | `glm` |

归档消息的 YAML 头记录的是**槽位名**（`from: codex|opencode`），按上表对应角色；
`message_id` / `reply_to` 链与既有历史兼容，不迁移、不改写、不删除任何既有消息。

## 目录

- 传输脚本（项目内置，不依赖用户全局路径）：`.agents/skills/ppagent-coworker/scripts/coworker-mailbox.ps1`
  （上游 `coworker 2.5.0` 同哈希副本，含本地 UTF-8 补丁）。
- 适配层：`coworker/mailbox.ps1`（中性角色 + 旧别名 + 版本守护）。
- 运行时：`coworker/runtime/<task-id>/`（本地传输状态，不入 Git；`archive/` + `TRANSCRIPT.md` 为持久记录）。
- 阶段共识：`coworker/decisions/<日期>-<主题>.md`（入 Git 的协议记录）。
- 自检：`tests/duplex-e2e.ps1`（临时 Git 仓库端到端：中性角色收发、旧别名、中文 UTF-8、排队消费、manual/cancel、runtime 忽略）。

## 宿主发现

- OpenCode：项目内 `.agents/skills/<name>/SKILL.md`（沿工作目录向上发现）。
- Codex：项目内 `.codex/skills/<name>/SKILL.md`（指向本文件的薄入口，不含协议正文）。
- 其他宿主：把本目录加入其技能发现路径即可；协议正文只此一份。

## 版本纪律

- `VERSION.json` 与本文 frontmatter 的 `version` / `updated_at` 必须一致；功能变更递增版本并同步两处。
- 上游基座：`coworker 2.5.0`（`updated_at 2026-08-02T22:37:40+08:00`）；传输脚本替换/升级须核对上游哈希并跑通 `tests/duplex-e2e.ps1`。
- 兼容期内旧入口（`-Role glm` / `-Role deepseek`）保持可用；验收后再统一切换到中性角色入口。
