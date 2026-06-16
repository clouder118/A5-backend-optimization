$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$frontend = Join-Path $root 'frontend'
$log = Join-Path $frontend 'frontend-local-server-5173.log'
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source

$env:VITE_API_BASE_URL = 'http://127.0.0.1:8001'
$env:VITE_USE_MOCK_API = 'false'

Set-Location $frontend
& $npm run dev *> $log
