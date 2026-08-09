param(
  [Parameter(Mandatory = $true)][string]$SourcePath,
  [Parameter(Mandatory = $true)][string]$SourceRef,
  [Parameter(Mandatory = $true)][string]$SourceId,
  [Parameter(Mandatory = $true)][string]$RenderDir,
  [Parameter(Mandatory = $true)][string]$OutputRoot,
  [Parameter(Mandatory = $true)][string]$SlidesSpec,
  [Parameter(Mandatory = $true)][string]$PendingName
)

$ErrorActionPreference = 'Stop'

function Expand-SlideSpec([string]$Spec) {
  $values = New-Object System.Collections.Generic.List[int]
  foreach ($part in $Spec.Split(',')) {
    $token = $part.Trim()
    if ($token -match '^(\d+)-(\d+)$') {
      $start = [int]$Matches[1]
      $end = [int]$Matches[2]
      for ($number = $start; $number -le $end; $number++) { $values.Add($number) }
    } elseif ($token -match '^\d+$') {
      $values.Add([int]$token)
    } else {
      throw "Cannot parse slide range: $token"
    }
  }
  return $values | Sort-Object -Unique
}

function Write-Utf8Json([string]$Path, $Value) {
  $json = $Value | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

function Get-SlideTitle($Slide, [double]$SlideWidth) {
  $candidates = New-Object System.Collections.Generic.List[object]
  foreach ($shape in $Slide.Shapes) {
    try {
      if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1) {
        $text = ($shape.TextFrame.TextRange.Text -replace '[\r\n\t]+', ' ').Trim()
        if ($text -and $shape.Left -lt ($SlideWidth * 0.78) -and $shape.Top -lt 100) {
          $candidates.Add([pscustomobject]@{ Text = $text; Top = [double]$shape.Top; Left = [double]$shape.Left })
        }
      }
    } catch { }
  }
  $best = $candidates | Sort-Object Top, Left | Select-Object -First 1
  if ($best) { return $best.Text }
  return "Slide $($Slide.SlideIndex) structure sample"
}

$sourceResolved = [System.IO.Path]::GetFullPath($SourcePath)
$outputResolved = [System.IO.Path]::GetFullPath($OutputRoot)
$pendingDir = Join-Path $outputResolved $PendingName
$registryPath = Join-Path $outputResolved 'registry.json'
New-Item -ItemType Directory -Path $pendingDir -Force | Out-Null

$slideNumbers = @(Expand-SlideSpec $SlidesSpec)
$ppt = $null
$presentation = $null
$newEntries = New-Object System.Collections.Generic.List[object]
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $presentation = $ppt.Presentations.Open($sourceResolved, $true, $true, $false)
  foreach ($slideNumber in $slideNumbers) {
    if ($slideNumber -lt 1 -or $slideNumber -gt $presentation.Slides.Count) { throw "Slide number out of range: $slideNumber" }
    $id = '{0}-p{1:D3}' -f $SourceId, $slideNumber
    $previewName = "$id.png"
    $pptxName = "$id.pptx"
    $metaName = "$id.json"
    $previewSource = Join-Path $RenderDir ('slide-{0:D3}.png' -f $slideNumber)
    $previewTarget = Join-Path $pendingDir $previewName
    $pptxTarget = Join-Path $pendingDir $pptxName
    $metaTarget = Join-Path $pendingDir $metaName
    if (-not (Test-Path -LiteralPath $previewSource)) { throw "Missing preview: $previewSource" }
    Copy-Item -LiteralPath $previewSource -Destination $previewTarget -Force

    $existing = $null
    if (Test-Path -LiteralPath $metaTarget) {
      $existing = Get-Content -LiteralPath $metaTarget -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    $title = Get-SlideTitle $presentation.Slides.Item($slideNumber) $presentation.PageSetup.SlideWidth
    $metadata = [ordered]@{
      id = $id
      name = if ($existing -and $existing.name) { $existing.name } else { $title }
      kind = 'structure-sample'
      status = if ($existing -and $existing.status) { $existing.status } else { 'sample' }
      families = if ($existing -and $existing.families) { @($existing.families) } else { @($PendingName) }
      source = [ordered]@{ file = $SourceRef; slide = $slideNumber }
      preview = "$PendingName/$previewName"
      singleSlidePptx = "$PendingName/$pptxName"
      pptxStatus = if (Test-Path -LiteralPath $pptxTarget) { 'ready' } else { 'pending' }
      notes = if ($existing -and $existing.notes) { $existing.notes } else { '' }
    }
    Write-Utf8Json $metaTarget $metadata
    $newEntries.Add([ordered]@{
      id = $id
      name = $metadata.name
      families = $metadata.families
      source = $metadata.source
      path = "$PendingName/$metaName"
      pptxStatus = $metadata.pptxStatus
    })
  }
} finally {
  if ($presentation) { $presentation.Close() }
  if ($ppt) { $ppt.Quit() }
  foreach ($object in @($presentation, $ppt)) {
    if ($object) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($object) }
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

$registry = if (Test-Path -LiteralPath $registryPath) {
  Get-Content -LiteralPath $registryPath -Raw -Encoding UTF8 | ConvertFrom-Json
} else {
  [pscustomobject]@{ schemaVersion = 1; scope = 'structure-sample'; samples = @() }
}
$preserved = @($registry.samples | Where-Object { -not $_.id.StartsWith("$SourceId-") })
$all = @($preserved + $newEntries) | Sort-Object { $_.source.file }, { [int]$_.source.slide }
Write-Utf8Json $registryPath ([ordered]@{ schemaVersion = 1; scope = 'structure-sample'; samples = $all })
"CATALOGED=$($newEntries.Count)"
