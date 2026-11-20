<#
.SYNOPSIS
  Chạy backend và client theo môi trường (`local` mặc định, hoặc `prod`), mỗi bên một cửa sổ PowerShell riêng.
  Client chạy ở chế độ release trong local và được build ở chế độ release trong prod.
  Client chờ backend nghe cổng (PORT trong backend/.env.<env>) rồi mới khởi động/build.

.PARAMETER Environment
  `local` hoặc `prod` (bí danh -Env).

.PARAMETER SkipSeed
  local: chuyển cho start-backend.ps1.

.PARAMETER Seed
  prod: chuyển cho start-backend.ps1 (nạp nội dung lần đầu).

.PARAMETER ServerHost
  IP hoặc tên miền để thiết bị khác truy cập (bí danh -Ip, -Domain), vd. 192.168.1.11 hoặc dev.example.com. Đổi địa chỉ chỉ cần
  chạy lại với giá trị mới, không phải sửa file .env. Chuyển cho cả backend và client:
    local: client release chạy `web-server` nghe 0.0.0.0, API_BASE_URL = <Scheme>://<ServerHost>:<PORT>/api/v1, backend bật CORS
           cho <Scheme>://<ServerHost>:<WEB_PORT> (và localhost) và đặt APP_BASE_URL tương ứng.
    prod : chỉ đặt APP_BASE_URL = <Scheme>://<ServerHost> cho backend (client build dùng API cùng origin).
  Không truyền thì chạy như trước (localhost).

.PARAMETER Scheme
  `http` hoặc `https` của địa chỉ khi dùng -ServerHost. Mặc định: local = http, prod = https.

.EXAMPLE
  .\scripts\start-all.ps1 -ServerHost 192.168.1.11
  Chạy local, truy cập từ thiết bị cùng mạng qua http://192.168.1.11:8080.

.EXAMPLE
  .\scripts\start-all.ps1 -Domain dev.example.com -Scheme https
#>
[CmdletBinding()]
param(
    [Alias('Env')]
    [ValidateSet('local', 'prod')]
    [string]$Environment = 'local',
    [switch]$SkipSeed,
    [switch]$Seed,
    [Alias('Ip', 'Domain')]
    [string]$ServerHost,
    [ValidateSet('http', 'https')]
    [string]$Scheme
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

# Kiểm tra sớm để báo lỗi ở cửa sổ này thay vì ở cửa sổ con vừa mở đã đóng.
if ($ServerHost) { Assert-ServerHost $ServerHost }

$backendEnv = Read-EnvFile (Initialize-EnvFile (Join-Path $RepoRoot 'backend') $Environment)
$backendPort = if ($backendEnv['PORT']) { [int]$backendEnv['PORT'] } else { 3000 }

# Tham số địa chỉ dùng chung cho cả hai script con.
$hostArgs = @()
if ($ServerHost) { $hostArgs += @('-ServerHost', $ServerHost) }
if ($Scheme) { $hostArgs += @('-Scheme', $Scheme) }

$backendArgs = @('-NoExit', '-ExecutionPolicy', 'Bypass', '-File', "$PSScriptRoot\start-backend.ps1", '-Env', $Environment) + $hostArgs
if ($SkipSeed) { $backendArgs += '-SkipSeed' }
if ($Seed) { $backendArgs += '-Seed' }
Start-Process powershell -ArgumentList $backendArgs | Out-Null

Write-Step "Chờ backend nghe cổng $backendPort..."
Wait-Port 'localhost' $backendPort -TimeoutSec 300

$clientArgs = @(
    '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', "$PSScriptRoot\start-client.ps1", '-Env', $Environment
) + $hostArgs
Start-Process powershell -ArgumentList $clientArgs | Out-Null
$clientStatus = if ($Environment -eq 'prod') { 'build client release' } else { 'chạy client release' }

if ($ServerHost) {
    $urls = Get-ServerUrls $ServerHost $Scheme $Environment
    Write-Host "Đã mở 2 cửa sổ ($Environment): backend (cổng $backendPort) và $clientStatus; truy cập qua $($urls.WebOrigin)." -ForegroundColor Green
} else {
    Write-Host "Đã mở 2 cửa sổ ($Environment): backend (http://localhost:$backendPort) và $clientStatus." -ForegroundColor Green
}
