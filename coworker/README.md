# PPagenT Coworker 适配

NEUwpy/coworker 技能（v2.5.0，安装于 `~/.agents/skills/coworker`）在本项目的执行/评审对话适配层。
双方为 **glm（执行）** 与 **deepseek（评审）**，收敛过程全部走 Markdown 邮箱，历史自动归档。

## 快速开始

```powershell
# 初始化一次会话（每个 task-id 一次）
powershell -NoProfile -ExecutionPolicy Bypass -File coworker/mailbox.ps1 `
  -Action init -TaskId <task-id>

# 发消息（glm 发出 → deepseek 收；反之亦然）
powershell -NoProfile -ExecutionPolicy Bypass -File coworker/mailbox.ps1 `
  -Action send -TaskId <task-id> -Role glm -Type report -BodyFile <body.md>

# 等待并取走一条消息（3 分钟心跳；超时静默重等，不算事件）
powershell -NoProfile -ExecutionPolicy Bypass -File coworker/mailbox.ps1 `
  -Action wait -TaskId <task-id> -Role deepseek -TimeoutSeconds 180

# 状态 / 暂停（manual）/ 恢复（auto）/ 终止（cancel）
powershell -NoProfile -ExecutionPolicy Bypass -File coworker/mailbox.ps1 `
  -Action status -TaskId <task-id>
powershell -NoProfile -ExecutionPolicy Bypass -File coworker/mailbox.ps1 `
  -Action set-mode -TaskId <task-id> -Mode manual
```

## 角色与目录

- `deepseek`（执行）占传输脚本的 codex 槽位，`glm`（评审）占 opencode 槽位（`mailbox.ps1` 转译，传输脚本零改动）。
  `init/status/set-mode` 不需要 `-Role`；`send/wait` 必须带。
- 运行时目录：`coworker/runtime/<task-id>/`，收件箱 `to-codex/`（glm 收）、`to-opencode/`（deepseek 收），
  归档在 `archive/`，全程流水在 `TRANSCRIPT.md`，当前状态在 `STATUS.md` / `state.json`。
- `runtime/` 是本地传输状态，不入 Git；`archive/` + `TRANSCRIPT.md` 就是意见交换的持久记录，
  每轮消息带 `message_id` / `reply_to`，可完整回溯对话链。
- 收敛后的共识（用户拍板结论、七条共识这类阶段性成果）誊入 `coworker/decisions/<日期>-<主题>.md` 并入 Git，
  这是唯一希望长期留在仓库里的协议记录；逐轮原始消息以 runtime 归档为准。

## 本项目纪律（与全局技能规则叠加）

- 评审判定只有 `APPROVE / REVISE / BLOCK`，REVISE 必须带具体文件级修法；执行方永不自评。
- 意见收敛采用**增量评审**：首轮全量，后续只看上次评审 tip 到当前 tip 的差异（findings 用稳定 ID）。
- 断言带证据：凡"已完成/已提交/测试通过"，消息里必须附 commit hash 或测试输出原文；
  引用对方论据前先独立复核（本轮既有规则：叙述先于事实 = BLOCK 级问题）。
- 提示词/规则改动遵循项目自身的"规则四分法"：确定性规则进 checker、判断性规则须两稿复现证据、
  冲突规则修数据层——评审方按此标准审。

## 手动 / 自动模式

- **手动**：用户在两个可见 agent 窗口间转交消息，`set-mode manual` 暂停自动消费，状态保留。
- **自动（duplex）**：一方排队任务并呈现 bootstrap 提示词后立即进入长等待；用户只需把提示词
  粘贴到执行方窗口一次，之后双方各自守收件箱，直到 report/revise 收敛或用户接管。
  细节读技能内 `references/duplex-mailbox.md`，评审轮次细节读 `references/incremental-review.md`。

## 版本守护

`mailbox.ps1` 会校验技能 `VERSION.json == 2.5.0`，防止全局副本被单独升级/降级后传输行为漂移。
技能升级后按 `references/version-resolution.md` 核对并同步更新本文件的记录。
