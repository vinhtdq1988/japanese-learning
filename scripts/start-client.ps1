<#
.SYNOPSIS
  Client Flutter web theo môi trường: `local` (mặc định) chạy dev server, `prod` build bản release.

.DESCRIPTION
  Cấu hình đọc từ client/.env.<env> (tự tạo từ mẫu nếu thiếu): API_BASE_URL và WEB_PORT.
  Tham số dòng lệnh -ApiUrl / -Port ghi đè giá trị trong file.

  local: `flutter run --no-web-resources-cdn` trỏ tới backend local; không có CSP (index.html không có meta) và
         CanvasKit phục vụ cùng nguồn nên không cần Internet. Backend chưa bật CORS (bản production cùng origin
         qua nginx) nên với chrome/edge script tắt web security của trình duyệt dev (hồ sơ tạm do Flutter tạo,
         không ảnh hưởng trình duyệt thường ngày). Với `web-server` hãy tự mở trình duyệt đã tắt web security.
  prod:  `flutter build web --release --no-web-resources-cdn` ra client/build/web; CSP chặt do header nginx cấp.
         Triển khai bằng nginx (client/Dockerfile + client/nginx.conf, xem backend/README.md mục "Triển khai").

.PARAMETER Environment
  `local` hoặc `prod` (bí danh -Env).

.PARAMETER Device
  Chỉ cho local: `chrome` (mặc định), `edge` hoặc `web-server`.
#>
[CmdletBinding()]
param(
    [Alias('Env')]
    [ValidateSet('local', 'prod')]
    [string]$Environment = 'local',
    [string]$ApiUrl,
    [int]$Port,
    [ValidateSet('chrome', 'edge', 'web-server')]
    [string]$Device = 'chrome'
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

$clientDir = Join-Path $RepoRoot 'client'
$envFile = Initialize-EnvFile $clientDir $Environment
$config = Read-EnvFile $envFile
if (-not $ApiUrl) { $ApiUrl = $config['API_BASE_URL'] }
if (-not $ApiUrl) { throw "Thiếu API_BASE_URL trong $envFile (hoặc truyền -ApiUrl)." }
if (-not $Port) { $Port = if ($config['WEB_PORT']) { [int]$config['WEB_PORT'] } else { 8080 } }
Write-Step "Môi trường: $Environment (cấu hình: $envFile)"

Push-Location $clientDir
try {
    if (-not (Test-Path '.dart_tool\package_config.json')) {
        Write-Step 'flutter pub get'
        Invoke-Checked 'flutter pub get' { flutter pub get }
    }

    if ($Environment -eq 'prod') {
        Write-Step "Build web release (API_BASE_URL=$ApiUrl)"
        Invoke-Checked 'flutter build web' {
            flutter build web --release --no-web-resources-cdn "--dart-define=API_BASE_URL=$ApiUrl"
        }
        Write-Host "Đã build ra $clientDir\build\web" -ForegroundColor Green
    } else {
        $flutterArgs = @('run', '-d', $Device, '--web-port', "$Port", "--dart-define=API_BASE_URL=$ApiUrl", '--no-web-resources-cdn')
        if ($Device -ne 'web-server') {
            $flutterArgs += '--web-browser-flag=--disable-web-security'
        }
        Write-Step "Chạy client tại http://localhost:$Port -> API $ApiUrl (r: hot reload, q: thoát)"
        & flutter @flutterArgs
    }
} finally {
    Pop-Location
}
