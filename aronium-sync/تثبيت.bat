@echo off
chcp 65001 >nul 2>&1
title مراعي الشمال - جاري الإعداد...

:: ════════════════════════════════════════════════════════
::  تثبيت.bat - مراعي الشمال v3
::
::  للمسؤول فقط: غيّر السطرين التاليين لكل فرع
::  ثم أرسل هذا الملف للكاشير عبر واتساب
:: ════════════════════════════════════════════════════════
set BRANCH_ID=d6a23737-509b-4a97-bb13-a12a5891e12a
set BRANCH_NAME=جهاز التجربة
:: ════════════════════════════════════════════════════════
::  لا تغير شيء أدناه
:: ════════════════════════════════════════════════════════

set INSTALL_DIR=C:\AroniumSync
set TASK_SYNC=AroniumSync-MaraeiAlShimal
set TASK_GUARD=AroniumSync-Guard
set SUPABASE_URL=https://yanbsscyclnmvlculxci.supabase.co
set SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhbmJzc2N5Y2xubXZsY3VseGNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEzODYxNiwiZXhwIjoyMDkxNzE0NjE2fQ.89xtA8-OT04r9QEhArvhtpK8I3pOPp4apfY2FhYLYHs
set SERVER_URL=https://marei-alshamal.vercel.app
set GITHUB_SYNC=https://raw.githubusercontent.com/mor3330/maraeialshamal/main/aronium-sync/sync.py

cls
echo.
echo   ╔══════════════════════════════════════════╗
echo   ║      مراعي الشمال - إعداد المزامنة       ║
echo   ║      يرجى الانتظار لا تغلق النافذة...    ║
echo   ╚══════════════════════════════════════════╝
echo.
echo   الفرع: %BRANCH_NAME%
echo.

:: ── 1: إنشاء المجلد ────────────────────────────────────
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" >nul 2>&1

:: ── 2: البحث عن Python ─────────────────────────────────
echo   [1/5] البحث عن Python...
set PYTHON_EXE=
for /f "delims=" %%i in ('where python 2^>nul') do (if not defined PYTHON_EXE set "PYTHON_EXE=%%i")
if not defined PYTHON_EXE for /f "delims=" %%i in ('where py 2^>nul') do (if not defined PYTHON_EXE set "PYTHON_EXE=%%i")
if not defined PYTHON_EXE (
    for %%d in (
        "%LOCALAPPDATA%\Programs\Python\Python313"
        "%LOCALAPPDATA%\Programs\Python\Python312"
        "%LOCALAPPDATA%\Programs\Python\Python311"
        "%LOCALAPPDATA%\Programs\Python\Python310"
        "%LOCALAPPDATA%\Programs\Python\Python39"
        "C:\Python313" "C:\Python312" "C:\Python311" "C:\Python310" "C:\Python39"
        "C:\Program Files\Python313" "C:\Program Files\Python312"
    ) do (if not defined PYTHON_EXE if exist "%%~d\python.exe" set "PYTHON_EXE=%%~d\python.exe")
)
if not defined PYTHON_EXE (
    echo.
    echo   [!] Python غير موجود - تواصل مع المسؤول.
    timeout /t 10 /nobreak >nul & exit /b
)
echo   [OK] %PYTHON_EXE%

:: ── 3: البحث عن قاعدة بيانات Aronium تلقائياً ─────────
echo   [2/5] البحث عن برنامج الكاشير...
set ARONIUM_DB=

:: البحث في المسارات الشائعة
for /f "delims=" %%f in ('dir /s /b "%LOCALAPPDATA%\Aronium\Data\pos.db" 2^>nul') do (
    if not defined ARONIUM_DB set "ARONIUM_DB=%%f"
)
if not defined ARONIUM_DB (
    for /f "delims=" %%f in ('dir /s /b "%APPDATA%\Aronium\Data\pos.db" 2^>nul') do (
        if not defined ARONIUM_DB set "ARONIUM_DB=%%f"
    )
)
if not defined ARONIUM_DB (
    for /f "delims=" %%f in ('dir /s /b "C:\Aronium\pos.db" 2^>nul') do (
        if not defined ARONIUM_DB set "ARONIUM_DB=%%f"
    )
)
if not defined ARONIUM_DB (
    for %%d in (C D E) do (
        if not defined ARONIUM_DB (
            for /f "delims=" %%f in ('dir /s /b "%%d:\pos.db" 2^>nul') do (
                if not defined ARONIUM_DB set "ARONIUM_DB=%%f"
            )
        )
    )
)

if not defined ARONIUM_DB (
    echo.
    echo   [!] لم يُعثر على برنامج Aronium تلقائياً.
    echo   هل مسار قاعدة البيانات مخصص؟ اكتبه هنا:
    set /p ARONIUM_DB=   المسار (مثال: C:\Aronium\pos.db): 
)

if not exist "%ARONIUM_DB%" (
    echo.
    echo   [!] ملف قاعدة البيانات غير موجود: %ARONIUM_DB%
    echo   تواصل مع المسؤول.
    timeout /t 10 /nobreak >nul & exit /b
)
echo   [OK] %ARONIUM_DB%

