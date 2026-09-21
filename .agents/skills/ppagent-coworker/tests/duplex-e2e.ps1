[CmdletBinding()]
param(
    [string]$TempRoot = (Join-Path $env:TEMP ("ppagent-coworker-e2e-" + (Get-Date -Format 'yyyyMMddHHmmss')))
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$script:Failures = @()
$script:PowerShellExe = (Get-Command powershell.exe -ErrorAction Stop).Source

function Assert-True {
    param([bool]$Condition, [string]$Name)
    if ($Condition) { Write-Output "PASS  $Name" }
    else { Write-Output "FAIL  $Name"; $script:Failures += $Name }
}

function Invoke-Adapter {
    param(
        [string]$Action,
        [string]$Role,
        [string]$Type,
        [string]$BodyFile,
        [string]$Mode,
        [int]$TimeoutSeconds = 30
    )
    $cmdArgs = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $script:Adapter,
        "-Action", $Action, "-TaskId", $script:TaskId, "-TimeoutSeconds", "$TimeoutSeconds"
    )
    if ($Role) { $cmdArgs += @("-Role", $Role) }
    if ($Type) { $cmdArgs += @("-Type", $Type) }
    if ($BodyFile) { $cmdArgs += @("-BodyFile", $BodyFile) }
    if ($Mode) { $cmdArgs += @("-Mode", $Mode) }
    $previousEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $raw = & $script:PowerShellExe @cmdArgs 2>&1 | Out-String
    $ErrorActionPreference = $previousEap
    $code = $LASTEXITCODE
    $json = $null
    try { $json = $raw.Trim() | ConvertFrom-Json } catch { }
    return [pscustomobject]@{ ExitCode = $code; Raw = $raw; Json = $json }
}

# ---- locate project copy and build an isolated temp git repo -----------------
$skillRoot = Split-Path $PSScriptRoot
$projectRoot = Split-Path (Split-Path (Split-Path $skillRoot))
$adapterSource = Join-Path $projectRoot "coworker\mailbox.ps1"
$fixtureSource = Join-Path $skillRoot "tests\fixtures\utf8-body.md"
if (-not (Test-Path -LiteralPath $adapterSource)) { throw "adapter not found: $adapterSource" }
if (-not (Test-Path -LiteralPath $fixtureSource)) { throw "fixture not found: $fixtureSource" }

New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null
$repo = Join-Path $TempRoot "repo"
New-Item -ItemType Directory -Path (Join-Path $repo ".agents\skills") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $repo "coworker") -Force | Out-Null
Copy-Item -LiteralPath $skillRoot -Destination (Join-Path $repo ".agents\skills\ppagent-coworker") -Recurse -Force
Copy-Item -LiteralPath $adapterSource -Destination (Join-Path $repo "coworker\mailbox.ps1") -Force
Set-Content -LiteralPath (Join-Path $repo ".gitignore") -Value "coworker/runtime/" -Encoding ascii
git -C $repo init -q
git -C $repo add -A
git -C $repo -c user.name=e2e -c user.email=e2e@local commit -q -m "e2e init"

$script:Adapter = Join-Path $repo "coworker\mailbox.ps1"
$script:TaskId = "e2e-" + (Get-Date -Format 'HHmmss')
$bodyFile = Join-Path $TempRoot "body.md"
Copy-Item -LiteralPath $fixtureSource -Destination $bodyFile -Force
$bodyText = (Get-Content -LiteralPath $bodyFile -Raw -Encoding UTF8).Trim()
$runtime = Join-Path $repo "coworker\runtime\$($script:TaskId)"

Write-Output "temp repo: $repo"
Write-Output "task id:   $($script:TaskId)"
Write-Output "powershell: $($script:PowerShellExe)"

# ---- 1. init ------------------------------------------------------------------
Assert-True (Test-Path -LiteralPath $script:PowerShellExe) "real powershell.exe path resolves"
$r = Invoke-Adapter -Action init
Assert-True ($r.ExitCode -eq 0 -and $r.Json.event -eq "initialized") "init creates runtime"
Assert-True (Test-Path -LiteralPath (Join-Path $runtime "to-codex")) "init creates inbox to-codex"
Assert-True (Test-Path -LiteralPath (Join-Path $runtime "to-opencode")) "init creates inbox to-opencode"

# ---- 2. neutral role send/receive + UTF-8 round-trip --------------------------
$r = Invoke-Adapter -Action send -Role executor -Type report -BodyFile $bodyFile
Assert-True ($r.ExitCode -eq 0 -and $r.Json.event -eq "sent") "executor send"
Assert-True ($r.Json.recipient -eq "opencode") "executor send lands in reviewer inbox"
$r = Invoke-Adapter -Action wait -Role reviewer -TimeoutSeconds 30
Assert-True ($r.ExitCode -eq 0 -and $r.Json.event -eq "message") "reviewer wait receives"
$archived = $r.Json.archive_path
$archivedText = Get-Content -LiteralPath $archived -Raw -Encoding UTF8
Assert-True ($archivedText -match "(?m)^from: codex\s*$") "message header records slot from: codex"
Assert-True ($archivedText -match "(?m)^to: opencode\s*$") "message header records slot to: opencode"
Assert-True ($archivedText.Contains($bodyText)) "chinese body survives UTF-8 round-trip"
Assert-True (Test-Path -LiteralPath (Join-Path $runtime "archive\to-opencode")) "consume archives the message"

