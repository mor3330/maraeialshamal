@echo off
chcp 65001 >nul 2>&1
title مراعي الشمال - جاري الإعداد...

:: ════════════════════════════════════════════════════════
::  تثبيت.bat - مراعي الشمال v2.8
::
::  للكاشير: فقط نقرتين على هذا الملف وانتظر.
::  يعمل من أي مكان (Desktop / Downloads / أي مجلد)
::  يضبط كل شيء بنفسه ثم يختفي تلقائياً.
:: ════════════════════════════════════════════════════════

set INSTALL_DIR=C:\AroniumSync
set TASK_SYNC=AroniumSync-MaraeiAlShimal
set TASK_GUARD=AroniumSync-Guard
set GITHUB_SYNC=https://raw.githubusercontent.com/mor3330/maraeialshamal/main/aronium-sync/sync.py
set GITHUB_VBS=https://raw.githubusercontent.com/mor3330/maraeialshamal/main/aronium-sync/run_silent.vbs

cls
echo.
echo   ╔══════════════════════════════════════════╗
echo   ║      مراعي الشمال - إعداد المزامنة       ║
echo   ║      يرجى الانتظار...                     ║
echo   ╚══════════════════════════════════════════╝
echo.

:: ══════════════════════════════════════════════════
:: الخطوة 0: إنشاء مجلد C:\AroniumSync إذا لم يوجد
:: ══════════════════════════════════════════════════
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%" >nul 2>&1
    echo   [*] تم إنشاء المجلد: %INSTALL_DIR%
)

:: ══════════════════════════════════════════════════
:: الخطوة 1: البحث عن config.json
::   أولاً: في C:\AroniumSync
::   ثانياً: في نفس مجلد هذا الملف
::   (الكاشير يضع config.json بجانب تثبيت.bat)
:: ══════════════════════════════════════════════════
echo   [1/5] التحقق من الإعدادات...

if not exist "%INSTALL_DIR%\config.json" (
    :: ابحث في نفس مجلد الملف
    if exist "%~dp0config.json" (
        copy /Y "%~dp0config.json" "%INSTALL_DIR%\config.json" >nul 2>&1
        echo   [OK] تم نسخ config.json
    ) else (
        echo.
        echo   ╔══════════════════════════════════════════╗
        echo   ║  [!] ملف الإعدادات غير موجود!           ║
        echo   ║                                          ║
        echo   ║  تأكد أن ملف config.json موجود          ║
        echo   ║  في نفس مجلد تثبيت.bat                  ║
        echo   ╚══════════════════════════════════════════╝
        echo.
        timeout /t 12 /nobreak >nul
        goto :cleanup_no_delete
    )
)
echo   [OK] الإعدادات موجودة

:: ══════════════════════════════════════════════════
:: الخطوة 2: البحث عن Python
:: ══════════════════════════════════════════════════
echo   [2/5] البحث عن Python...
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
        "C:\Python310" "C:\Python39" "C:\Program Files\Python313"
        "C:\Program Files\Python312" "C:\Program Files\Python311"
    ) do (
        if not defined PYTHON_EXE (
            if exist "%%~d\python.exe" set "PYTHON_EXE=%%~d\python.exe"
        )
    )
)
if not defined PYTHON_EXE (
    echo.
    echo   ╔══════════════════════════════════════════╗
    echo   ║  [!] Python غير موجود على هذا الجهاز!   ║
    echo   ║  تواصل مع المسؤول لتثبيت Python.        ║
    echo   ╚══════════════════════════════════════════╝
    timeout /t 12 /nobreak >nul
    goto :cleanup_no_delete
)
echo   [OK] Python: %PYTHON_EXE%

:: ══════════════════════════════════════════════════
:: الخطوة 3: تحميل آخر إصدار من GitHub
:: ══════════════════════════════════════════════════
echo   [3/5] تحميل آخر إصدار...

