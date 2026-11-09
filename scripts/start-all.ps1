<#
.SYNOPSIS
  Chạy backend và client theo môi trường (`local` mặc định, hoặc `prod`), mỗi bên một cửa sổ PowerShell riêng.
  Client chờ backend nghe cổng (PORT trong backend/.env.<env>) rồi mới khởi động/build.

.PARAMETER Environment
  `local` hoặc `prod` (bí danh -Env).

.PARAMETER SkipSeed
  local: chuyển cho start-backend.ps1.

.PARAMETER Seed
  prod: chuyển cho start-backend.ps1 (nạp nội dung lần đầu).
#>
[CmdletBinding()]
param(
    [Alias('Env')]
    [ValidateSet('local', 'prod')]
    [string]$Environment = 'local',
    [switch]$SkipSeed,
    [switch]$Seed
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

$backendEnv = Read-EnvFile (Initialize-EnvFile (Join-Path $RepoRoot 'backend') $Environment)
$backendPort = if ($backendEnv['PORT']) { [int]$backendEnv['PORT'] } else { 3000 }

$backendArgs = @('-NoExit', '-ExecutionPolicy', 'Bypass', '-File', "$PSScriptRoot\start-backend.ps1", '-Env', $Environment)
if ($SkipSeed) { $backendArgs += '-SkipSeed' }
if ($Seed) { $backendArgs += '-Seed' }
Start-Process powershell -ArgumentList $backendArgs | Out-Null

Write-Step "Chờ backend nghe cổng $backendPort..."
Wait-Port 'localhost' $backendPort -TimeoutSec 300

Start-Process powershell -ArgumentList @(
    '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', "$PSScriptRoot\start-client.ps1", '-Env', $Environment
) | Out-Null
Write-Host "Đã mở 2 cửa sổ ($Environment): backend (http://localhost:$backendPort) và client." -ForegroundColor Green
