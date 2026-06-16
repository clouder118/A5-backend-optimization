param(
  [switch]$NoPause,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$BackendLog = Join-Path $Backend "backend-local-server-8001.log"
$BackendErr = Join-Path $Backend "backend-local-server-8001.err.log"
$FrontendLog = Join-Path $Frontend "frontend-local-server-5173.log"
$FrontendErr = Join-Path $Frontend "frontend-local-server-5173.err.log"
$VenvDir = Join-Path $Backend ".venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$FrontendDist = Join-Path $Frontend "dist\index.html"

function Write-Step([string]$Text) {
  Write-Host ""
  Write-Host $Text -ForegroundColor Cyan
}

function Fail-WithHelp([string]$Text) {
  Write-Host ""
  Write-Host "Start failed: $Text" -ForegroundColor Red
  Write-Host ""
  Write-Host "Please make sure these system runtimes are installed:"
  Write-Host "1. Python 3.10+ with python.exe added to PATH."
  Write-Host "2. Node.js 18+ with node and npm available."
  Write-Host ""
  Write-Host "Project dependencies will stay inside backend\.venv and frontend\node_modules."
  if (-not $NoPause) { Read-Host "Press Enter to exit" | Out-Null }
  exit 1
}

function Test-CommandExists([string]$Command) {
  return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Find-PythonCommand {
  $candidates = @(
    @{ File = "py"; Args = @("-3.12") },
    @{ File = "py"; Args = @("-3.11") },
    @{ File = "py"; Args = @("-3.10") },
    @{ File = "py"; Args = @("-3") },
    @{ File = "python"; Args = @() }
  )

  foreach ($candidate in $candidates) {
    if (-not (Test-CommandExists $candidate.File)) { continue }
    try {
      $pythonFile = $candidate.File
      $pythonArgs = $candidate.Args
      $version = & $pythonFile @($pythonArgs + @("-c", "import sys; print(str(sys.version_info.major) + '.' + str(sys.version_info.minor))")) 2>$null
      if ($LASTEXITCODE -eq 0 -and [version]$version -ge [version]"3.10") {
        return $candidate
      }
    } catch {
      continue
    }
  }

  return $null
}

function Test-BackendDeps {
  if (-not (Test-Path $VenvPython)) { return $false }
  try {
    & $VenvPython -c "import fastapi, uvicorn, sqlalchemy, dotenv" 2>$null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Ensure-Backend {
  Write-Step "[1/7] Checking backend Python environment"

  if (-not (Test-BackendDeps)) {
    $python = Find-PythonCommand
    if ($null -eq $python) {
      Fail-WithHelp "Python 3.10+ was not found."
    }

    if (Test-Path $VenvDir) {
      Write-Host "Old backend\.venv is not usable. Recreating it..."
      Remove-Item -LiteralPath $VenvDir -Recurse -Force
    }

    Write-Host "Creating backend\.venv..."
    $pythonFile = $python.File
    $pythonArgs = $python.Args
    & $pythonFile @($pythonArgs + @("-m", "venv", $VenvDir))
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $VenvPython)) {
      Fail-WithHelp "Could not create Python virtual environment."
    }

    Write-Host "Installing backend requirements..."
    & $VenvPython -m pip install -r (Join-Path $Backend "requirements.txt")
    if ($LASTEXITCODE -ne 0) {
      Fail-WithHelp "Could not install backend requirements. Check network or pip mirror."
    }
  } else {
    Write-Host "Backend dependencies are ready."
  }

  $envFile = Join-Path $Backend ".env"
  $envExample = Join-Path $Backend ".env.example"
  if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
    Copy-Item -LiteralPath $envExample -Destination $envFile
    Write-Host "Created backend\.env from backend\.env.example."
  }
}

function Ensure-Frontend {
  Write-Step "[2/7] Checking frontend Node environment"

  if (-not (Test-CommandExists "node")) {
    Fail-WithHelp "node was not found."
  }
  if (-not (Test-CommandExists "npm.cmd")) {
    Fail-WithHelp "npm.cmd was not found."
  }

  $vitePackage = Join-Path $Frontend "node_modules\vite\package.json"
  if (-not (Test-Path $vitePackage)) {
    Write-Host "Installing frontend dependencies into frontend\node_modules..."
    Push-Location $Frontend
    try {
      if (Test-Path (Join-Path $Frontend "package-lock.json")) {
        npm.cmd ci
      } else {
        npm.cmd install
      }
      if ($LASTEXITCODE -ne 0) {
        Fail-WithHelp "Could not install frontend dependencies. Check network or npm mirror."
      }
    } finally {
      Pop-Location
    }
  } else {
    Write-Host "Frontend dependencies are ready."
  }

  Set-Content -LiteralPath (Join-Path $Frontend ".env.local") -Encoding ASCII -Value @(
    "VITE_API_BASE_URL=http://127.0.0.1:8001",
    "VITE_USE_MOCK_API=false"
  )
}

function Ensure-FrontendDist {
  Write-Step "[3/7] Checking static frontend build"
  if (-not (Test-Path $FrontendDist)) {
    Write-Host "frontend\dist was not found." -ForegroundColor Yellow
    Write-Host "Run BUILD-FRONTEND.bat once, then run START-HERE.bat again."
    Fail-WithHelp "Static frontend build is missing."
  }
  Write-Host "Static frontend build is ready."
}

function Stop-Port([int]$Port) {
  $rows = netstat -ano | Select-String -Pattern ":$Port\s+.*LISTENING"
  foreach ($row in $rows) {
    $parts = ($row.Line -replace "^\s+", "") -split "\s+"
    $pidText = $parts[-1]
    if ($pidText -match "^\d+$") {
      try {
        Stop-Process -Id ([int]$pidText) -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped PID=$pidText on port $Port"
      } catch {
        Write-Host "Could not stop PID=$pidText on port $Port. Continuing..."
      }
    }
  }
}

function Start-Backend {
  Write-Step "[5/7] Starting backend http://127.0.0.1:8001"
  if (Test-Path $BackendLog) { Clear-Content -LiteralPath $BackendLog }
  if (Test-Path $BackendErr) { Clear-Content -LiteralPath $BackendErr }
  Start-BackgroundCommand `
    -WorkingDirectory $Backend `
    -Command "`"$VenvPython`" -m uvicorn app.main:app --host 127.0.0.1 --port 8001" `
    -StdoutPath $BackendLog `
    -StderrPath $BackendErr
}

function Start-Frontend {
  Write-Step "[6/7] Starting static frontend http://127.0.0.1:5173"
  if (Test-Path $FrontendLog) { Clear-Content -LiteralPath $FrontendLog }
  if (Test-Path $FrontendErr) { Clear-Content -LiteralPath $FrontendErr }
  Start-BackgroundCommand `
    -WorkingDirectory $Frontend `
    -Command "npm.cmd run preview" `
    -StdoutPath $FrontendLog `
    -StderrPath $FrontendErr
}

function Start-BackgroundCommand {
  param(
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string]$StdoutPath,
    [Parameter(Mandatory = $true)][string]$StderrPath
  )

  $comspec = $env:ComSpec
  if ([string]::IsNullOrWhiteSpace($comspec)) {
    $comspec = Join-Path $env:SystemRoot "System32\cmd.exe"
  }

  $redirectedCommand = "$Command 1> `"$StdoutPath`" 2> `"$StderrPath`""
  $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $processInfo.FileName = $comspec
  $processInfo.Arguments = "/d /c `"$redirectedCommand`""
  $processInfo.WorkingDirectory = $WorkingDirectory
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true

  $process = [System.Diagnostics.Process]::Start($processInfo)
  if ($null -eq $process) {
    Fail-WithHelp "Could not start background command: $Command"
  }
}

function Open-LocalBrowser([string]$Url) {
  $comspec = $env:ComSpec
  if ([string]::IsNullOrWhiteSpace($comspec)) {
    $comspec = Join-Path $env:SystemRoot "System32\cmd.exe"
  }
  & $comspec /d /c "start `"`" `"$Url`""
}

function Wait-Url([string]$Url, [int]$Seconds) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 800
    }
  }
  return $false
}

