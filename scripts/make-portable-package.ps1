param(
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ReleaseRoot = Join-Path $Root ".release"
$PackageName = "P2-Haru-AIGuide-portable"
$StageDir = Join-Path $ReleaseRoot $PackageName
$ZipPath = Join-Path $ReleaseRoot "$PackageName.zip"

function Write-Step([string]$Text) {
  Write-Host ""
  Write-Host $Text -ForegroundColor Cyan
}

try {
  Write-Host "Creating portable package for team deployment" -ForegroundColor Green
  Write-Host "Project root: $Root"

  Write-Step "[1/3] Preparing release folder"
  if (Test-Path $StageDir) {
    Remove-Item -LiteralPath $StageDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $ReleaseRoot -Force | Out-Null

  Write-Step "[2/3] Copying source files"
  $excludeDirs = @(
    ".release",
    ".cache",
    ".render-temp",
    ".scratch",
    ".codex-logs",
    "node_modules",
    ".vite-cache",
    "test-results",
    ".venv",
    ".venv312",
    ".python-packages",
    ".pytest_cache",
    ".pytest_tmp",
    "__pycache__",
    "tts"
  )
  $excludeFiles = @(
    "*.log",
    "*.err",
    "*.err.log",
    "*.pyc",
    "debug-*.db",
    "structured_qa_eval_report*.json",
    ".env",
    ".env.local"
  )

  $robocopyArgs = @(
    $Root,
    $StageDir,
    "/E",
    "/R:1",
    "/W:1",
    "/NFL",
    "/NDL",
    "/NP",
    "/XD"
  ) + $excludeDirs + @("/XF") + $excludeFiles

  & robocopy @robocopyArgs | Out-Host
  if ($LASTEXITCODE -ge 8) {
    throw "robocopy failed with exit code $LASTEXITCODE"
  }

  Write-Step "[3/3] Creating zip"
  if (Test-Path $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }
  Compress-Archive -LiteralPath $StageDir -DestinationPath $ZipPath -Force

  Write-Host ""
  Write-Host "Portable package created:" -ForegroundColor Green
  Write-Host $ZipPath
  Write-Host ""
  Write-Host "Send this zip to teammates. They only need to unzip it and double-click START-HERE.bat."
  Write-Host "System prerequisites: Python 3.10+ and Node.js 18+."
} catch {
  Write-Host ""
  Write-Host "Packaging failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
} finally {
  if (-not $NoPause) {
    Read-Host "Press Enter to exit" | Out-Null
  }
}
