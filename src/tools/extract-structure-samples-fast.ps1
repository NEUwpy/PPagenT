param(
  [Parameter(Mandatory = $true)][string]$SourcePath,
  [Parameter(Mandatory = $true)][string]$SourceId,
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
      for ($number = [int]$Matches[1]; $number -le [int]$Matches[2]; $number++) { $values.Add($number) }
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

$sourceResolved = [System.IO.Path]::GetFullPath($SourcePath)
$outputResolved = [System.IO.Path]::GetFullPath($OutputRoot)
$pendingDir = [System.IO.Path]::GetFullPath((Join-Path $outputResolved $PendingName))
if (-not $pendingDir.StartsWith($outputResolved, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Output path is outside root' }
$slideNumbers = @(Expand-SlideSpec $SlidesSpec)
$ppt = $null
$source = $null
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $source = $ppt.Presentations.Open($sourceResolved, $true, $true, $false)
  $completed = 0
  foreach ($slideNumber in $slideNumbers) {
    $id = '{0}-p{1:D3}' -f $SourceId, $slideNumber
    $finalPath = Join-Path $pendingDir "$id.pptx"
    $metaPath = Join-Path $pendingDir "$id.json"
    if (-not (Test-Path -LiteralPath $metaPath)) { throw "Missing sample metadata: $metaPath" }
    if (-not (Test-Path -LiteralPath $finalPath)) {
      $destination = $null
      $sourceSlide = $null
      $clonedDesign = $null
      $pastedRange = $null
      $pastedSlide = $null
      try {
        $sourceSlide = $source.Slides.Item($slideNumber)
        $destination = $ppt.Presentations.Add($false)
        $destination.PageSetup.SlideWidth = $source.PageSetup.SlideWidth
        $destination.PageSetup.SlideHeight = $source.PageSetup.SlideHeight
        $clonedDesign = $destination.Designs.Clone($sourceSlide.Design)
        for ($attempt = 1; $attempt -le 4 -and -not $pastedRange; $attempt++) {
          $sourceSlide.Copy()
          Start-Sleep -Milliseconds (100 * $attempt)
          try { $pastedRange = $destination.Slides.Paste() } catch {
            if ($attempt -eq 4) { throw }
          }
        }
        if (-not $pastedRange) { throw "PowerPoint returned no pasted slide for $id" }
        $pastedSlide = $pastedRange.Item(1)
        $pastedSlide.Design = $clonedDesign
        $pastedSlide.FollowMasterBackground = $sourceSlide.FollowMasterBackground
        $destination.SaveAs($finalPath)
      } finally {
        foreach ($object in @($pastedSlide, $pastedRange, $clonedDesign, $sourceSlide)) {
          if ($object) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($object) }
        }
        if ($destination) {
          $destination.Close()
          [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($destination)
        }
      }
    }
    $metadata = Get-Content -LiteralPath $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $metadata.pptxStatus = 'ready'
    Write-Utf8Json $metaPath $metadata
    $completed++
    if ($completed % 10 -eq 0 -or $completed -eq $slideNumbers.Count) { "EXTRACTED=$completed/$($slideNumbers.Count)" }
  }
} finally {
  if ($source) { $source.Close() }
  if ($ppt) { $ppt.Quit() }
  foreach ($object in @($source, $ppt)) {
    if ($object) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($object) }
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

$registryPath = Join-Path $outputResolved 'registry.json'
$registry = Get-Content -LiteralPath $registryPath -Raw -Encoding UTF8 | ConvertFrom-Json
$selectedIds = @($slideNumbers | ForEach-Object { '{0}-p{1:D3}' -f $SourceId, $_ })
foreach ($entry in $registry.samples) {
  if ($selectedIds -contains $entry.id) { $entry.pptxStatus = 'ready' }
}
Write-Utf8Json $registryPath $registry