try {
  Write-Host "A5 AI Guide P2 stable launcher" -ForegroundColor Green
  Write-Host "Project root: $Root"

  Ensure-Backend
  Ensure-Frontend

  Ensure-FrontendDist

  Write-Step "[4/7] Cleaning old local ports"
  foreach ($port in @(5173, 5174, 5175, 5176, 8001, 5200)) {
    Stop-Port $port
  }

  Start-Backend
  Start-Frontend

  Write-Step "[7/7] Waiting for services"
  $backendReady = Wait-Url "http://127.0.0.1:8001/health" 30
  $frontendReady = Wait-Url "http://127.0.0.1:5173/" 30

  Write-Host ""
  if ($backendReady -and $frontendReady) {
    Write-Host "Started successfully." -ForegroundColor Green
  } else {
    Write-Host "Services may still be starting. Refresh the browser after a moment." -ForegroundColor Yellow
  }
  Write-Host "Visitor: http://127.0.0.1:5173/"
  Write-Host "AI Guide: http://127.0.0.1:5173/guide"
  Write-Host "Admin: http://127.0.0.1:5173/admin"
  Write-Host "Backend docs: http://127.0.0.1:8001/docs"
  Write-Host ""
  Write-Host "Backend log: backend\backend-local-server-8001.log"
  Write-Host "Frontend log: frontend\frontend-local-server-5173.log"
  Write-Host "Mode: static preview, no Vite hot reload."
  Write-Host "After code changes: run BUILD-FRONTEND.bat, then START-HERE.bat."

  if (-not $NoBrowser -and $frontendReady) {
    Open-LocalBrowser "http://127.0.0.1:5173/"
  }

  if (-not $NoPause) {
    Read-Host "Press Enter to close this window. Services will keep running in background" | Out-Null
  }
} catch {
  Fail-WithHelp $_.Exception.Message
}
