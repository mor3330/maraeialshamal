@echo off
chcp 65001 >nul 2>&1
title تشخيص وإصلاح شامل - مراعي الشمال
color 0B

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║    تشخيص وإصلاح نظام المزامنة - مراعي الشمال          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

set SYNC_DIR=C:\AroniumSync
set FOUND_ISSUE=0

:: ─── [1] فحص Python ───────────────────────────────────────
echo ══════════════════════════════════════════
echo  [1] فحص Python
echo ══════════════════════════════════════════
python --version >nul 2>&1
if %errorlevel% NEQ 0 (
    echo  ✗ Python غير مثبت!
    echo    الحل: حمّل Python من https://python.org
    echo    تأكد وضع علامة صح على "Add Python to PATH"
    set FOUND_ISSUE=1
) else (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo  ✓ %%v مثبت
)
echo.

:: ─── [2] فحص ملفات المزامنة ──────────────────────────────
echo ══════════════════════════════════════════
echo  [2] فحص ملفات المزامنة
echo ══════════════════════════════════════════
if exist "%SYNC_DIR%\sync.py" (
    echo  ✓ sync.py موجود
) else (
    echo  ✗ sync.py غير موجود في %SYNC_DIR%
    set FOUND_ISSUE=1
)

if exist "%SYNC_DIR%\config.json" (
    echo  ✓ config.json موجود
    echo.
    echo  --- محتوى config.json ---
    type "%SYNC_DIR%\config.json"
    echo  -------------------------
) else (
    echo  ✗ config.json غير موجود في %SYNC_DIR%
    set FOUND_ISSUE=1
)
echo.

:: ─── [3] استخراج وفحص مسار Aronium DB ───────────────────
echo ══════════════════════════════════════════
echo  [3] فحص مسار قاعدة بيانات Aronium
echo ══════════════════════════════════════════

:: استخراج المسار من config.json بطريقة بسيطة
for /f "tokens=2 delims=:," %%a in ('findstr "aronium_db_path" "%SYNC_DIR%\config.json" 2^>nul') do (
    set DB_PATH_RAW=%%a
)

:: تنظيف المسار من علامات التنصيص والمسافات
for /f "tokens=* delims= " %%a in ("%DB_PATH_RAW%") do set DB_PATH_CLEAN=%%a
set DB_PATH_CLEAN=%DB_PATH_CLEAN:"=%

echo  المسار المحفوظ في config.json:
echo  %DB_PATH_CLEAN%
echo.

if exist "%DB_PATH_CLEAN%" (
    echo  ✓ ملف pos.db موجود في المسار المحفوظ!
) else (
    echo  ✗ الملف غير موجود في المسار المحفوظ!
    echo.
    echo  ══ البحث عن pos.db في كل أماكنه الممكنة ══
    set FOUND_DB=0

    echo  البحث في AppData لجميع المستخدمين...
    for /d %%u in (C:\Users\*) do (
        if exist "%%u\AppData\Local\Aronium\Data\pos.db" (
            echo  ✓✓ وُجد هنا: %%u\AppData\Local\Aronium\Data\pos.db
            set FOUND_DB=1
        )
    )

    if exist "C:\Aronium\Data\pos.db" (
        echo  ✓✓ وُجد هنا: C:\Aronium\Data\pos.db
        set FOUND_DB=1
    )
    if exist "C:\POS\Data\pos.db" (
        echo  ✓✓ وُجد هنا: C:\POS\Data\pos.db
        set FOUND_DB=1
    )
    if exist "D:\Aronium\Data\pos.db" (
        echo  ✓✓ وُجد هنا: D:\Aronium\Data\pos.db
        set FOUND_DB=1
    )

    :: بحث أعمق عبر where
    for /f "usebackq delims=" %%f in (`dir /s /b "C:\pos.db" 2^>nul`) do (
        echo  ✓✓ وُجد هنا: %%f
        set FOUND_DB=1
    )
    for /f "usebackq delims=" %%f in (`dir /s /b "C:\Users\*\pos.db" 2^>nul`) do (
        echo  ✓✓ وُجد هنا: %%f
        set FOUND_DB=1
    )

    if %FOUND_DB%==0 (
        echo  ✗ لم يُعثر على pos.db في أي مكان!
        echo    تأكد أن برنامج Aronium مثبت ويعمل على هذا الجهاز
    ) else (
        echo.
        echo  ► الحل: شغّل "إصلاح-مسار-DB.bat" ثم حدد المسار الصحيح من الأعلى
    )
    set FOUND_ISSUE=1
)
echo.

