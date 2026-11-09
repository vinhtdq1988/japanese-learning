<#
.SYNOPSIS
  Chạy backend (Fastify) theo môi trường: `local` (mặc định) hoặc `prod`.

.DESCRIPTION
  Cấu hình đọc từ backend/.env.<env> (tự tạo từ mẫu nếu thiếu; biến đã đặt sẵn trong shell được ưu tiên).

  local: kiểm tra/dựng PostgreSQL, migrate, seed rồi `pnpm dev` (tự nạp lại khi sửa mã). CSDL chọn theo thứ tự:
    1. Đã có PostgreSQL lắng nghe ở host:port của DATABASE_URL -> dùng luôn.
    2. Có Docker -> `docker compose up -d db mailpit`.
    3. Không có Docker -> PostgreSQL nhúng (scripts/dev-db), mở trong cửa sổ riêng; đóng cửa sổ đó để dừng.

  prod: KHÔNG dựng CSDL. Từ chối chạy nếu .env.prod còn giá trị mẫu CHANGE_ME hoặc CSDL không kết nối được.
    Build (`pnpm build`), migrate bằng mã đã build rồi chạy `node dist/src/server.js` với NODE_ENV=production.

.PARAMETER Environment
  `local` hoặc `prod` (bí danh -Env).

.PARAMETER SkipSeed
  local: bỏ qua bước nạp nội dung/tạo admin dev.

.PARAMETER Seed
  prod: nạp nội dung từ content/ (lần triển khai đầu). Không tạo admin dev; tạo admin bằng `pnpm admin:create`.
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

$backend = Join-Path $RepoRoot 'backend'
$envFile = Initialize-EnvFile $backend $Environment
if ($Environment -eq 'prod') { Assert-NoPlaceholders $envFile }
$null = Import-EnvFile $envFile
if (-not $env:NODE_ENV) { $env:NODE_ENV = if ($Environment -eq 'prod') { 'production' } else { 'development' } }
if ($Environment -eq 'prod' -and $env:NODE_ENV -ne 'production') {
    throw "NODE_ENV phải là production khi chạy -Env prod (đang là '$($env:NODE_ENV)')."
}
if (-not $env:DATABASE_URL) { throw "Không tìm thấy DATABASE_URL trong $envFile." }
Write-Step "Môi trường: $Environment (NODE_ENV=$($env:NODE_ENV), cấu hình: $envFile)"

$uri = [System.Uri]$env:DATABASE_URL
$dbHost = $uri.Host
$dbPort = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
$dbUser, $dbPassword = $uri.UserInfo.Split(':', 2)
$dbName = $uri.AbsolutePath.TrimStart('/')

if ($Environment -eq 'prod') {
    if (-not (Test-Port $dbHost $dbPort)) { throw "Không kết nối được CSDL production tại ${dbHost}:${dbPort}." }
} elseif (Test-Port $dbHost $dbPort) {
    Write-Step "PostgreSQL đã chạy ở ${dbHost}:${dbPort}"
} elseif (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Step 'Khởi động PostgreSQL + Mailpit bằng Docker Compose'
    Push-Location $RepoRoot
    try { Invoke-Checked 'docker compose up' { docker compose up -d db mailpit } } finally { Pop-Location }
    Wait-Port $dbHost $dbPort
} else {
    if ($dbHost -notin @('localhost', '127.0.0.1')) {
        throw "Không kết nối được tới ${dbHost}:${dbPort} và máy không có Docker để dựng CSDL cục bộ."
    }
    Write-Step 'Không có Docker: khởi động PostgreSQL nhúng trong cửa sổ riêng (đóng cửa sổ để dừng)'
    $dbDir = Join-Path $PSScriptRoot 'dev-db'
    if (-not (Test-Path (Join-Path $dbDir 'node_modules'))) {
        Push-Location $dbDir
        try { Invoke-Checked 'npm install (dev-db)' { npm install --no-audit --no-fund } } finally { Pop-Location }
    }
    # Tham số truyền qua biến môi trường (tiến trình con kế thừa từ cửa sổ này).
    $env:DEV_DB_PORT = "$dbPort"
    $env:DEV_DB_USER = $dbUser
    $env:DEV_DB_PASSWORD = $dbPassword
    $env:DEV_DB_NAME = $dbName
    Start-Process -FilePath 'node' -ArgumentList 'index.mjs' -WorkingDirectory $dbDir -WindowStyle Minimized | Out-Null
    Wait-Port $dbHost $dbPort
    # Cổng mở trước khi cụm nhận kết nối và tạo xong CSDL; chờ thêm cho chắc.
    Start-Sleep -Seconds 3
}

