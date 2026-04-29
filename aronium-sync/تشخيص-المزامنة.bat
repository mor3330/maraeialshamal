@echo off
chcp 65001 >nul 2>&1
title تشخيص نظام المزامنة - مراعي الشمال
color 0A

echo.
echo ═══════════════════════════════════════════════════════
echo   تشخيص نظام مزامنة Aronium POS - مراعي الشمال
echo ═══════════════════════════════════════════════════════
echo.

:: ─── فحص Python ───
echo [1] فحص Python...
python --version >nul 2>&1
if %errorlevel% NEQ 0 (
    echo     خطأ: Python غير مثبت أو غير موجود في PATH
    echo     قم بتثبيت Python من: https://python.org
    goto ERROR
) else (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo     OK: %%v
)

:: ─── فحص sync.py ───
echo.
echo [2] فحص ملف sync.py...
if exist "C:\AroniumSync\sync.py" (
    echo     OK: C:\AroniumSync\sync.py موجود
    set SYNC_DIR=C:\AroniumSync
) else if exist "%~dp0sync.py" (
    echo     OK: sync.py موجود في المجلد الحالي
    set SYNC_DIR=%~dp0
) else (
    echo     خطأ: sync.py غير موجود!
    echo     ابحث عنه يدوياً وحدد المسار
    goto ERROR
)

:: ─── فحص config.json ───
echo.
echo [3] فحص config.json...
if exist "%SYNC_DIR%\config.json" (
    echo     OK: config.json موجود
) else (
    echo     خطأ: config.json غير موجود!
    echo     انسخ config.json وعبّاه ببيانات الفرع
    goto ERROR
)

:: ─── فحص Task Scheduler ───
echo.
echo [4] فحص Task Scheduler...
schtasks /query /tn "AroniumSync-MaraeiAlShimal" >nul 2>&1
if %errorlevel% EQU 0 (
    echo     OK: مهمة الجدولة موجودة وتعمل تلقائياً
    schtasks /query /tn "AroniumSync-MaraeiAlShimal" /fo LIST | findstr /i "Status"
) else (
    echo     تحذير: مهمة الجدولة غير مرئية للمستخدم الحالي
    echo     (قد تكون مثبتة تحت حساب Admin - هذا طبيعي)
    echo     الأهم: تأكد أن [5] أدناه يظهر OK
    echo     لإعادة التثبيت: شغّل تثبيت-كمسؤول.bat
)

:: ─── تشغيل مزامنة فورية الآن ───
echo.
echo [5] تشغيل مزامنة فورية الآن (--trigger)...
echo     جاري التنفيذ... قد يستغرق 30 ثانية
echo.
cd /d "%SYNC_DIR%"
python sync.py --trigger
echo.

if %errorlevel% EQU 0 (
    echo     OK: اكتملت المزامنة بنجاح
) else (
    echo     تحذير: انتهى بكود خطأ %errorlevel%
)

:: ─── عرض آخر سطور من السجل ───
echo.
echo [6] آخر 15 سطر من sync.log:
echo ─────────────────────────────────────────────────────
if exist "%SYNC_DIR%\sync.log" (
    powershell -command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content '%SYNC_DIR%\sync.log' -Encoding UTF8 -Tail 15"
) else (
    echo     (لا يوجد sync.log بعد)
)

echo.
echo ═══════════════════════════════════════════════════════
echo   اكتمل التشخيص - اضغط أي مفتاح للإغلاق
echo ═══════════════════════════════════════════════════════
pause >nul
exit /b 0

:ERROR
echo.
echo ═══════════════════════════════════════════════════════
echo   توقف التشخيص بسبب خطأ - اقرأ الرسائل بالأعلى
echo ═══════════════════════════════════════════════════════
pause >nul
exit /b 1
