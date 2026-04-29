@echo off
chcp 65001 >nul 2>&1
title إصلاح مسار قاعدة بيانات Aronium - مراعي الشمال
color 0E

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║    إصلاح مسار Aronium DB - مراعي الشمال               ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo  هذا الأداة تبحث عن pos.db تلقائياً وتُصلح المسار
echo.

set SYNC_DIR=C:\AroniumSync
set FOUND_PATH=

:: ─── البحث التلقائي عن pos.db ────────────────────────────
echo ══════════════════════════════════════════
echo  البحث عن pos.db...
echo ══════════════════════════════════════════
echo.

:: فحص AppData لجميع المستخدمين
set COUNT=0
echo  الأماكن المحتملة:
echo.

for /d %%u in (C:\Users\*) do (
    if exist "%%u\AppData\Local\Aronium\Data\pos.db" (
        set /a COUNT+=1
        echo  [!COUNT!] %%u\AppData\Local\Aronium\Data\pos.db
        if !COUNT!==1 set FOUND_PATH=%%u\AppData\Local\Aronium\Data\pos.db
    )
)

if exist "C:\Aronium\Data\pos.db" (
    set /a COUNT+=1
    echo  [!COUNT!] C:\Aronium\Data\pos.db
    if !COUNT!==1 set FOUND_PATH=C:\Aronium\Data\pos.db
)
if exist "C:\POS\Data\pos.db" (
    set /a COUNT+=1
    echo  [!COUNT!] C:\POS\Data\pos.db
    if !COUNT!==1 set FOUND_PATH=C:\POS\Data\pos.db
)
if exist "D:\Aronium\Data\pos.db" (
    set /a COUNT+=1
    echo  [!COUNT!] D:\Aronium\Data\pos.db
    if !COUNT!==1 set FOUND_PATH=D:\Aronium\Data\pos.db
)
if exist "E:\Aronium\Data\pos.db" (
    set /a COUNT+=1
    echo  [!COUNT!] E:\Aronium\Data\pos.db
    if !COUNT!==1 set FOUND_PATH=E:\Aronium\Data\pos.db
)

:: بحث أعمق
for /f "delims=" %%f in ('dir /s /b "C:\pos.db" 2^>nul') do (
    set /a COUNT+=1
    echo  [!COUNT!] %%f
    if !COUNT!==1 set FOUND_PATH=%%f
)

if %COUNT%==0 (
    echo  ✗ لم يُعثر على pos.db في أي مكان!
    echo.
    echo  تأكد من:
    echo  1. أن برنامج Aronium مثبت ومفتوح على هذا الجهاز
    echo  2. أنك تشغّل هذا الملف كمسؤول (Admin)
    echo.
    echo  أدخل المسار يدوياً:
    set /p MANUAL_PATH=  المسار: 
    if not "!MANUAL_PATH!"=="" (
        if exist "!MANUAL_PATH!" (
            set FOUND_PATH=!MANUAL_PATH!
            echo  ✓ الملف موجود
        ) else (
            echo  ✗ الملف غير موجود في المسار المدخل
            goto :EOF_ERR
        )
    ) else (
        goto :EOF_ERR
    )
)

echo.
if %COUNT%==1 (
    echo  ✓ وُجد مسار واحد: %FOUND_PATH%
    echo  سيتم استخدامه تلقائياً
) else (
    echo  وُجد أكثر من مسار. اختر الرقم المناسب ^(الأرجح رقم 1^):
    set /p CHOICE=  اختيارك ^(1-%COUNT%^): 
    :: إعادة البحث للرقم المختار
    set COUNTER=0
    for /d %%u in (C:\Users\*) do (
        if exist "%%u\AppData\Local\Aronium\Data\pos.db" (
            set /a COUNTER+=1
            if !COUNTER!==!CHOICE! set FOUND_PATH=%%u\AppData\Local\Aronium\Data\pos.db
        )
    )
)

echo.
echo ══════════════════════════════════════════
echo  تحديث config.json بالمسار الصحيح
echo ══════════════════════════════════════════

if not exist "%SYNC_DIR%\config.json" (
    echo  ✗ config.json غير موجود في %SYNC_DIR%
    echo    شغّل التثبيت أولاً
    goto :EOF_ERR
)

:: قراءة config.json الحالي وتحديث المسار عبر PowerShell
echo  المسار الجديد: %FOUND_PATH%
echo.

powershell -NoProfile -Command ^
    "$cfg = Get-Content '%SYNC_DIR%\config.json' -Raw -Encoding UTF8 | ConvertFrom-Json; ^
     $cfg.aronium_db_path = '%FOUND_PATH%'; ^
     $cfg | ConvertTo-Json -Depth 5 | Set-Content '%SYNC_DIR%\config.json' -Encoding UTF8; ^
     Write-Host '  تم تحديث config.json بنجاح'"

echo.
echo  المحتوى الجديد لـ config.json:
type "%SYNC_DIR%\config.json"
echo.

:: ─── تشغيل مزامنة تجريبية ────────────────────────────────
echo ══════════════════════════════════════════
echo  تجربة المزامنة بعد الإصلاح
echo ══════════════════════════════════════════
echo  جاري التنفيذ...
echo.
cd /d "%SYNC_DIR%"
python sync.py --once
echo.

echo  آخر سطور من sync.log:
powershell -command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content '%SYNC_DIR%\sync.log' -Encoding UTF8 -Tail 10"

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║   ✓ اكتمل الإصلاح - تحقق من النتيجة بالأعلى           ║
echo ║   إذا نجح: سترى "اكتملت المزامنة" في sync.log          ║
echo ║   إذا فشل: شغّل "تشخيص-وإصلاح-شامل.bat"              ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
pause
exit /b 0

:EOF_ERR
echo.
echo  ✗ لم يتم الإصلاح
pause
exit /b 1
