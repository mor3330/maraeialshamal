@echo off
chcp 65001 >nul 2>&1
title مراعي الشمال - تحديث v3.1

set INSTALL_DIR=C:\AroniumSync
set TASK_SYNC=AroniumSync-MaraeiAlShimal
set TASK_GUARD=AroniumSync-Guard
set GITHUB_SYNC=https://raw.githubusercontent.com/mor3330/maraeialshamal/main/aronium-sync/sync.py

cls
echo.
echo   ╔══════════════════════════════════════════╗
echo   ║    مراعي الشمال - تحديث إلى v3.1        ║
echo   ║    يحل مشكلة الأرقام الناقصة             ║
echo   ╚══════════════════════════════════════════╝
echo.

:: ── التحقق من وجود التثبيت ──────────────────────────────
if not exist "%INSTALL_DIR%\config.json" (
    echo   [!] النظام غير مثبّت على هذا الجهاز!
    echo   [!] استخدم ملف تثبيت.bat بدلاً من هذا الملف
    echo.
    timeout /t 8 /nobreak >nul
    goto :eof
)

:: ── الخطوة 1: تحميل sync.py الجديد ───────────────────────
echo   [1/4] تحميل sync.py v3.1...
curl -L --silent --max-time 30 "%GITHUB_SYNC%" -o "%INSTALL_DIR%\sync.py.new" 2>nul
if not exist "%INSTALL_DIR%\sync.py.new" (
    powershell -NoProfile -Command "try{Invoke-WebRequest -Uri '%GITHUB_SYNC%' -OutFile '%INSTALL_DIR%\sync.py.new' -UseBasicParsing -TimeoutSec 30}catch{}" 2>nul
)
if exist "%INSTALL_DIR%\sync.py.new" (
    for %%A in ("%INSTALL_DIR%\sync.py.new") do if %%~zA GTR 1000 (
        if exist "%INSTALL_DIR%\sync.py" copy /Y "%INSTALL_DIR%\sync.py" "%INSTALL_DIR%\sync.bak.py" >nul 2>&1
        move /Y "%INSTALL_DIR%\sync.py.new" "%INSTALL_DIR%\sync.py" >nul 2>&1
        echo   [OK] تم تحميل v3.1
    ) else (
        del "%INSTALL_DIR%\sync.py.new" >nul 2>&1
        echo   [!] الملف صغير - تحقق من الإنترنت
        timeout /t 6 /nobreak >nul
        goto :eof
    )
) else (
    echo   [!] تعذّر التحميل - تحقق من الإنترنت وأعد المحاولة
    echo.
    timeout /t 8 /nobreak >nul
    goto :eof
)

:: ── الخطوة 2: البحث عن Python ─────────────────────────────
echo   [2/4] البحث عن Python...
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
    ) do (
        if not defined PYTHON_EXE if exist "%%~d\python.exe" set "PYTHON_EXE=%%~d\python.exe"
    )
)
if not defined PYTHON_EXE (
    echo   [!] Python غير موجود - تواصل مع المسؤول
    timeout /t 8 /nobreak >nul & goto :eof
)
echo   [OK] %PYTHON_EXE%

:: ── الخطوة 3: إعادة ضبط المهام المجدولة ────────────────────
echo   [3/4] إعادة ضبط المهام التلقائية...
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.CurrentDirectory = "%INSTALL_DIR%"
    echo WshShell.Run """%PYTHON_EXE%"" ""%INSTALL_DIR%\sync.py""", 0, False
) > "%INSTALL_DIR%\run_silent.vbs"

schtasks /Delete /TN "%TASK_SYNC%" /F >nul 2>&1
schtasks /Delete /TN "%TASK_GUARD%" /F >nul 2>&1
schtasks /Create /TN "%TASK_SYNC%" /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F >nul 2>&1
if errorlevel 1 schtasks /Create /TN "%TASK_SYNC%" /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\"" /SC ONLOGON /RL HIGHEST /F >nul 2>&1
schtasks /Create /TN "%TASK_GUARD%" /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\" --once" /SC MINUTE /MO 5 /RU SYSTEM /RL HIGHEST /F >nul 2>&1
if errorlevel 1 schtasks /Create /TN "%TASK_GUARD%" /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\" --once" /SC MINUTE /MO 5 /RL HIGHEST /F >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "AroniumSync" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\run_silent.vbs\"" /f >nul 2>&1
echo   [OK] تم الإصلاح

:: ── الخطوة 4: إعادة التشغيل ──────────────────────────────
echo   [4/4] إعادة تشغيل المزامنة...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM pythonw.exe >nul 2>&1
timeout /t 2 /nobreak >nul
start "" wscript.exe "%INSTALL_DIR%\run_silent.vbs"
timeout /t 4 /nobreak >nul

tasklist /FI "IMAGENAME eq python.exe" 2>nul | findstr /I "python" >nul
if %errorlevel% EQU 0 (
    echo.
    echo   ╔══════════════════════════════════════════╗
    echo   ║  ✅ تم التحديث إلى v3.1 بنجاح!          ║
    echo   ║  المزامنة تعمل الآن في الخلفية           ║
    echo   ║  الأرقام ستكون صحيحة من الآن             ║
    echo   ╚══════════════════════════════════════════╝
) else (
    echo.
    echo   ╔══════════════════════════════════════════╗
    echo   ║  ✅ تم التحديث إلى v3.1                 ║
    echo   ║  ستبدأ المزامنة تلقائياً عند التشغيل     ║
    echo   ╚══════════════════════════════════════════╝
)
echo.
timeout /t 5 /nobreak >nul
