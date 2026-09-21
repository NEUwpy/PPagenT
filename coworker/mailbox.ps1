[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("init", "send", "wait", "status", "set-mode")]
    [string]$Action,

    [Parameter(Mandatory = $true)]
    [ValidatePattern("^[A-Za-z0-9._-]+$")]
    [string]$TaskId,

    # Neutral roles: executor / planner / reviewer. Legacy aliases: deepseek (=executor), glm (=reviewer).
    # The transport script only accepts the codex/opencode slots; this wrapper translates.
    [ValidateSet("executor", "planner", "reviewer", "deepseek", "glm")][string]$Role,

    [ValidateSet("task", "report", "revise", "approve", "block", "note")]
    [string]$Type = "note",

    [string]$BodyFile,

    [ValidateSet("auto", "manual", "cancel")]
    [string]$Mode,

    [ValidateRange(1, 3600)]
    [int]$TimeoutSeconds = 180,

    [ValidateRange(100, 10000)]
    [int]$PollMilliseconds = 500
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $PSScriptRoot
$skillRoot = Join-Path $projectRoot ".agents\skills\ppagent-coworker"
$transportScript = Join-Path $skillRoot "scripts\coworker-mailbox.ps1"
if (-not (Test-Path -LiteralPath $transportScript)) {
    throw "ppagent-coworker transport not found: $transportScript (project-owned copy; see .agents/skills/ppagent-coworker/SKILL.md)"
}

# Version guard: fail loudly if the project transport base drifts from the tested upstream version.
$versionPath = Join-Path $skillRoot "VERSION.json"
if (Test-Path -LiteralPath $versionPath) {
    $version = (Get-Content -LiteralPath $versionPath -Raw -Encoding UTF8 | ConvertFrom-Json)
    if ($version.base.version -ne "2.5.0") {
        throw "coworker base version changed to $($version.base.version) (this wrapper is tested against 2.5.0). Verify hashes and rerun tests/duplex-e2e.ps1, then update this guard."
    }
}

$transportRole = switch ($Role) {
    "executor" { "codex" }    # executor uses the codex slot
    "planner"  { "opencode" } # planner uses the reviewer slot
    "reviewer" { "opencode" } # reviewer uses the opencode slot
    "deepseek" { "codex" }    # legacy alias: executor
    "glm"      { "opencode" } # legacy alias: reviewer
}

$forwardArgs = @{
    Action           = $Action
    Repo             = $projectRoot
    TaskId           = $TaskId
    TimeoutSeconds   = $TimeoutSeconds
    PollMilliseconds = $PollMilliseconds
}
if ($Role) { $forwardArgs.Role = $transportRole }
if ($BodyFile) { $forwardArgs.BodyFile = $BodyFile }
if ($Type)     { $forwardArgs.Type = $Type }
if ($Mode)     { $forwardArgs.Mode = $Mode }

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $transportScript @forwardArgs
exit $LASTEXITCODE
