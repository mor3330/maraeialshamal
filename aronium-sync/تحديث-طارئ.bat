@echo off
chcp 65001 >nul 2>&1
title تحديث مراعي الشمال - جاري التحديث...

echo.
echo ================================================
echo    تحديث مراعي الشمال - نظام المزامنة
echo ================================================
echo.

:: تحديد مسار المجلد الحالي
set SYNC_DIR=%~dp0
set SYNC_PY=%SYNC_DIR%sync.py
set CONFIG=%SYNC_DIR%config.json

:: التحقق من وجود config.json
if not exist "%CONFIG%" (
    echo [خطأ] ملف config.json غير موجود!
    echo تأكد أنك في مجلد aronium-sync الصحيح.
    pause
    exit /b 1
)

echo [1/4] إيقاف النسخة القديمة...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq sync*" >nul 2>&1
taskkill /F /IM pythonw.exe >nul 2>&1
:: انتظر ثانية
timeout /t 2 /nobreak >nul

echo [2/4] تحميل آخر إصدار من GitHub...
:: نحاول curl أولاً (مدمج في Windows 10/11)
curl -L --silent --show-error --max-time 30 ^
  "https://raw.githubusercontent.com/mor3330/maraeialshamal/main/aronium-sync/sync.py" ^
  -o "%SYNC_PY%.new" 2>&1

if errorlevel 1 (
    echo [تحذير] curl فشل - نجرب PowerShell...
    powershell -NoProfile -Command ^
      "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/mor3330/maraeialshamal/main/aronium-sync/sync.py' -OutFile '%SYNC_PY%.new' -UseBasicParsing" ^
      2>&1
)

:: التحقق من نجاح التحميل
if not exist "%SYNC_PY%.new" (
    echo [خطأ] فشل تحميل الإصدار الجديد! تحقق من الإنترنت.
    pause
    exit /b 1
)

:: التحقق من أن الملف ليس فارغاً
for %%A in ("%SYNC_PY%.new") do if %%~zA LSS 1000 (
    echo [خطأ] الملف المحمّل فارغ أو صغير جداً!
    del "%SYNC_PY%.new" >nul 2>&1
    pause
    exit /b 1
)

echo [3/4] تطبيق التحديث...
:: نسخة احتياطية
if exist "%SYNC_PY%" copy /Y "%SYNC_PY%" "%SYNC_DIR%sync.bak.py" >nul 2>&1
:: استبدال
move /Y "%SYNC_PY%.new" "%SYNC_PY%" >nul 2>&1

echo [4/4] تسجيل البدء التلقائي + إعادة التشغيل...
:: تسجيل في Windows Registry (بدون أدمن) لبدء تلقائي عند تسجيل الدخول
set VBS=%SYNC_DIR%run_silent.vbs
if exist "%VBS%" (
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
        /v "AroniumSync" /t REG_SZ ^
        /d "wscript.exe \"%VBS%\"" /f >nul 2>&1
) else (
    :: ابحث عن Python
    for /f "delims=" %%i in ('where python 2^>nul') do set PYTHON_EXE=%%i
    if defined PYTHON_EXE (
        reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
            /v "AroniumSync" /t REG_SZ ^
            /d "\"%PYTHON_EXE%\" \"%SYNC_PY%\"" /f >nul 2>&1
    )
)

:: تشغيل sync.py في الخلفية
if exist "%VBS%" (
    start "" wscript.exe "%VBS%"
) else (
    start /B "" python "%SYNC_PY%"
)

echo.
echo ================================================
echo    تم التحديث بنجاح!
echo    - تم تسجيل البدء التلقائي مع Windows
echo    - تم إعادة تشغيل المزامنة
echo    - هذا المجلد لن يحتاج تدخل يدوي مرة ثانية
echo ================================================
echo.
timeout /t 5 /nobreak >nul
