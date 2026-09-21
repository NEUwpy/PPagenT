# PPagenT Coworker 适配

PPagenT 项目自有的协作技能：**planner/reviewer（规划与评审）** 与 **executor（执行）** 两个角色，
经由 Markdown 邮箱（排队、消费、归档）协作。宿主与模型只是角色的实例，换宿主不换协议。

- 项目技能（唯一权威协议入口）：[`.agents/skills/ppagent-coworker/SKILL.md`](../.agents/skills/ppagent-coworker/SKILL.md)
- Codex 发现入口（薄入口，无协议正文）：[`.codex/skills/ppagent-coworker/SKILL.md`](../.codex/skills/ppagent-coworker/SKILL.md)
- 版本与上游基座：`.agents/skills/ppagent-coworker/VERSION.json`（基座 coworker 2.5.0，传输脚本同哈希副本）
- 上游技能仓库：`https://github.com/NEUwpy/coworker`（v2.5.0，全局副本位于 `~/.agents/skills/coworker`）

## 快速开始

```powershell
# 初始化一次会话（每个 task-id 一次；不需要 -Role）
powershell -NoProfile -ExecutionPolicy Bypass -File coworker/mailbox.ps1 `
  -Action init -TaskId <task-id>

# 发消息（executor 发出 → reviewer 收；反之亦然）
powershell -NoProfile -ExecutionPolicy Bypass -File coworker/mailbox.ps1 `
  -Action send -TaskId <task-id> -Role executor -Type report -BodyFile <body.md>

# 等待并取走一条消息（3 分钟心跳；超时静默重等，不算事件）
powershell -NoProfile -ExecutionPolicy Bypass -File coworker/mailbox.ps1 `
  -Action wait -TaskId <task-id> -Role reviewer -TimeoutSeconds 180

# 状态 / 暂停（manual）/ 恢复（auto）/ 终止（cancel）
powershell -NoProfile -ExecutionPolicy Bypass -File coworker/mailbox.ps1 `
  -Action status -TaskId <task-id>
```

## 角色与目录

角色 → 传输槽位映射（`coworker/mailbox.ps1` 内转译；传输脚本与旧邮箱槽位保持不变）：

| 角色入口 | 传输槽位 | 收件箱 | 兼容别名 |
| --- | --- | --- | --- |
| `executor` | `codex` | `to-codex` | `deepseek` |
| `planner` / `reviewer` | `opencode` | `to-opencode` | `glm` |

归档消息的 YAML 头记录槽位名（`from: codex|opencode`），按上表对应角色；`message_id` / `reply_to`
链与既有历史兼容，**不迁移、不改写、不删除任何既有消息**。兼容期内旧入口（`-Role glm` / `-Role deepseek`）
保持可用，验收后再统一切换到中性角色入口。

- 运行时目录：`coworker/runtime/<task-id>/`（本地传输状态，不入 Git；`archive/` + `TRANSCRIPT.md` 为持久记录）。
- 阶段共识：`coworker/decisions/<日期>-<主题>.md`（唯一希望长期留在仓库里的协议记录）。
- 传输脚本：`.agents/skills/ppagent-coworker/scripts/coworker-mailbox.ps1`（项目内置，不依赖用户全局路径；
  为上游 coworker 2.5.0 的副本，含两处本地补丁：① PS 5.1 对无 BOM 的 UTF-8 BodyFile 默认按 ANSI/GBK 读，
  已补 `-Encoding UTF8`；② `Release-Lock` 仅锁持有者释放——锁被他人持有时不得删除他人锁文件、也不掩盖原始冲突报错。
  升级技能副本时须确认两处补丁已在上游或重新套用，并同步 `VERSION.json` 的 `transport_sha256`）。

## 本项目纪律（与全局技能规则叠加）

- 评审判定只有 `APPROVE / REVISE / BLOCK`，REVISE 必须带具体文件级修法；执行方永不自评。
- 意见收敛采用**增量评审**：首轮全量，后续只看上次评审 tip 到当前 tip 的差异（findings 用稳定 ID）。
- 断言带证据：凡"已完成/已提交/测试通过"，消息里必须附 commit hash 或测试输出原文；
  引用对方论据前先独立复核。
- 提示词/规则改动遵循项目自身的"规则四分法"：确定性规则进 checker、判断性规则须两稿复现证据、
  冲突规则修数据层——评审方按此标准审。
- 报告从简：exact tip、变更概要、关键证据路径、偏差、阻塞；细节留文件。
- 审批必须注明对象与证据；协作工具通过不代表灰稿质量通过，更不代表用户验收。

## 手动 / 自动模式

- **手动**：用户在两个可见 agent 窗口间转交消息，`set-mode manual` 暂停自动消费，状态保留。
- **自动（duplex）**：双方各自守收件箱，直到 report/revise 收敛或用户接管；超时只是心跳，静默重等。

## 自检

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .agents/skills/ppagent-coworker/tests/duplex-e2e.ps1
```

在临时 Git 仓库端到端验证：中性角色收发、旧别名兼容、中文 UTF-8 往返、排队消费与归档、
manual/cancel 控制事件、runtime 被忽略且工作树干净、技能元数据与传输哈希一致。不使用正式会话做试验场。

## 版本守护

`coworker/mailbox.ps1` 校验 `.agents/skills/ppagent-coworker/VERSION.json` 的上游基座版本（2.5.0）与
传输脚本哈希；功能变更须同步递增 `VERSION.json` 与 `SKILL.md` 的 `version` / `updated_at`。

**变更记录**：2026-09-21 协作能力项目化——新增项目技能与中性角色入口（执行侧实现）；旧别名与旧邮箱槽位保持兼容。
