param(
    [ValidateSet('natural','preserve-lines','bridge-duty')]
    [string[]]$Modes = @('natural','preserve-lines','bridge-duty')
)
$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot 'output'

function Export-Slide($Slide, [string]$Stem, [string]$Version) {
    $Slide.Export((Join-Path $out "$Stem.png"), 'PNG', 1280, 720)
    $result = foreach ($shape in $Slide.Shapes) {
        $item = [ordered]@{
            name = $shape.Name
            type = $shape.Type
            framePt = @($shape.Left, $shape.Top, $shape.Width, $shape.Height)
        }
        if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1) {
            $range = $shape.TextFrame.TextRange
            $item.text = $range.Text
            $item.textBoundPt = @($range.BoundLeft, $range.BoundTop, $range.BoundWidth, $range.BoundHeight)
            $item.lines = @(
                $lastStart = -1
                for ($i = 1; $i -le $range.Length; $i++) {
                    $line = $range.Lines($i, 1)
                    if ($line.Start -eq $lastStart) { break }
                    $lastStart = $line.Start
                    if ([string]::IsNullOrWhiteSpace($line.Text)) { continue }
                    [ordered]@{
                        text = $line.Text
                        boundsPt = @($line.BoundLeft, $line.BoundTop, $line.BoundWidth, $line.BoundHeight)
                    }
                }
            )
        }
        $item
    }
    [ordered]@{ powerPointVersion = $Version; objects = @($result) } |
        ConvertTo-Json -Depth 12 | Set-Content (Join-Path $out "$Stem-powerpoint.json") -Encoding utf8
}

foreach ($mode in $Modes) {
    $powerpoint = $null
    $deck = $null
    $owned = $false
    try {
        try {
            $powerpoint = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
        } catch {
            $powerpoint = New-Object -ComObject PowerPoint.Application
            $owned = $true
        }
        $deck = $powerpoint.Presentations.Open((Join-Path $out "$mode.pptx"), -1, 0, 0)
        $expected = if ($mode -eq 'bridge-duty') { 1 } else { 2 }
        if ($deck.Slides.Count -ne $expected) { throw "Unexpected slide count: $mode" }
        Export-Slide ($deck.Slides.Item(1)) $mode $powerpoint.Version
        if ($expected -eq 2) {
            Export-Slide ($deck.Slides.Item(2)) "$mode-stress" $powerpoint.Version
        }
        Write-Output "PowerPoint exported and inspected $mode"
    } finally {
        if ($null -ne $deck) { $deck.Close() }
        if ($owned -and $null -ne $powerpoint.Presentations) { $powerpoint.Quit() }
    }
}
