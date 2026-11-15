<#
.SYNOPSIS
  Dừng backend và client do start-all.ps1 / start-backend.ps1 / start-client.ps1 khởi động.

.DESCRIPTION
  1. Tắt (cả cây tiến trình con) các cửa sổ PowerShell đang chạy start-backend.ps1, start-client.ps1, start-all.ps1.
  2. Tắt tiến trình còn nghe cổng API (PORT trong backend/.env.<env>) và cổng web (WEB_PORT trong client/.env.<env>).
  PostgreSQL (dịch vụ Windows hoặc Docker) KHÔNG bị dừng; PostgreSQL nhúng chỉ dừng khi có -IncludeDb.

.PARAMETER Environment
  `local` hoặc `prod` (bí danh -Env): chọn file .env.<env> để đọc cổng.

.PARAMETER IncludeDb
  Dừng cả PostgreSQL nhúng (scripts/dev-db) nếu đang chạy.
#>
[CmdletBinding()]
param(
    [Alias('Env')]
    [ValidateSet('local', 'prod')]
    [string]$Environment = 'local',
    [switch]$IncludeDb
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

# Tắt tiến trình cùng toàn bộ tiến trình con; bỏ qua tiến trình đã biến mất.
function Stop-Tree([int]$ProcessId, [string]$Label) {
    if ($ProcessId -eq $PID) { return }
    if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) { return }
    Write-Step "Dừng $Label (PID $ProcessId)"
    & taskkill /PID $ProcessId /T /F | Out-Null
}

# Đọc cổng từ file env nếu có (không tạo file mới như Initialize-EnvFile).
function Get-EnvPort([string]$Dir, [string]$Key, [int]$Default) {
    $file = Join-Path $Dir ".env.$Environment"
    if (Test-Path $file) {
        $value = (Read-EnvFile $file)[$Key]
        if ($value) { return [int]$value }
    }
    return $Default
}

$patterns = @('start-backend\.ps1', 'start-client\.ps1', 'start-all\.ps1')
# PostgreSQL nhúng chạy bằng `node index.mjs` (thư mục làm việc scripts/dev-db) nên chỉ nhận diện qua tên file.
if ($IncludeDb) { $patterns += 'node(\.exe)?"?\s+index\.mjs' }
$regex = $patterns -join '|'

$scripts = Get-CimInstance Win32_Process | Where-Object {
    $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -match $regex -and
    ($_.Name -match '^(powershell|pwsh|node)\.exe$')
}
foreach ($p in $scripts) { Stop-Tree $p.ProcessId $p.Name }

$ports = [ordered]@{
    'API'    = Get-EnvPort (Join-Path $RepoRoot 'backend') 'PORT' 3000
    'client' = Get-EnvPort (Join-Path $RepoRoot 'client') 'WEB_PORT' 8080
}
foreach ($name in $ports.Keys) {
    $listeners = Get-NetTCPConnection -LocalPort $ports[$name] -State Listen -ErrorAction SilentlyContinue
    foreach ($l in $listeners) { Stop-Tree $l.OwningProcess "$name (cổng $($ports[$name]))" }
}

Write-Host 'Đã dừng backend và client.' -ForegroundColor Green