# ---- 3. legacy aliases ---------------------------------------------------------
$r = Invoke-Adapter -Action send -Role deepseek -Type note -BodyFile $bodyFile
Assert-True ($r.ExitCode -eq 0 -and $r.Json.event -eq "sent" -and $r.Json.recipient -eq "opencode") "legacy deepseek maps to executor slot"
$r = Invoke-Adapter -Action wait -Role glm -TimeoutSeconds 30
Assert-True ($r.ExitCode -eq 0 -and $r.Json.event -eq "message") "legacy glm maps to reviewer slot"

# ---- 4. queue order (first in first out) ---------------------------------------
$bodyA = Join-Path $TempRoot "a.md"
$bodyB = Join-Path $TempRoot "b.md"
Set-Content -LiteralPath $bodyA -Value "queue-A" -Encoding ascii
Set-Content -LiteralPath $bodyB -Value "queue-B" -Encoding ascii
Invoke-Adapter -Action send -Role executor -Type note -BodyFile $bodyA | Out-Null
Invoke-Adapter -Action send -Role executor -Type note -BodyFile $bodyB | Out-Null
$r1 = Invoke-Adapter -Action wait -Role reviewer -TimeoutSeconds 30
$r2 = Invoke-Adapter -Action wait -Role reviewer -TimeoutSeconds 30
$t1 = Get-Content -LiteralPath $r1.Json.archive_path -Raw -Encoding UTF8
$t2 = Get-Content -LiteralPath $r2.Json.archive_path -Raw -Encoding UTF8
Assert-True ($t1.Contains("queue-A") -and $t2.Contains("queue-B")) "queue consumes oldest first"

# ---- 5. manual / auto / cancel --------------------------------------------------
$r = Invoke-Adapter -Action set-mode -Mode manual
Assert-True ($r.Json.event -eq "mode_changed" -and $r.Json.mode -eq "manual") "set-mode manual"
$r = Invoke-Adapter -Action wait -Role reviewer -TimeoutSeconds 5
Assert-True ($r.Json.event -eq "control" -and $r.Json.mode -eq "manual") "wait returns control event on manual"
$r = Invoke-Adapter -Action set-mode -Mode auto
Assert-True ($r.Json.mode -eq "auto") "set-mode auto"
$r = Invoke-Adapter -Action wait -Role reviewer -TimeoutSeconds 3
Assert-True ($r.Json.event -eq "timeout") "empty queue wait times out after auto resume"
$r = Invoke-Adapter -Action set-mode -Mode cancel
Assert-True ($r.Json.mode -eq "cancel") "set-mode cancel"
$r = Invoke-Adapter -Action wait -Role reviewer -TimeoutSeconds 5
Assert-True ($r.Json.event -eq "control" -and $r.Json.mode -eq "cancel") "wait returns control event on cancel"
Invoke-Adapter -Action set-mode -Mode auto | Out-Null

# ---- 6. invalid role rejected ----------------------------------------------------
$r = Invoke-Adapter -Action status -Role bogus
Assert-True ($r.ExitCode -ne 0) "unknown role rejected"

# ---- 7. runtime ignored / clean worktree ------------------------------------------
$status = git -C $repo status --porcelain
Assert-True ([string]::IsNullOrWhiteSpace(($status | Out-String))) "runtime ignored, worktree clean"

# ---- 8. skill metadata validation --------------------------------------------------
$skillMd = Get-Content -LiteralPath (Join-Path $repo ".agents\skills\ppagent-coworker\SKILL.md") -Raw -Encoding UTF8
$versionJson = Get-Content -LiteralPath (Join-Path $repo ".agents\skills\ppagent-coworker\VERSION.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$descMatch = [regex]::Match($skillMd, "(?ms)^description:\s*(.+?)\r?\nmetadata:")
Assert-True ($skillMd -match "(?m)^name:\s*ppagent-coworker\s*$") "skill name matches directory"
Assert-True ($descMatch.Success -and $descMatch.Groups[1].Value.Trim().Length -ge 1 -and $descMatch.Groups[1].Value.Trim().Length -le 1024) "skill description length valid"
Assert-True ($skillMd -match [regex]::Escape("version: $($versionJson.version)")) "SKILL.md version matches VERSION.json"
Assert-True ($skillMd -match [regex]::Escape("updated_at: $($versionJson.updated_at)")) "SKILL.md updated_at matches VERSION.json"
$transportHash = (Get-FileHash -LiteralPath (Join-Path $repo ".agents\skills\ppagent-coworker\scripts\coworker-mailbox.ps1") -Algorithm SHA256).Hash
Assert-True ($transportHash -eq $versionJson.base.transport_sha256) "vendored transport hash matches VERSION.json"

# ---- summary ----------------------------------------------------------------------
Write-Output ""
if ($script:Failures.Count -eq 0) {
    Write-Output "E2E PASS: all checks green ($TempRoot)"
    exit 0
}
Write-Output "E2E FAIL: $($script:Failures.Count) check(s) failed"
$script:Failures | ForEach-Object { Write-Output "  - $_" }
Write-Output "artifacts kept at: $TempRoot"
exit 1
