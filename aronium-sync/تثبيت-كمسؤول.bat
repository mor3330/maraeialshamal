@echo off
chcp 65001 >nul 2>&1
title تثبيت نظام المزامنة - مراعي الشمال

:: ─── رفع الصلاحيات تلقائياً ────────────────────────────
net session >nul 2>&1
if %errorlevel% NEQ 0 (
    echo جاري رفع الصلاحيات... اضغط نعم في النافذة المنبثقة
    powershell -Command "Start-Process -FilePath cmd.exe -ArgumentList '/c \"%~f0\"' -Verb RunAs -WorkingDirectory '%~dp0'"
    exit /b
)

set INSTALL_DIR=C:\AroniumSync
set TASK_NAME=AroniumSync-MaraeiAlShimal
set WATCHDOG_TASK=AroniumWatchdog-MaraeiAlShimal
set SOURCE_DIR=%~dp0

echo.
echo ═══════════════════════════════════════════════════════
echo   تثبيت نظام مزامنة مراعي الشمال (نسخة محسّنة)
echo ═══════════════════════════════════════════════════════
echo.

:: ─── طلب بيانات الفرع ───────────────────────────────────
echo ─── بيانات الفرع ─────────────────────────────────────
echo.
set /p BRANCH_ID=  branch_id (UUID الفرع من Supabase): 
set /p BRANCH_NAME=  اسم الفرع (مثال: فرع الرياض): 
echo.

:: التحقق من الإدخال
if "%BRANCH_ID%"=="" (
    echo   خطأ: لم تدخل branch_id
    pause
    exit /b 1
)
if "%BRANCH_NAME%"=="" (
    echo   خطأ: لم تدخل اسم الفرع
    pause
    exit /b 1
)

echo   تم: الفرع = %BRANCH_NAME%
echo   تم: UUID  = %BRANCH_ID%
echo.

:: ─── [1] إنشاء مجلد التثبيت ────────────────────────────
echo [1] إنشاء مجلد %INSTALL_DIR%...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
echo     OK

:: ─── [2] نسخ sync.py ────────────────────────────────────
echo [2] نسخ sync.py...
if exist "%SOURCE_DIR%sync.py" (
    copy /Y "%SOURCE_DIR%sync.py" "%INSTALL_DIR%\sync.py" >nul
    echo     OK: تم نسخ sync.py
) else (
    echo     خطأ: sync.py غير موجود في %SOURCE_DIR%
    pause
    exit /b 1
)

:: ─── [2b] نسخ حارس-المزامنة.bat ─────────────────────────
echo [2b] نسخ حارس-المزامنة.bat...
if exist "%SOURCE_DIR%حارس-المزامنة.bat" (
    copy /Y "%SOURCE_DIR%حارس-المزامنة.bat" "%INSTALL_DIR%\حارس-المزامنة.bat" >nul
    echo     OK: تم نسخ الحارس
) else (
    echo     تحذير: حارس-المزامنة.bat غير موجود
)

:: ─── [3] كتابة config.json بـ Python ────────────────────
echo [3] كتابة config.json...
python -c "import json,os; p=os.path.join(os.environ.get('LOCALAPPDATA','C:/Users/Public/AppData/Local'),'Aronium','Data','pos.db'); cfg={'branch_id':'%BRANCH_ID%','branch_name':'%BRANCH_NAME%','aronium_db_path':p,'supabase_url':'https://yanbsscyclnmvlculxci.supabase.co','supabase_key':'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhbmJzc2N5Y2xubXZsY3VseGNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEzODYxNiwiZXhwIjoyMDkxNzE0NjE2fQ.89xtA8-OT04r9QEhArvhtpK8I3pOPp4apfY2FhYLYHs','server_url':'https://marei-alshamal.vercel.app'}; f=open(r'%INSTALL_DIR%/config.json','w',encoding='utf-8'); f.write(json.dumps(cfg,ensure_ascii=False,indent=2)); f.close(); print('    OK: db path =',p)"
if %errorlevel% NEQ 0 (
    echo     خطأ في كتابة config.json
    pause
    exit /b 1
)

:: ─── [4] كتابة run_silent.vbs ───────────────────────────
echo [4] كتابة run_silent.vbs...
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.CurrentDirectory = "C:\AroniumSync"
echo WshShell.Run "python sync.py", 0, False
) > "%INSTALL_DIR%\run_silent.vbs"
echo     OK

:: ─── [5] إعداد مهمة السكريبت الرئيسية (عند الدخول) ─────
echo [5] إعداد مهمة السكريبت الرئيسي (ONLOGON)...
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>&1

for /f "tokens=*" %%u in ('whoami') do set CURRENT_USER=%%u

schtasks /Create /TN "%TASK_NAME%" ^
  /TR "wscript.exe \"%INSTALL_DIR%\run_silent.vbs\"" ^
  /SC ONLOGON /RU "%CURRENT_USER%" /RL HIGHEST /F >nul 2>&1

if %errorlevel% EQU 0 (
    echo     OK: مهمة البدء عند الدخول - تم تسجيلها
) else (
    schtasks /Create /TN "%TASK_NAME%" ^
      /TR "wscript.exe \"%INSTALL_DIR%\run_silent.vbs\"" ^
      /SC ONLOGON /RU "%CURRENT_USER%" /F >nul 2>&1
    if %errorlevel% EQU 0 (
        echo     OK: تم تسجيل المهمة
    ) else (
        echo     تحذير: فشل Task Scheduler
    )
)

:: ─── [6] إعداد مهمة الحارس (كل 5 دقائق) ────────────────
echo [6] إعداد مهمة الحارس (كل 5 دقائق - يُعيد تشغيل السكريبت إن توقف)...
schtasks /Delete /TN "%WATCHDOG_TASK%" /F >nul 2>&1

schtasks /Create /TN "%WATCHDOG_TASK%" ^
  /TR "cmd.exe /c \"%INSTALL_DIR%\حارس-المزامنة.bat\"" ^
  /SC MINUTE /MO 5 ^
  /RU "%CURRENT_USER%" /RL HIGHEST ^
  /F >nul 2>&1

if %errorlevel% EQU 0 (
    echo     OK: مهمة الحارس تعمل كل 5 دقائق
) else (
    echo     تحذير: فشل تسجيل مهمة الحارس - حاول يدوياً
)

:: ─── [7] تشغيل مزامنة فورية ─────────────────────────────
echo [7] تشغيل مزامنة فورية الآن...
cd /d "%INSTALL_DIR%"
python sync.py --trigger
if %errorlevel% EQU 0 (
    echo     OK: المزامنة نجحت
) else (
    echo     تحذير: انتهت المزامنة بخطأ - تحقق من البيانات
)

echo.
echo ═══════════════════════════════════════════════════════
echo   تم التثبيت بنجاح!
echo   الفرع: %BRANCH_NAME%
echo.
echo   مهمتان مُسجَّلتان:
echo   1) السكريبت الرئيسي - يبدأ مع كل تسجيل دخول
echo   2) الحارس - يتحقق كل 5 دقائق ويُعيد التشغيل تلقائياً
echo.
echo   الآن لا تحتاج لزيارة الجهاز إذا توقف السكريبت!
echo ═══════════════════════════════════════════════════════
echo.
pause
