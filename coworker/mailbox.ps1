[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("init", "send", "wait", "status", "set-mode")]
    [string]$Action,

    [Parameter(Mandatory = $true)]
    [ValidatePattern("^[A-Za-z0-9._-]+$")]
    [string]$TaskId,

    # Project role mapping: glm = executor, deepseek = reviewer.
    # The transport script only accepts codex/opencode; this wrapper translates.
    [ValidateSet("glm", "deepseek")][string]$Role,

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

$transportScript = Join-Path $env:USERPROFILE ".agents\skills\coworker\scripts\coworker-mailbox.ps1"
if (-not (Test-Path -LiteralPath $transportScript)) {
    throw "coworker skill not found: $transportScript (expected junction at ~/.agents/skills/coworker)"
}

# Version guard: fail loudly if the global skill copy drifts from the tested version.
$versionPath = Join-Path (Split-Path (Split-Path $transportScript)) "VERSION.json"
if (Test-Path -LiteralPath $versionPath) {
    $version = (Get-Content -LiteralPath $versionPath -Raw | ConvertFrom-Json).version
    if ($version -ne "2.5.0") {
        throw "coworker skill version changed to $version (this wrapper is tested against 2.5.0). Verify via references/version-resolution.md, then update this guard."
    }
}

$transportRole = switch ($Role) {
    "deepseek" { "codex" }    # executor uses the codex slot
    "glm" { "opencode" }      # reviewer uses the opencode slot
}

$forwardArgs = @{
    Action           = $Action
    Repo             = (Split-Path $PSScriptRoot)
    TaskId           = $TaskId
    TimeoutSeconds   = $TimeoutSeconds
    PollMilliseconds = $PollMilliseconds
}
if ($Role) { $forwardArgs.Role = $transportRole }
if ($BodyFile) { $forwardArgs.BodyFile = $BodyFile }
if ($Type)     { $forwardArgs.Type = $Type }
if ($Mode)     { $forwardArgs.Mode = $Mode }

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $transportScript @forwardArgs
