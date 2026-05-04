@echo off
chcp 65001 >nul 2>&1
title إصلاح مشكلة Python - مراعي الشمال

set INSTALL_DIR=C:\AroniumSync

echo.
echo   ╔══════════════════════════════════════════╗
echo   ║    إصلاح سريع - مراعي الشمال             ║
echo   ║    حل مشكلة "The system cannot find"     ║
echo   ╚══════════════════════════════════════════╝
echo.

:: ── البحث عن Python في كل الأماكن الممكنة ──
echo   [1/3] البحث عن Python...
set PYTHON_EXE=

for /f "delims=" %%i in ('where python 2^>nul') do (if not defined PYTHON_EXE set "PYTHON_EXE=%%i")
if not defined PYTHON_EXE for /f "delims=" %%i in ('where py 2^>nul') do (if not defined PYTHON_EXE set "PYTHON_EXE=%%i")
if not defined PYTHON_EXE for /f "delims=" %%i in ('where python3 2^>nul') do (if not defined PYTHON_EXE set "PYTHON_EXE=%%i")

if not defined PYTHON_EXE (
    for %%d in (
        "%LOCALAPPDATA%\Programs\Python\Python313"
        "%LOCALAPPDATA%\Programs\Python\Python312"
        "%LOCALAPPDATA%\Programs\Python\Python311"
        "%LOCALAPPDATA%\Programs\Python\Python310"
        "%LOCALAPPDATA%\Programs\Python\Python39"
        "%LOCALAPPDATA%\Programs\Python\Python38"
        "C:\Python313"
        "C:\Python312"
        "C:\Python311"
        "C:\Python310"
        "C:\Python39"
        "C:\Python38"
        "C:\Program Files\Python313"
        "C:\Program Files\Python312"
        "C:\Program Files\Python311"
        "C:\Program Files\Python310"
        "C:\Program Files (x86)\Python313"
        "C:\Program Files (x86)\Python311"
    ) do (
        if not defined PYTHON_EXE if exist "%%~d\python.exe" set "PYTHON_EXE=%%~d\python.exe"
    )
)

if not defined PYTHON_EXE (
    echo.
    echo   ╔══════════════════════════════════════════╗
    echo   ║  ❌ Python غير مثبّت على هذا الجهاز!     ║
    echo   ║                                          ║
    echo   ║  الحل:                                   ║
    echo   ║  1. افتح المتصفح                         ║
    echo   ║  2. اذهب إلى: python.org/downloads       ║
    echo   ║  3. حمّل Python وثبّته                   ║
    echo   ║  4. شغّل هذا الملف مرة ثانية             ║
    echo   ╚══════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

echo   [OK] Python موجود في: %PYTHON_EXE%
echo.

:: ── إصلاح run_silent.vbs ──
echo   [2/3] إصلاح ملف التشغيل...

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" >nul 2>&1

(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.CurrentDirectory = "%INSTALL_DIR%"
    echo WshShell.Run """%PYTHON_EXE%"" ""%INSTALL_DIR%\sync.py""", 0, False
) > "%INSTALL_DIR%\run_silent.vbs"

echo   [OK] تم إصلاح run_silent.vbs

:: ── إصلاح المهام المجدولة ──
echo   [3/3] إصلاح التشغيل التلقائي...

set TASK_SYNC=AroniumSync-MaraeiAlShimal
set TASK_GUARD=AroniumSync-Guard

schtasks /Delete /TN "%TASK_SYNC%"  /F >nul 2>&1
schtasks /Delete /TN "%TASK_GUARD%" /F >nul 2>&1

schtasks /Create /TN "%TASK_SYNC%" /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F >nul 2>&1
if errorlevel 1 schtasks /Create /TN "%TASK_SYNC%" /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\"" /SC ONLOGON /RL HIGHEST /F >nul 2>&1

schtasks /Create /TN "%TASK_GUARD%" /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\" --once" /SC MINUTE /MO 5 /RU SYSTEM /RL HIGHEST /F >nul 2>&1
if errorlevel 1 schtasks /Create /TN "%TASK_GUARD%" /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\" --once" /SC MINUTE /MO 5 /RL HIGHEST /F >nul 2>&1

reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "AroniumSync" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\run_silent.vbs\"" /f >nul 2>&1

echo   [OK] تم إصلاح التشغيل التلقائي

:: ── إعادة التشغيل ──
echo.
echo   ── إعادة تشغيل المزامنة... ──
taskkill /F /IM python.exe  >nul 2>&1
taskkill /F /IM pythonw.exe >nul 2>&1
timeout /t 2 /nobreak >nul

if exist "%INSTALL_DIR%\sync.py" (
    start "" wscript.exe "%INSTALL_DIR%\run_silent.vbs"
    timeout /t 4 /nobreak >nul

    tasklist /FI "IMAGENAME eq python.exe" 2>nul | findstr /I "python" >nul
    if %errorlevel% EQU 0 (
        echo.
        echo   ╔══════════════════════════════════════════╗
        echo   ║  ✅ تم الإصلاح والمزامنة تعمل الآن!     ║
        echo   ╚══════════════════════════════════════════╝
    ) else (
        echo.
        echo   ╔══════════════════════════════════════════╗
        echo   ║  ✅ تم الإصلاح                           ║
        echo   ║  ستبدأ المزامنة عند إعادة تشغيل الجهاز  ║
        echo   ╚══════════════════════════════════════════╝
    )
) else (
    echo.
    echo   ╔══════════════════════════════════════════╗
    echo   ║  ⚠️ sync.py غير موجود!                   ║
    echo   ║  شغّل تثبيت.bat بدلاً من هذا الملف       ║
    echo   ╚══════════════════════════════════════════╝
)

echo.
pause