:: ─── [4] فحص الاتصال بالإنترنت وبـ Supabase ─────────────
echo ══════════════════════════════════════════
echo  [4] فحص الاتصال بالإنترنت
echo ══════════════════════════════════════════
ping -n 1 8.8.8.8 >nul 2>&1
if %errorlevel% EQU 0 (
    echo  ✓ الإنترنت يعمل
) else (
    echo  ✗ لا يوجد اتصال بالإنترنت!
    echo    تأكد من الاتصال ثم أعد التشغيل
    set FOUND_ISSUE=1
)

ping -n 1 supabase.co >nul 2>&1
if %errorlevel% EQU 0 (
    echo  ✓ يمكن الوصول لـ Supabase
) else (
    echo  تحقق من إعدادات الجدار الناري...
)
echo.

:: ─── [5] فحص Task Scheduler ──────────────────────────────
echo ══════════════════════════════════════════
echo  [5] فحص Task Scheduler
echo ══════════════════════════════════════════
schtasks /query /tn "AroniumSync-MaraeiAlShimal" >nul 2>&1
if %errorlevel% EQU 0 (
    echo  ✓ المهمة مسجلة
    echo    الحالة:
    schtasks /query /tn "AroniumSync-MaraeiAlShimal" /fo LIST | findstr /i "Status Last"
) else (
    echo  ✗ المهمة غير مسجلة
    echo    الحل: شغّل تثبيت-كمسؤول.bat
    set FOUND_ISSUE=1
)
echo.

:: ─── [6] فحص sync.log ────────────────────────────────────
echo ══════════════════════════════════════════
echo  [6] آخر سطور من sync.log
echo ══════════════════════════════════════════
if exist "%SYNC_DIR%\sync.log" (
    echo  آخر 20 سطر:
    echo  ──────────────────────────────────────
    powershell -command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content '%SYNC_DIR%\sync.log' -Encoding UTF8 -Tail 20"
) else (
    echo  (لا يوجد sync.log - المزامنة لم تعمل أبداً)
    set FOUND_ISSUE=1
)
echo.

:: ─── [7] تشغيل مزامنة فورية الآن ────────────────────────
echo ══════════════════════════════════════════
echo  [7] تجربة مزامنة الآن
echo ══════════════════════════════════════════
if exist "%SYNC_DIR%\sync.py" (
    echo  جاري التنفيذ... (قد يأخذ 30 ثانية)
    echo.
    cd /d "%SYNC_DIR%"
    python sync.py --once
    echo.
    echo  آخر 10 سطور من sync.log بعد التجربة:
    echo  ──────────────────────────────────────
    powershell -command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content '%SYNC_DIR%\sync.log' -Encoding UTF8 -Tail 10" 2>nul
) else (
    echo  (لا يمكن التجربة - sync.py غير موجود)
)
echo.

:: ─── ملخص النتائج ─────────────────────────────────────────
echo ╔══════════════════════════════════════════════════════════╗
if %FOUND_ISSUE%==0 (
    echo ║   ✓ كل شيء يبدو صحيحاً! تحقق من sync.log بالأعلى    ║
) else (
    echo ║   ✗ وُجدت مشاكل - اقرأ الحلول المقترحة بالأعلى      ║
    echo ║   ► أهم خطوة: شغّل "إصلاح-مسار-DB.bat" لإصلاح المسار ║
)
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo  اضغط أي مفتاح للإغلاق...
pause >nul