:: تحميل sync.py
curl -L --silent --max-time 30 "%GITHUB_SYNC%" -o "%INSTALL_DIR%\sync.py.new" 2>nul
if not exist "%INSTALL_DIR%\sync.py.new" (
    powershell -NoProfile -Command "try{Invoke-WebRequest -Uri '%GITHUB_SYNC%' -OutFile '%INSTALL_DIR%\sync.py.new' -UseBasicParsing}catch{}" 2>nul
)
if exist "%INSTALL_DIR%\sync.py.new" (
    for %%A in ("%INSTALL_DIR%\sync.py.new") do if %%~zA GTR 1000 (
        if exist "%INSTALL_DIR%\sync.py" copy /Y "%INSTALL_DIR%\sync.py" "%INSTALL_DIR%\sync.bak.py" >nul 2>&1
        move /Y "%INSTALL_DIR%\sync.py.new" "%INSTALL_DIR%\sync.py" >nul 2>&1
        echo   [OK] تم تحميل آخر إصدار sync.py
    ) else (
        del "%INSTALL_DIR%\sync.py.new" >nul 2>&1
    )
)
:: إذا لم يوجد sync.py أصلاً، توقف
if not exist "%INSTALL_DIR%\sync.py" (
    if exist "%~dp0sync.py" (
        copy /Y "%~dp0sync.py" "%INSTALL_DIR%\sync.py" >nul 2>&1
        echo   [OK] تم نسخ sync.py من المجلد الحالي
    ) else (
        echo   [!] تعذّر تحميل sync.py - تحقق من الاتصال
        timeout /t 8 /nobreak >nul
        goto :cleanup_no_delete
    )
)

:: ══════════════════════════════════════════════════
:: الخطوة 4: إعداد ملفات البدء التلقائي
:: ══════════════════════════════════════════════════
echo   [4/5] ضبط البدء التلقائي...

:: إنشاء run_silent.vbs بالمسار الكامل لـ Python
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.CurrentDirectory = "%INSTALL_DIR%"
    echo WshShell.Run """%PYTHON_EXE%"" ""%INSTALL_DIR%\sync.py""", 0, False
) > "%INSTALL_DIR%\run_silent.vbs"

:: إيقاف أي نسخة قديمة
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM pythonw.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Task Scheduler — يبدأ مع Windows
schtasks /Delete /TN "%TASK_SYNC%" /F >nul 2>&1
schtasks /Delete /TN "%TASK_GUARD%" /F >nul 2>&1

:: محاولة كـ SYSTEM (يحتاج Admin)
schtasks /Create /TN "%TASK_SYNC%" ^
  /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\"" ^
  /SC ONSTART /RU SYSTEM /RL HIGHEST /F >nul 2>&1

if errorlevel 1 (
    :: بديل: عند تسجيل الدخول (بدون Admin)
    schtasks /Create /TN "%TASK_SYNC%" ^
      /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\"" ^
      /SC ONLOGON /RL HIGHEST /F >nul 2>&1
)

:: حارس كل 5 دقائق
schtasks /Create /TN "%TASK_GUARD%" ^
  /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\" --once" ^
  /SC MINUTE /MO 5 /RU SYSTEM /RL HIGHEST /F >nul 2>&1
if errorlevel 1 (
    schtasks /Create /TN "%TASK_GUARD%" ^
      /TR "\"%PYTHON_EXE%\" \"%INSTALL_DIR%\sync.py\" --once" ^
      /SC MINUTE /MO 5 /RL HIGHEST /F >nul 2>&1
)

:: Registry — طبقة أمان إضافية
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
    /v "AroniumSync" /t REG_SZ ^
    /d "wscript.exe \"%INSTALL_DIR%\run_silent.vbs\"" /f >nul 2>&1

echo   [OK] تم ضبط البدء التلقائي

:: ══════════════════════════════════════════════════
:: الخطوة 5: تشغيل المزامنة الآن
:: ══════════════════════════════════════════════════
echo   [5/5] تشغيل المزامنة...

start "" wscript.exe "%INSTALL_DIR%\run_silent.vbs"
timeout /t 5 /nobreak >nul

:: التحقق من التشغيل
tasklist /FI "IMAGENAME eq python.exe" 2>nul | findstr /I "python" >nul
if %errorlevel% EQU 0 (
    echo.
    echo   ╔════════════════════════════════════════════╗
    echo   ║  ✅ تم الإعداد بنجاح!                     ║
    echo   ║                                            ║
    echo   ║  المزامنة تعمل الآن في الخلفية            ║
    echo   ║  وستبدأ تلقائياً مع كل تشغيل للجهاز       ║
    echo   ║                                            ║
    echo   ║  هذه النافذة ستغلق تلقائياً...            ║
    echo   ╚════════════════════════════════════════════╝
) else (
    echo.
    echo   ╔════════════════════════════════════════════╗
    echo   ║  ⚠️  تم الإعداد - لكن لم يبدأ Python     ║
    echo   ║  سيبدأ تلقائياً عند تشغيل الجهاز التالي  ║
    echo   ╚════════════════════════════════════════════╝
)
echo.

:: ══════════════════════════════════════════════════
:: نهاية: حذف هذا الملف تلقائياً
:: ══════════════════════════════════════════════════
timeout /t 5 /nobreak >nul
(goto) 2>nul & del "%~f0"
goto :eof

:cleanup_no_delete
echo.
echo   سيتم إغلاق هذه النافذة...
timeout /t 3 /nobreak >nul
