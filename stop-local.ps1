$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bat = Join-Path $root 'stop-local.bat'

cmd.exe /c call "$bat" nopause
