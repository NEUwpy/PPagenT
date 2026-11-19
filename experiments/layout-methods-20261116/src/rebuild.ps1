param(
    [string]$Python='python',
    [string]$Chrome='C:/Program Files/Google/Chrome/Application/chrome.exe',
    [switch]$RenderNative
)
$ErrorActionPreference='Stop'
$experimentRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $experimentRoot)
$env:PYTHONPATH = Join-Path $experimentRoot 'vendor/python'
$env:CHROME_PATH = $Chrome
function Run-Checked([string]$Executable,[string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $Executable $($Arguments -join ' ')" }
}
Push-Location $repositoryRoot
try {
    Run-Checked -Executable $Python -Arguments @("$PSScriptRoot/prepare.py")
    Run-Checked -Executable node -Arguments @("$PSScriptRoot/generate.mjs")
    Run-Checked -Executable node -Arguments @("$PSScriptRoot/structure-adaptation.mjs")
    Run-Checked -Executable node -Arguments @("$PSScriptRoot/yoga.mjs")
    $marp=Join-Path $experimentRoot 'node_modules/@marp-team/marp-cli/marp-cli.js'
    foreach ($format in @('html','png','pdf')) {
        Run-Checked -Executable node -Arguments @($marp,"$PSScriptRoot/marp/slides.md",'--theme-set',"$PSScriptRoot/marp/theme.css",'--html','--allow-local-files','--image-scale','2','-o',"$experimentRoot/outputs/marp.$format")
    }
    $seaScripts=Join-Path $experimentRoot 'vendor/seaslides/skills/seaslides-html-slides-skill/scripts'
    Run-Checked -Executable $Python -Arguments @("$seaScripts/validate_project.py","$PSScriptRoot/seaslides",'--source-only','--profile','standard-project')
    Run-Checked -Executable $Python -Arguments @("$seaScripts/html_compiler.py","$PSScriptRoot/seaslides",'--all','--include-pptx')
    # Preserve the upstream gate result. Its Windows receipt uses backslashes,
    # while the validator requires POSIX paths. Do not edit that receipt or
    # claim a pass; this independent comparison continues with the artifacts.
    $gateOutput = & $Python "$seaScripts/validate_project.py" "$PSScriptRoot/seaslides" --require-build --artifact-profile delivery 2>&1
    $gateExit = $LASTEXITCODE
    $gateOutput | Set-Content -LiteralPath "$experimentRoot/evidence/seaslides-final-gate.txt" -Encoding utf8
    $gateOutput | Write-Output
    if ($gateExit -ne 0) { Write-Warning 'SeaSlides final delivery gate failed; see evidence/seaslides-final-gate.txt. This is preserved as a framework boundary, not a pass.' }
    Copy-Item -LiteralPath "$PSScriptRoot/seaslides/output/browser_pngs/slide_01.png" -Destination "$experimentRoot/outputs/seaslides.png"
    Copy-Item -LiteralPath "$PSScriptRoot/seaslides/output/slides.pdf" -Destination "$experimentRoot/outputs/seaslides.pdf"
    Copy-Item -LiteralPath "$PSScriptRoot/seaslides/output/slides.pptx" -Destination "$experimentRoot/outputs/seaslides.pptx"
    Push-Location "$PSScriptRoot/slidev"
    try {
        $slidev=Join-Path $experimentRoot 'vendor/slidev/node_modules/@slidev/cli/bin/slidev.mjs'
        foreach ($format in @('png','pdf','pptx-editable')) {
            $output=if($format -eq 'png'){"$experimentRoot/outputs/slidev"}elseif($format -eq 'pdf'){"$experimentRoot/outputs/slidev.pdf"}else{"$experimentRoot/outputs/slidev.pptx"}
            Run-Checked -Executable node -Arguments @($slidev,'export','slides.md','--format',$format,'--output',$output,'--scale','2','--executable-path',$Chrome,'--timeout','60000')
        }
    } finally { Pop-Location }
    Copy-Item -LiteralPath "$experimentRoot/outputs/slidev/1.png" -Destination "$experimentRoot/outputs/slidev.png"
    Run-Checked -Executable $Python -Arguments @("$PSScriptRoot/typst.py")
    Run-Checked -Executable node -Arguments @("$PSScriptRoot/capture.mjs",'yoga')
    if($RenderNative){ & "$PSScriptRoot/render-native.ps1" -ExperimentRoot $experimentRoot }
    Run-Checked -Executable $Python -Arguments @("$PSScriptRoot/audit.py")
    Run-Checked -Executable $Python -Arguments @("$PSScriptRoot/gallery.py")
} finally { Pop-Location }
