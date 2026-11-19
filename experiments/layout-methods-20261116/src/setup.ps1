param([string]$Python = 'python')
$ErrorActionPreference='Stop'
$experimentRoot = Split-Path -Parent $PSScriptRoot
& npm ci --prefix $experimentRoot --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Main experiment dependencies failed' }
$seaPath=Join-Path $experimentRoot 'vendor/seaslides'
if (-not (Test-Path -LiteralPath (Join-Path $seaPath '.git'))) {
    & git clone https://github.com/touying-typ/seaslides.git $seaPath
    if ($LASTEXITCODE -ne 0) { throw 'SeaSlides clone failed' }
    & git -C $seaPath checkout --detach dcde5bf6c6875b300e2999fc7766f369a13a67ac
    if ($LASTEXITCODE -ne 0) { throw 'SeaSlides revision checkout failed' }
}
$slidevPath=Join-Path $experimentRoot 'vendor/slidev'
New-Item -ItemType Directory -Path $slidevPath -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $experimentRoot 'toolchains/slidev/package.json'),(Join-Path $experimentRoot 'toolchains/slidev/package-lock.json') -Destination $slidevPath
& npm ci --prefix $slidevPath --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Slidev dependencies failed' }
& $Python -m pip install --target (Join-Path $experimentRoot 'vendor/python') 'typst==0.15.2' 'Pillow==13.0.0' 'PyMuPDF==1.26.6' 'python-pptx==1.0.2' 'pypdf==6.21.4'
if ($LASTEXITCODE -ne 0) { throw 'Python dependencies failed' }
