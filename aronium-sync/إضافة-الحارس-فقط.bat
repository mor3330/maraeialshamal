@echo off
chcp 65001 >nul 2>&1
title إضافة نظام الحارس - مراعي الشمال

:: ─── رفع الصلاحيات ─────────────────────────────────────
net session >nul 2>&1
if %errorlevel% NEQ 0 (
    echo جاري رفع الصلاحيات...
    powershell -Command "Start-Process -FilePath cmd.exe -ArgumentList '/c \"%~f0\"' -Verb RunAs -WorkingDirectory '%~dp0'"
    exit /b
)

set INSTALL_DIR=C:\AroniumSync
set WATCHDOG_TASK=AroniumWatchdog-MaraeiAlShimal
set SOURCE_DIR=%~dp0

echo.
echo ═══════════════════════════════════════════════════════
echo   إضافة نظام الحارس التلقائي
echo   (للأجهزة المثبّت عليها النظام مسبقاً)
echo ═══════════════════════════════════════════════════════
echo.

:: ─── [1] تحديث sync.py بالنسخة الجديدة ─────────────────
echo [1] تحديث sync.py (v2.3 مع الحارس والأيام الفائتة)...
if exist "%SOURCE_DIR%sync.py" (
    :: أوقف السكريبت الحالي
    taskkill /F /FI "WINDOWTITLE eq AroniumSync*" >nul 2>&1
    :: نسخة احتياطية من القديم
    if exist "%INSTALL_DIR%\sync.py" (
        copy /Y "%INSTALL_DIR%\sync.py" "%INSTALL_DIR%\sync.backup.py" >nul
    )
    :: نسخ الجديد
    copy /Y "%SOURCE_DIR%sync.py" "%INSTALL_DIR%\sync.py" >nul
    echo     OK: تم تحديث sync.py
) else (
    echo     خطأ: sync.py غير موجود في %SOURCE_DIR%
    pause
    exit /b 1
)

:: ─── [2] نسخ ملف الحارس ─────────────────────────────────
echo [2] نسخ حارس-المزامنة.bat...
if exist "%SOURCE_DIR%حارس-المزامنة.bat" (
    copy /Y "%SOURCE_DIR%حارس-المزامنة.bat" "%INSTALL_DIR%\حارس-المزامنة.bat" >nul
    echo     OK
) else (
    echo     خطأ: حارس-المزامنة.bat غير موجود
    pause
    exit /b 1
)

:: ─── [3] تسجيل مهمة الحارس ─────────────────────────────
echo [3] تسجيل مهمة الحارس (كل 5 دقائق)...
schtasks /Delete /TN "%WATCHDOG_TASK%" /F >nul 2>&1

for /f "tokens=*" %%u in ('whoami') do set CURRENT_USER=%%u

schtasks /Create /TN "%WATCHDOG_TASK%" ^
  /TR "cmd.exe /c \"%INSTALL_DIR%\حارس-المزامنة.bat\"" ^
  /SC MINUTE /MO 5 ^
  /RU "%CURRENT_USER%" /RL HIGHEST ^
  /F >nul 2>&1

if %errorlevel% EQU 0 (
    echo     OK: مهمة الحارس تعمل كل 5 دقائق
) else (
    echo     تحذير: فشل تسجيل مهمة الحارس
)

:: ─── [4] إعادة تشغيل السكريبت ──────────────────────────
echo [4] تشغيل السكريبت المحدّث...
if exist "%INSTALL_DIR%\run_silent.vbs" (
    wscript.exe "%INSTALL_DIR%\run_silent.vbs"
    echo     OK: تم تشغيل السكريبت
) else (
    cd /d "%INSTALL_DIR%"
    start /MIN "" python sync.py
    echo     OK: تم تشغيل السكريبت
)

echo.
echo ═══════════════════════════════════════════════════════
echo   تم بنجاح!
echo.
echo   ما تم:
echo   1) تحديث sync.py للنسخة v2.3
echo   2) إضافة الحارس التلقائي (كل 5 دقائق)
echo   3) إضافة ميزة استرداد الأيام الفائتة
echo.
echo   الآن: إذا انقطع النت لأيام وعاد → يجيب بيانات
echo         كل الأيام الفائتة تلقائياً بدون تدخل منك!
echo ═══════════════════════════════════════════════════════
echo.
pause
