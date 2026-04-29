@echo off
chcp 65001 > nul
title تثبيت مزامنة مراعي الشمال - فرع جديد
color 0B

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║     تثبيت نظام مزامنة مراعي الشمال              ║
echo ║     فرع جديد - خطوتين فقط!                      ║
echo ╚══════════════════════════════════════════════════╝
echo.

REM ── تحقق من Python ──────────────────────────────────
python --version > nul 2>&1
if errorlevel 1 (
    echo [!] Python غير مثبت!
    echo.
    echo حمّله من: https://www.python.org/downloads/
    echo تأكد من وضع علامة صح على "Add Python to PATH"
    echo.
    pause
    exit /b 1
)
echo [✓] Python موجود

echo.
echo ═══════════════════════════════════════════════════
echo   أدخل بيانات الفرع:
echo ═══════════════════════════════════════════════════
echo.

REM ── branch_id ────────────────────────────────────────
echo الخطوة 1: branch_id
echo (افتح الداشبورد ← الفروع ← انسخ UUID الفرع)
echo.
set /p BRANCH_ID=   أدخل branch_id: 

echo.
echo الخطوة 2: اسم الفرع
set /p BRANCH_NAME=   اسم الفرع (مثال: مراعي الشمال - فرع العليا): 

echo.
echo الخطوة 3: مسار ملف Aronium
echo (الافتراضي: C:\Users\%USERNAME%\AppData\Local\Aronium\Data\pos.db)
set /p DB_PATH=   مسار pos.db (اضغط Enter للافتراضي): 

if "%DB_PATH%"=="" (
    set DB_PATH=C:\Users\%USERNAME%\AppData\Local\Aronium\Data\pos.db
)

echo.
echo ═══════════════════════════════════════════════════
echo   جاري التثبيت...
echo ═══════════════════════════════════════════════════
echo.

REM ── إنشاء مجلد التثبيت ───────────────────────────────
if not exist "C:\AroniumSync" mkdir "C:\AroniumSync"

REM ── نسخ sync.py ──────────────────────────────────────
copy /Y "%~dp0sync.py" "C:\AroniumSync\sync.py" > nul
if errorlevel 1 (
    echo [!] تعذّر نسخ sync.py - تأكد أن الملف موجود بجانب هذا الملف
    pause
    exit /b 1
)
echo [✓] تم نسخ sync.py

REM ── كتابة config.json ─────────────────────────────────
(
echo {
echo   "branch_id":       "%BRANCH_ID%",
echo   "branch_name":     "%BRANCH_NAME%",
echo   "aronium_db_path": "%DB_PATH:\=\\%",
echo   "supabase_url":    "https://yanbsscyclnmvlculxci.supabase.co",
echo   "supabase_key":    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhbmJzc2N5Y2xubXZsY3VseGNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEzODYxNiwiZXhwIjoyMDkxNzE0NjE2fQ.89xtA8-OT04r9QEhArvhtpK8I3pOPp4apfY2FhYLYHs",
echo   "server_url":      "https://marei-alshamal.vercel.app"
echo }
) > "C:\AroniumSync\config.json"
echo [✓] تم إنشاء config.json

REM ── كتابة run_silent.vbs ──────────────────────────────
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.CurrentDirectory = "C:\AroniumSync"
echo WshShell.Run "python sync.py", 0, False
) > "C:\AroniumSync\run_silent.vbs"
echo [✓] تم إنشاء run_silent.vbs

REM ── إضافة مهمة جدولة (Task Scheduler) ────────────────
echo.
echo [*] جاري إضافة مهمة التشغيل التلقائي...
echo     (قد تظهر نافذة UAC - اضغط نعم)
echo.

powershell -Command "& { $action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '\"C:\AroniumSync\run_silent.vbs\"'; $trigger = New-ScheduledTaskTrigger -AtStartup; $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -RunOnlyIfNetworkAvailable:$false -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0) -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1); $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest; $task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'مزامنة مراعي الشمال'; Register-ScheduledTask -TaskName 'AroniumSync-MaraeiAlShimal' -InputObject $task -Force | Out-Null; Write-Host 'تم!' }"

echo [✓] تم إضافة مهمة التشغيل التلقائي

REM ── تشغيل فوري ───────────────────────────────────────
echo.
echo [*] جاري التشغيل الآن...
taskkill /F /IM python.exe > nul 2>&1
start "" "wscript.exe" "C:\AroniumSync\run_silent.vbs"

timeout /t 5 /nobreak > nul

REM ── التحقق من النجاح ──────────────────────────────────
tasklist /FI "IMAGENAME eq python.exe" 2>nul | find /I "python.exe" > nul
if errorlevel 1 (
    echo [!] قد يحتاج بضع ثوانٍ ليبدأ Python
) else (
    echo [✓] Python يعمل في الخلفية!
)

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║   ✓  اكتمل التثبيت بنجاح!                       ║
echo ║                                                  ║
echo ║   • المزامنة كل 5 دقائق تلقائياً                ║
echo ║   • يبدأ تلقائياً عند تشغيل الجهاز              ║
echo ║   • يتحدث تلقائياً من الداشبورد                  ║
echo ╚══════════════════════════════════════════════════╝
echo.
echo ملف السجل: C:\AroniumSync\sync.log
echo.

REM عرض آخر سطور من السجل إن وجد
if exist "C:\AroniumSync\sync.log" (
    echo ─── آخر الأحداث: ───────────────────────────────────
    powershell -Command "Get-Content 'C:\AroniumSync\sync.log' -Tail 5 -ErrorAction SilentlyContinue"
    echo.
)

pause
