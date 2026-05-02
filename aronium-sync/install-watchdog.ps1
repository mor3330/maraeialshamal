# تثبيت Watchdog للـ sync.py عبر Windows Task Scheduler
# يعيد تشغيل sync.py كل 5 دقائق إذا توقف
# شغّله مرة واحدة على كل كاشير

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SyncPy    = Join-Path $ScriptDir "sync.py"
$VbsPath   = Join-Path $ScriptDir "run_silent.vbs"
$Python    = (Get-Command python -ErrorAction SilentlyContinue).Source

if (-not $Python) {
    # جرب المسارات الشائعة
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe",
        "C:\Python312\python.exe",
        "C:\Python311\python.exe",
        "C:\Python310\python.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $Python = $c; break }
    }
}

if (-not $Python) {
    Write-Host "Python not found" -ForegroundColor Red
    Read-Host; exit 1
}

Write-Host "Python: $Python"
Write-Host "Script: $SyncPy"

# --- Task 1: تشغيل sync.py عند بدء Windows ---
$action1  = New-ScheduledTaskAction -Execute $Python -Argument "`"$SyncPy`"" -WorkingDirectory $ScriptDir
$trigger1 = New-ScheduledTaskTrigger -AtLogOn
$settings1 = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 0) -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "AroniumSyncDaemon" -Action $action1 -Trigger $trigger1 -Settings $settings1 -RunLevel Highest -Force | Out-Null
Write-Host "Task 1 registered: AroniumSyncDaemon (AtLogOn)"

# --- Task 2: watchdog يفحص كل 5 دقائق إن الـ daemon شغّال ---
$watchdogScript = Join-Path $ScriptDir "watchdog.ps1"
$watchdogContent = @"
`$SyncPy  = '$($SyncPy -replace "'","''")'
`$Python  = '$($Python -replace "'","''")'
`$running = Get-Process python -ErrorAction SilentlyContinue | Where-Object { `$_.CommandLine -like "*sync.py*" }
if (-not `$running) {
    Start-Process `$Python -ArgumentList `"`$SyncPy`" -WorkingDirectory (Split-Path `$SyncPy) -WindowStyle Hidden
}
"@
$watchdogContent | Out-File $watchdogScript -Encoding UTF8

$action2  = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$watchdogScript`""
$trigger2 = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 5) -Once -At (Get-Date)
$settings2 = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "AroniumSyncWatchdog" -Action $action2 -Trigger $trigger2 -Settings $settings2 -RunLevel Highest -Force | Out-Null
Write-Host "Task 2 registered: AroniumSyncWatchdog (every 5 min)"

# شغّل الـ daemon فوراً
Write-Host "Starting sync daemon now..."
Start-Process $Python -ArgumentList "`"$SyncPy`"" -WorkingDirectory $ScriptDir -WindowStyle Hidden

Write-Host ""
Write-Host "Done! Watchdog is active." -ForegroundColor Green
Write-Host "Press Enter to close..."
Read-Host
