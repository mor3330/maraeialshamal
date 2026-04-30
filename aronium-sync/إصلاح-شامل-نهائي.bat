@echo off
chcp 65001 >nul 2>&1
title إصلاح شامل نهائي - مراعي الشمال

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║     إصلاح شامل ونهائي - مراعي الشمال           ║
echo ║  يُصلح التحديث + البدء التلقائي + الحارس        ║
echo ╚══════════════════════════════════════════════════╝
echo.

set INSTALL_DIR=C:\AroniumSync
set TASK_NAME=AroniumSync-MaraeiAlShimal
set GUARD_TASK=AroniumSync-Guard

:: ── تحديد مسار Python الكامل ──────────────────────────
echo [1/6] البحث عن Python...
set PYTHON_EXE=
for /f "delims=" %%i in ('where python 2^>nul') do (
    if not defined PYTHON_EXE set PYTHON_EXE=%%i
)
if not defined PYTHON_EXE (
    for /f "delims=" %%i in ('where py 2^>nul') do (
        if not defined PYTHON_EXE set PYTHON_EXE=%%i
    )
)
if not defined PYTHON_EXE (
    :: بحث يدوي في المسارات الشائعة
    if exist "C:\Python311\python.exe"   set PYTHON_EXE=C:\Python311\python.exe
    if exist "C:\Python310\python.exe"   set PYTHON_EXE=C:\Python310\python.exe
    if exist "C:\Python39\python.exe"    set PYTHON_EXE=C:\Python39\python.exe
    if exist "C:\Python312\python.exe"   set PYTHON_EXE=C:\Python312\python.exe
    for /d %%d in ("%LOCALAPPDATA%\Programs\Python\Python3*") do (
        if exist "%%d\python.exe" set PYTHON_EXE=%%d\python.exe
    )
)
if not defined PYTHON_EXE (
    echo [خطأ] Python غير موجود!
    pause
    exit /b 1
)
echo [OK] Python: %PYTHON_EXE%

:: ── تحميل آخر إصدار من GitHub ──────────────────────────
echo [2/6] تحميل آخر إصدار sync.py...
curl -L --silent --max-time 30 ^
  "https://raw.githubusercontent.com/mor3330/maraeialshamal/main/aronium-sync/sync.py" ^
  -o "%INSTALL_DIR%\sync.py.new" 2>nul
if not exist "%INSTALL_DIR%\sync.py.new" (
    powershell -NoProfile -Command ^
      "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/mor3330/maraeialshamal/main/aronium-sync/sync.py' -OutFile '%INSTALL_DIR%\sync.py.new' -UseBasicParsing" ^
      2>nul
)
if exist "%INSTALL_DIR%\sync.py.new" (
    copy /Y "%INSTALL_DIR%\sync.py" "%INSTALL_DIR%\sync.bak.py" >nul 2>&1
    move /Y "%INSTALL_DIR%\sync.py.new" "%INSTALL_DIR%\sync.py" >nul 2>&1
    echo [OK] تم تحديث sync.py
) else (
    echo [تحذير] لم يتم التحديث - سيعمل بالإصدار الحالي
)

:: ── تحديث run_silent.vbs بمسار Python الكامل ──────────
echo [3/6] إصلاح run_silent.vbs بمسار Python الكامل...
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.CurrentDirectory = "%INSTALL_DIR%"
    echo WshShell.Run """%PYTHON_EXE%"" ""%INSTALL_DIR%\sync.py""", 0, False
) > "%INSTALL_DIR%\run_silent.vbs"
echo [OK] تم إصلاح run_silent.vbs

:: ── إيقاف Python القديم ────────────────────────────────
echo [4/6] إيقاف النسخة القديمة...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM pythonw.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: ── إعادة تسجيل مهمة البدء التلقائي بمسار Python الكامل
echo [5/6] إعادة ضبط Task Scheduler...

:: حذف المهام القديمة
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>&1
schtasks /Delete /TN "%GUARD_TASK%" /F >nul 2>&1

:: مهمة البدء مع Windows (AtStartup) - بمسار Python الكامل
schtasks /Create /TN "%TASK_NAME%" ^
  /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\\sync.py\"" ^
  /SC ONSTART ^
  /RU SYSTEM ^
  /RL HIGHEST ^
  /F >nul 2>&1

if errorlevel 1 (
    :: بديل: تسجيل تحت المستخدم الحالي
    schtasks /Create /TN "%TASK_NAME%" ^
      /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\\sync.py\"" ^
      /SC ONLOGON ^
      /RL HIGHEST ^
      /F >nul 2>&1
    echo [OK] مهمة البدء: عند تسجيل الدخول
) else (
    echo [OK] مهمة البدء: عند تشغيل Windows ^(SYSTEM^)
)

:: مهمة الحارس كل 5 دقائق (تعيد تشغيل sync.py إذا توقف)
schtasks /Create /TN "%GUARD_TASK%" ^
  /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\\sync.py\"" ^
  /SC MINUTE /MO 5 ^
  /RU SYSTEM ^
  /RL HIGHEST ^
  /F >nul 2>&1
if errorlevel 1 (
    schtasks /Create /TN "%GUARD_TASK%" ^
      /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\\sync.py\"" ^
      /SC MINUTE /MO 5 ^
      /RL HIGHEST ^
      /F >nul 2>&1
)
echo [OK] مهمة الحارس: كل 5 دقائق

:: تسجيل في Registry أيضاً (طبقة أمان إضافية)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
    /v "AroniumSync" /t REG_SZ ^
    /d "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\\sync.py\"" /f >nul 2>&1
echo [OK] Registry startup: تم

:: ── تشغيل sync.py الآن ─────────────────────────────────
echo [6/6] تشغيل المزامنة الآن...
start "" wscript.exe "%INSTALL_DIR%\run_silent.vbs"
timeout /t 4 /nobreak >nul

:: التحقق
tasklist /FI "IMAGENAME eq python.exe" 2>nul | findstr /I "python" >nul
if %errorlevel% EQU 0 (
    echo.
    echo ╔══════════════════════════════════════════════════╗
    echo ║  ✅ تم الإصلاح الشامل بنجاح!                   ║
    echo ║  • sync.py يعمل الآن في الخلفية                 ║
    echo ║  • يبدأ تلقائياً عند تشغيل Windows             ║
    echo ║  • حارس يعيد تشغيله كل 5 دقائق                ║
    echo ║  • التحديثات تلقائية من الداشبورد              ║
    echo ╚══════════════════════════════════════════════════╝
) else (
    echo.
    echo [تحذير] Python لم يبدأ - جرب تشغيل run_silent.vbs يدوياً
)
echo.
timeout /t 6 /nobreak >nul
