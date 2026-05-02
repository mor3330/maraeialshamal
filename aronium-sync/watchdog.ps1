$SyncPy  = 'C:\Users\Mohammed\OneDrive\Desktop\Alshamal\marai-alshimal\aronium-sync\sync.py'
$Python  = 'C:\Users\Mohammed\AppData\Local\Microsoft\WindowsApps\python.exe'
$running = Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*sync.py*" }
if (-not $running) {
    Start-Process $Python -ArgumentList "$SyncPy" -WorkingDirectory (Split-Path $SyncPy) -WindowStyle Hidden
}
