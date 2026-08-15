param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][int]$SlideNumber,
  [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$powerPoint = $null
$presentation = $null
try {
  $resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
  $resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
  $outputDirectory = [System.IO.Path]::GetDirectoryName($resolvedOutput)
  [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null

  $powerPoint = New-Object -ComObject PowerPoint.Application
  $presentation = $powerPoint.Presentations.Open($resolvedInput, -1, 0, 0)
  if ($SlideNumber -lt 1 -or $SlideNumber -gt $presentation.Slides.Count) {
    throw "幻灯片编号超出范围：$SlideNumber / $($presentation.Slides.Count)"
  }
  $presentation.Slides.Item($SlideNumber).Export($resolvedOutput, 'PNG', 1280, 720)
  if (-not [System.IO.File]::Exists($resolvedOutput)) {
    throw "PowerPoint 未生成预览图：$resolvedOutput"
  }
}
finally {
  if ($presentation) {
    $presentation.Close()
    [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($presentation)
  }
  if ($powerPoint) {
    $powerPoint.Quit()
    [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($powerPoint)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
