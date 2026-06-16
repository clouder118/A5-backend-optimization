$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bat = Join-Path $root 'start-local.bat'

cmd.exe /c call "$bat" nopause
