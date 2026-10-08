$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot

function Start-LocalService {
    param([string]$Name, [int]$Port, [string]$Executable, [string[]]$ServiceArguments)

    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($listener) {
        $running = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
        if ($running.CommandLine -like "*$projectRoot*") {
            Write-Host "$Name already running on port $Port."
            return
        }
        throw "Port $Port is occupied by another application."
    }

    Start-Process -FilePath $Executable -ArgumentList $ServiceArguments `
        -WorkingDirectory $projectRoot -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $projectRoot "$Name.stdout.log") `
        -RedirectStandardError (Join-Path $projectRoot "$Name.stderr.log") | Out-Null
}

Start-LocalService -Name 'backend' -Port 8002 `
    -Executable (Join-Path $projectRoot 'backend\venv\Scripts\python.exe') `
    -ServiceArguments @('"' + (Join-Path $projectRoot 'backend\manage.py') + '"', 'runserver', '127.0.0.1:8002', '--noreload')

Start-LocalService -Name 'frontend' -Port 3000 `
    -Executable (Get-Command node.exe).Source `
    -ServiceArguments @('"' + (Join-Path $projectRoot 'node_modules\vite\bin\vite.js') + '"', '--host', '127.0.0.1', '--port', '3000', '--strictPort')

Write-Host 'Website: http://localhost:3000'
Write-Host 'Backend: http://127.0.0.1:8002'

function Start-LocalBot {
    param([string]$Name, [bool]$Admin)
    $botProcesses = Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
        Where-Object { $_.CommandLine -like "*$projectRoot\backend\manage.py*telegram_bot*" }
    $alreadyRunning = $botProcesses | Where-Object {
        ($_.CommandLine -match '--admin') -eq $Admin
    }
    if ($alreadyRunning) { Write-Host "$Name already running."; return }
    $botArguments = @('"' + (Join-Path $projectRoot 'backend\manage.py') + '"', 'telegram_bot')
    if ($Admin) { $botArguments += '--admin' }
    Start-Process -FilePath (Join-Path $projectRoot 'backend\venv\Scripts\python.exe') `
        -ArgumentList $botArguments -WorkingDirectory $projectRoot -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $projectRoot "$Name.stdout.log") `
        -RedirectStandardError (Join-Path $projectRoot "$Name.stderr.log") | Out-Null
    Write-Host "$Name started."
}

$localEnv = Get-Content -LiteralPath (Join-Path $projectRoot '.env') -Raw
if ($localEnv -match '(?m)^TELEGRAM_BOT_TOKEN=\S+') { Start-LocalBot -Name 'business-bot' -Admin $false }
if ($localEnv -match '(?m)^TELEGRAM_ADMIN_USER_IDS=[0-9]') {
    Start-LocalBot -Name 'admin-bot' -Admin $true
} else {
    Write-Host 'Admin bot stays locked until TELEGRAM_ADMIN_USER_IDS is configured.'
}
