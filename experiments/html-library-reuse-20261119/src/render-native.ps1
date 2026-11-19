param([string]$ExperimentRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference='Stop'
$ExperimentRoot=(Resolve-Path -LiteralPath $ExperimentRoot).Path
$ownedApplication=$false
try { $powerpoint=[Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application') }
catch { $powerpoint=New-Object -ComObject PowerPoint.Application; $ownedApplication=$true }
try {
    foreach($mode in @('a','b')) {
        $deck=$null
        try {
            $sourcePath=Join-Path $ExperimentRoot "outputs/page-$mode-native-candidate.pptx"
            $outputPath=Join-Path $ExperimentRoot "outputs/page-$mode-native.png"
            $deck=$powerpoint.Presentations.Open($sourcePath,-1,0,0)
            if($deck.Slides.Count -ne 1){throw "Unexpected slide count: $mode"}
            $deck.Slides.Item(1).Export($outputPath,'PNG',2560,1440)
            Write-Output "Rendered page-$mode candidate in PowerPoint"
        } finally { if($null -ne $deck){$deck.Close()} }
    }
} finally {if($ownedApplication){$powerpoint.Quit()}}
