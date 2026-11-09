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
