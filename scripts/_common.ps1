# Hàm dùng chung cho các script chạy local (dot-source: `. $PSScriptRoot\_common.ps1`).

$script:RepoRoot = Split-Path -Parent $PSScriptRoot

function Write-Step([string]$Message) {
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-Port([string]$Hostname, [int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect($Hostname, $Port)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-Port([string]$Hostname, [int]$Port, [int]$TimeoutSec = 90) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Port $Hostname $Port) { return }
        Start-Sleep -Seconds 1
    }
    throw "Hết $TimeoutSec giây mà ${Hostname}:${Port} vẫn chưa sẵn sàng."
}

# Trả đường dẫn `<Dir>\.env.<EnvName>`; chưa có thì tạo từ `.env.<EnvName>.example` (hoặc `.env.example`).
# File prod mới tạo được sinh JWT_SECRET ngẫu nhiên thay cho giá trị mẫu CHANGE_ME.
function Initialize-EnvFile([string]$Dir, [string]$EnvName) {
    $file = Join-Path $Dir ".env.$EnvName"
    if (Test-Path $file) { return $file }
    $example = Join-Path $Dir ".env.$EnvName.example"
    if (-not (Test-Path $example)) { $example = Join-Path $Dir '.env.example' }
    Write-Step "Tạo $file từ $(Split-Path -Leaf $example)"
    $text = [IO.File]::ReadAllText($example)
    $bytes = New-Object byte[] 48
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes)
    $text = [regex]::Replace($text, '(?m)^JWT_SECRET=CHANGE_ME.*$', "JWT_SECRET=$secret")
    [IO.File]::WriteAllText($file, $text, (New-Object Text.UTF8Encoding $false))
    return $file
}

# Đọc file KEY=VALUE (bỏ dòng trống/chú thích, bỏ nháy bao ngoài, cắt chú thích ` #...` của giá trị không nháy).
function Read-EnvFile([string]$Path) {
    $map = [ordered]@{}
    foreach ($line in Get-Content -Path $Path -Encoding UTF8) {
        if ($line -match '^\s*(#|$)') { continue }
        if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { continue }
        $value = $Matches[2].Trim()
        if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") { $value = $Matches[1] }
        else { $value = ($value -replace '\s+#.*$', '') }
        $map[$Matches[1]] = $value
    }
    return $map
}

# Nạp file env vào tiến trình hiện tại; biến đã đặt sẵn trong shell được giữ nguyên (giống dotenv của backend),
# nên có thể tiêm bí mật từ ngoài mà không ghi vào file.
function Import-EnvFile([string]$Path) {
    $map = Read-EnvFile $Path
    foreach ($key in $map.Keys) {
        if ($null -eq [Environment]::GetEnvironmentVariable($key)) {
            [Environment]::SetEnvironmentVariable($key, $map[$key])
        }
    }
    return $map
}

# Từ chối chạy khi file còn giá trị mẫu CHANGE_ME (chưa điền cấu hình thật).
function Assert-NoPlaceholders([string]$Path) {
    $map = Read-EnvFile $Path
    $bad = @($map.Keys | Where-Object {
        $v = [Environment]::GetEnvironmentVariable($_)
        if ($null -eq $v) { $v = $map[$_] }
        $v -like '*CHANGE_ME*'
    })
    if ($bad.Count -gt 0) {
        throw "Hãy điền giá trị thật cho $($bad -join ', ') trong $Path (còn giá trị mẫu CHANGE_ME)."
    }
}

# Đọc cổng từ `<Dir>\.env.<EnvName>` nếu có (không tạo file mới như Initialize-EnvFile), thiếu thì dùng mặc định.
function Get-ConfiguredPort([string]$Dir, [string]$EnvName, [string]$Key, [int]$Default) {
    $file = Join-Path $Dir ".env.$EnvName"
    if (Test-Path $file) {
        $value = (Read-EnvFile $file)[$Key]
        if ($value) { return [int]$value }
    }
    return $Default
}

# Kiểm tra giá trị -ServerHost: chỉ nhận IP hoặc tên miền, không kèm scheme, cổng hay đường dẫn
# (scheme chọn bằng -Scheme; cổng lấy từ PORT/WEB_PORT trong file .env).
function Assert-ServerHost([string]$ServerHost) {
    if ($ServerHost -notmatch '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$') {
        throw "-ServerHost '$ServerHost' không hợp lệ: chỉ nhập IP hoặc tên miền (vd. 192.168.1.11 hoặc app.example.com), không kèm http://, cổng hay đường dẫn."
    }
    # IPv4 không thuộc máy này thường là gõ nhầm (hoặc là IP công khai sau NAT/DNS): chỉ cảnh báo.
    if ($ServerHost -match '^\d{1,3}(\.\d{1,3}){3}$') {
        $mine = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | ForEach-Object { $_.IPAddress })
        if ($mine.Count -gt 0 -and $ServerHost -notin $mine) {
            Write-Warning "IP $ServerHost không phải địa chỉ của máy này (IPv4 hiện có: $($mine -join ', '))."
        }
    }
}

# Dựng các URL khi chạy với IP/tên miền khác localhost. Cổng đọc từ backend/.env.<env> (PORT) và
# client/.env.<env> (WEB_PORT).
#   local: client và API khác origin, mỗi bên một cổng -> ApiUrl trỏ thẳng cổng API, cần CORS cho WebOrigin.
#   prod : sau nginx/TLS cùng origin, không kèm cổng -> chỉ dùng WebOrigin làm APP_BASE_URL.
function Get-ServerUrls([string]$ServerHost, [string]$Scheme, [string]$EnvName) {
    if (-not $Scheme) { $Scheme = if ($EnvName -eq 'prod') { 'https' } else { 'http' } }
    if ($EnvName -eq 'prod') {
        return [pscustomobject]@{ WebOrigin = "${Scheme}://$ServerHost"; ApiUrl = $null; CorsOrigins = @() }
    }
    $apiPort = Get-ConfiguredPort (Join-Path $RepoRoot 'backend') $EnvName 'PORT' 3000
    $webPort = Get-ConfiguredPort (Join-Path $RepoRoot 'client') $EnvName 'WEB_PORT' 8080
    $webOrigin = "${Scheme}://${ServerHost}:$webPort"
    return [pscustomobject]@{
        WebOrigin   = $webOrigin
        ApiUrl      = "${Scheme}://${ServerHost}:$apiPort/api/v1"
        # Giữ cả localhost để vẫn mở được trên chính máy chạy.
        CorsOrigins = @($webOrigin, "http://localhost:$webPort") | Select-Object -Unique
    }
}

# Chạy lệnh ngoài và dừng script nếu mã thoát khác 0.
function Invoke-Checked([string]$Description, [scriptblock]$Command) {
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Description thất bại (mã thoát $LASTEXITCODE)." }
}

# Chạy pnpm; máy chưa cài pnpm thì dùng bản tải qua npx (khớp lockfileVersion 9.0 -> pnpm 9/10).
function Invoke-Pnpm {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$PnpmArgs)
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        & pnpm $PnpmArgs
    } else {
        & npx --yes 'pnpm@10' $PnpmArgs
    }
}
