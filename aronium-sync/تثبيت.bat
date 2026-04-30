@echo off
chcp 65001 >nul 2>&1
title مراعي الشمال - جاري الإعداد...

:: ════════════════════════════════════════════════════════
::  تثبيت.bat - مراعي الشمال
::  ملف واحد يُشغَّل مرة واحدة فقط ثم يحذف نفسه
::  يُصلح التحديث + البدء التلقائي + الحارس
:: ════════════════════════════════════════════════════════

set INSTALL_DIR=C:\AroniumSync
set TASK_NAME=AroniumSync-MaraeiAlShimal
set TASK_GUARD=AroniumSync-Guard

echo.
echo   ╔══════════════════════════════════════╗
echo   ║     مراعي الشمال - إعداد المزامنة    ║
echo   ╚══════════════════════════════════════╝
echo.

:: ── التحقق من وجود config.json ───────────────────────
if not exist "%INSTALL_DIR%\config.json" (
    echo   [!] ملف config.json غير موجود في %INSTALL_DIR%
    echo   [!] تأكد أن التثبيت الأساسي تم أولاً.
    timeout /t 8 /nobreak >nul
    goto :cleanup
)

:: ── البحث عن Python بالمسار الكامل ──────────────────
echo   [1/5] البحث عن Python...
set PYTHON_EXE=

for /f "delims=" %%i in ('where python 2^>nul') do (
    if not defined PYTHON_EXE set "PYTHON_EXE=%%i"
)
if not defined PYTHON_EXE (
    for /f "delims=" %%i in ('where py 2^>nul') do (
        if not defined PYTHON_EXE set "PYTHON_EXE=%%i"
    )
)
if not defined PYTHON_EXE (
    for %%d in (
        "%LOCALAPPDATA%\Programs\Python\Python313"
        "%LOCALAPPDATA%\Programs\Python\Python312"
        "%LOCALAPPDATA%\Programs\Python\Python311"
        "%LOCALAPPDATA%\Programs\Python\Python310"
        "%LOCALAPPDATA%\Programs\Python\Python39"
        "C:\Python313" "C:\Python312" "C:\Python311"
        "C:\Python310" "C:\Python39"
    ) do (
        if not defined PYTHON_EXE (
            if exist "%%~d\python.exe" set "PYTHON_EXE=%%~d\python.exe"
        )
    )
)
if not defined PYTHON_EXE (
    echo   [!] Python غير موجود! يجب تثبيته أولاً.
    echo   https://www.python.org/downloads/
    timeout /t 10 /nobreak >nul
    goto :cleanup
)
echo   [OK] Python: %PYTHON_EXE%

:: ── تحميل آخر إصدار sync.py ────────────────────────
echo   [2/5] تحميل آخر إصدار...
set SYNC_URL=https://raw.githubusercontent.com/mor3330/maraeialshamal/main/aronium-sync/sync.py
set NEW_PY=%INSTALL_DIR%\sync.py.new

curl -L --silent --max-time 30 "%SYNC_URL%" -o "%NEW_PY%" 2>nul
if not exist "%NEW_PY%" (
    powershell -NoProfile -Command ^
      "try { Invoke-WebRequest -Uri '%SYNC_URL%' -OutFile '%NEW_PY%' -UseBasicParsing } catch {}" ^
      2>nul
)

if exist "%NEW_PY%" (
    for %%A in ("%NEW_PY%") do if %%~zA GTR 1000 (
        if exist "%INSTALL_DIR%\sync.py" (
            copy /Y "%INSTALL_DIR%\sync.py" "%INSTALL_DIR%\sync.bak.py" >nul 2>&1
        )
        move /Y "%NEW_PY%" "%INSTALL_DIR%\sync.py" >nul 2>&1
        echo   [OK] تم تحميل آخر إصدار
    ) else (
        del "%NEW_PY%" >nul 2>&1
        echo   [~] سيتم استخدام الإصدار الحالي
    )
) else (
    echo   [~] سيتم استخدام الإصدار الحالي
)

:: ── إصلاح run_silent.vbs بمسار Python الكامل ───────
echo   [3/5] إصلاح الملفات...
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.CurrentDirectory = "%INSTALL_DIR%"
    echo WshShell.Run """%PYTHON_EXE%"" ""%INSTALL_DIR%\sync.py""", 0, False
) > "%INSTALL_DIR%\run_silent.vbs"
echo   [OK] run_silent.vbs

:: ── إيقاف أي نسخة قديمة ────────────────────────────
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM pythonw.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: ── Task Scheduler: بدء مع Windows ─────────────────
echo   [4/5] ضبط Task Scheduler...
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>&1
schtasks /Delete /TN "%TASK_GUARD%" /F >nul 2>&1

:: مهمة البدء مع Windows تحت SYSTEM
schtasks /Create /TN "%TASK_NAME%" ^
  /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\"" ^
  /SC ONSTART /RU SYSTEM /RL HIGHEST /F >nul 2>&1

if errorlevel 1 (
    :: بديل: تحت المستخدم الحالي عند تسجيل الدخول
    schtasks /Create /TN "%TASK_NAME%" ^
      /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\"" ^
      /SC ONLOGON /RL HIGHEST /F >nul 2>&1
    echo   [OK] مهمة البدء: عند تسجيل الدخول
) else (
    echo   [OK] مهمة البدء: مع Windows ^(SYSTEM^)
)

:: مهمة الحارس كل 5 دقائق (يعيد التشغيل تلقائياً)
schtasks /Create /TN "%TASK_GUARD%" ^
  /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\" --once" ^
  /SC MINUTE /MO 5 /RU SYSTEM /RL HIGHEST /F >nul 2>&1
if errorlevel 1 (
    schtasks /Create /TN "%TASK_GUARD%" ^
      /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\" --once" ^
      /SC MINUTE /MO 5 /RL HIGHEST /F >nul 2>&1
)
echo   [OK] مهمة الحارس: كل 5 دقائق

:: تسجيل في Registry (طبقة ثالثة من الأمان)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
    /v "AroniumSync" /t REG_SZ ^
    /d "wscript.exe \"%INSTALL_DIR%\run_silent.vbs\"" /f >nul 2>&1
echo   [OK] Registry Startup

:: ── تشغيل sync.py الآن ─────────────────────────────
echo   [5/5] تشغيل المزامنة...
start "" wscript.exe "%INSTALL_DIR%\run_silent.vbs"
timeout /t 4 /nobreak >nul

:: التحقق من التشغيل
tasklist /FI "IMAGENAME eq python.exe" 2>nul | findstr /I "python" >nul
if %errorlevel% EQU 0 (
    echo.
    echo   ╔══════════════════════════════════════╗
    echo   ║   ✅ تم الإعداد بنجاح!               ║
    echo   ║   المزامنة تعمل الآن في الخلفية      ║
    echo   ║   ستبدأ تلقائياً مع كل تشغيل         ║
    echo   ╚══════════════════════════════════════╝
) else (
    echo.
    echo   [!] لم يبدأ Python - حاول يدوياً:
    echo   "%PYTHON_EXE%" "%INSTALL_DIR%\sync.py"
)
echo.

:cleanup
:: ── حذف هذا الملف نفسه ─────────────────────────────
timeout /t 4 /nobreak >nul
(goto) 2>nul & del "%~f0"
