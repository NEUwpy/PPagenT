param([string]$ExperimentRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$ExperimentRoot = (Resolve-Path -LiteralPath $ExperimentRoot).Path
$ownedApplication = $false
try { $powerpoint = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application') }
catch { $powerpoint = New-Object -ComObject PowerPoint.Application; $ownedApplication = $true }
try {
    foreach ($method in @('seaslides','slidev')) {
        $sourcePath = Join-Path $ExperimentRoot "outputs/$method.pptx"
        $outputPath = Join-Path $ExperimentRoot "outputs/$method-native.png"
        $deck = $null
        try {
            $deck = $powerpoint.Presentations.Open($sourcePath, -1, 0, 0)
            if ($deck.Slides.Count -ne 1) { throw "Unexpected slide count for $method" }
            $deck.Slides.Item(1).Export($outputPath, 'PNG', 2560, 1440)
            Write-Output "PowerPoint rendered $method to $outputPath"
        } finally { if ($null -ne $deck) { $deck.Close() } }
    }
} finally { if ($ownedApplication) { $powerpoint.Quit() } }