:: ── 4: كتابة config.json بشكل آمن عبر PowerShell ──────
echo   [3/5] حفظ الإعدادات...
powershell -NoProfile -Command ^
  "$cfg = [ordered]@{branch_id='%BRANCH_ID%'; branch_name='%BRANCH_NAME%'; aronium_db_path='%ARONIUM_DB:\=\\%'; supabase_url='%SUPABASE_URL%'; supabase_key='%SUPABASE_KEY%'; server_url='%SERVER_URL%'}; $cfg | ConvertTo-Json | Set-Content '%INSTALL_DIR%\config.json' -Encoding UTF8" ^
  >nul 2>&1
if not exist "%INSTALL_DIR%\config.json" (
    echo   [!] فشل حفظ الإعدادات. تواصل مع المسؤول.
    timeout /t 8 /nobreak >nul & exit /b
)
echo   [OK] config.json

:: ── 5: تحميل آخر إصدار sync.py ─────────────────────────
echo   [4/5] تحميل آخر إصدار...
curl -L --silent --max-time 30 "%GITHUB_SYNC%" -o "%INSTALL_DIR%\sync.py.new" 2>nul
if not exist "%INSTALL_DIR%\sync.py.new" (
    powershell -NoProfile -Command "try{Invoke-WebRequest -Uri '%GITHUB_SYNC%' -OutFile '%INSTALL_DIR%\sync.py.new' -UseBasicParsing}catch{}" 2>nul
)
if exist "%INSTALL_DIR%\sync.py.new" (
    for %%A in ("%INSTALL_DIR%\sync.py.new") do if %%~zA GTR 1000 (
        if exist "%INSTALL_DIR%\sync.py" copy /Y "%INSTALL_DIR%\sync.py" "%INSTALL_DIR%\sync.bak.py" >nul 2>&1
        move /Y "%INSTALL_DIR%\sync.py.new" "%INSTALL_DIR%\sync.py" >nul 2>&1
        echo   [OK] تم تحميل آخر إصدار
    ) else (del "%INSTALL_DIR%\sync.py.new" >nul 2>&1)
)
if not exist "%INSTALL_DIR%\sync.py" (
    echo   [!] تعذّر التحميل - تحقق من الإنترنت وأعد المحاولة.
    timeout /t 8 /nobreak >nul & exit /b
)

:: ── 6: ضبط التشغيل التلقائي ────────────────────────────
echo   [5/5] ضبط البدء التلقائي...

:: إنشاء run_silent.vbs
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.CurrentDirectory = "%INSTALL_DIR%"
    echo WshShell.Run """%PYTHON_EXE%"" ""%INSTALL_DIR%\sync.py""", 0, False
) > "%INSTALL_DIR%\run_silent.vbs"

:: إيقاف أي نسخة قديمة
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM pythonw.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Task Scheduler
schtasks /Delete /TN "%TASK_SYNC%" /F >nul 2>&1
schtasks /Delete /TN "%TASK_GUARD%" /F >nul 2>&1

schtasks /Create /TN "%TASK_SYNC%" /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F >nul 2>&1
if errorlevel 1 schtasks /Create /TN "%TASK_SYNC%" /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\"" /SC ONLOGON /RL HIGHEST /F >nul 2>&1

schtasks /Create /TN "%TASK_GUARD%" /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\" --once" /SC MINUTE /MO 5 /RU SYSTEM /RL HIGHEST /F >nul 2>&1
if errorlevel 1 schtasks /Create /TN "%TASK_GUARD%" /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\" --once" /SC MINUTE /MO 5 /RL HIGHEST /F >nul 2>&1

:: Registry (طبقة إضافية)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "AroniumSync" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\run_silent.vbs\"" /f >nul 2>&1

echo   [OK] البدء التلقائي جاهز

:: ── 7: تشغيل المزامنة فوراً ────────────────────────────
start "" wscript.exe "%INSTALL_DIR%\run_silent.vbs"
timeout /t 5 /nobreak >nul

tasklist /FI "IMAGENAME eq python.exe" 2>nul | findstr /I "python" >nul
if %errorlevel% EQU 0 (
    echo.
    echo   ╔════════════════════════════════════════════╗
    echo   ║  ✅ تم الإعداد بنجاح!                     ║
    echo   ║                                            ║
    echo   ║  المزامنة تعمل الآن في الخلفية            ║
    echo   ║  وستبدأ تلقائياً مع كل تشغيل للجهاز       ║
    echo   ║                                            ║
    echo   ║  النافذة ستغلق تلقائياً...                ║
    echo   ╚════════════════════════════════════════════╝
) else (
    echo.
    echo   ╔════════════════════════════════════════════╗
    echo   ║  ⚠️  تم الإعداد - سيبدأ عند التشغيل      ║
    echo   ║  القادم للجهاز تلقائياً                   ║
    echo   ╚════════════════════════════════════════════╝
)
echo.
timeout /t 5 /nobreak >nul
(goto) 2>nul & del "%~f0"