Push-Location $backend
try {
    if (-not (Test-Path 'node_modules')) {
        Write-Step 'Cài phụ thuộc backend'
        Invoke-Checked 'pnpm install' { Invoke-Pnpm install --frozen-lockfile }
    }

    if ($Environment -eq 'prod') {
        Write-Step 'Build (tsc)'
        Invoke-Checked 'pnpm build' { Invoke-Pnpm build }
        # Mã build tính đường dẫn content/ và phông theo bố cục image Docker (dist/src, content, client/assets/fonts
        # nằm cạnh nhau), nên dựng đúng bố cục đó ở thư mục tạm (bị .gitignore) thay vì làm bẩn backend/.
        $stage = Join-Path $RepoRoot '.dev-data\prod'
        Write-Step "Dựng bố cục chạy production tại $stage"
        New-Item -ItemType Directory -Force -Path $stage | Out-Null
        if (Test-Path "$stage\dist") { Remove-Item "$stage\dist" -Recurse -Force }
        New-Item -ItemType Directory -Force -Path "$stage\dist" | Out-Null
        Copy-Item 'dist\src' "$stage\dist\src" -Recurse -Force
        # tsc không chép file .sql (giống bước build của backend/Dockerfile).
        foreach ($sub in 'db\migrations', 'reports') {
            New-Item -ItemType Directory -Force -Path "$stage\dist\src\$sub" | Out-Null
            Copy-Item "src\$sub\*.sql" "$stage\dist\src\$sub\" -Force
        }
        Copy-Item 'package.json' "$stage\package.json" -Force
        New-Item -ItemType Directory -Force -Path "$stage\client\assets\fonts" | Out-Null
        Copy-Item (Join-Path $RepoRoot 'client\assets\fonts\NotoSansJP.ttf') "$stage\client\assets\fonts\" -Force
        foreach ($link in @(@('node_modules', (Join-Path $backend 'node_modules')), @('content', (Join-Path $RepoRoot 'content')))) {
            if (-not (Test-Path "$stage\$($link[0])")) {
                New-Item -ItemType Junction -Path "$stage\$($link[0])" -Target $link[1] | Out-Null
            }
        }

        Push-Location $stage
        try {
            Write-Step 'Áp dụng migration'
            Invoke-Checked 'migrate' { node dist/src/db/migrate.js }
            if ($Seed) {
                Write-Step 'Nạp nội dung'
                Invoke-Checked 'seed' { node dist/src/seed/index.js }
            }
            Write-Step "Chạy API production tại http://localhost:$(if ($env:PORT) { $env:PORT } else { 3000 })/api/v1 (Ctrl+C để dừng)"
            node dist/src/server.js
        } finally {
            Pop-Location
        }
    } else {
        Write-Step 'Áp dụng migration'
        Invoke-Checked 'pnpm db:migrate' { Invoke-Pnpm db:migrate }
        if (-not $SkipSeed) {
            Write-Step 'Nạp nội dung và tạo admin dev'
            Invoke-Checked 'pnpm seed' { Invoke-Pnpm seed }
        }
        Write-Step "Chạy API tại http://localhost:$(if ($env:PORT) { $env:PORT } else { 3000 })/api/v1 (Ctrl+C để dừng)"
        Invoke-Pnpm dev
    }
} finally {
    Pop-Location
}
