@echo off
chcp 65001 >nul 2>&1
title مراعي الشمال...

:: ════════════════════════════════════════════════════════════════
::  تثبيت.bat / تحديث.bat - مراعي الشمال v4
::  ملف واحد لجميع الكواشير
::
::  كيف يعمل:
::   • إذا النظام مثبّت مسبقاً → يحدّث ويصلح كل شيء تلقائياً
::   • إذا أول مرة → يطلب رمز الفرع فقط ويكمل بنفسه
:: ════════════════════════════════════════════════════════════════

set INSTALL_DIR=C:\AroniumSync
set TASK_SYNC=AroniumSync-MaraeiAlShimal
set TASK_GUARD=AroniumSync-Guard
set GITHUB_SYNC=https://raw.githubusercontent.com/mor3330/maraeialshamal/main/aronium-sync/sync.py
set SUPABASE_URL=https://yanbsscyclnmvlculxci.supabase.co
set SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhbmJzc2N5Y2xubXZsY3VseGNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEzODYxNiwiZXhwIjoyMDkxNzE0NjE2fQ.89xtA8-OT04r9QEhArvhtpK8I3pOPp4apfY2FhYLYHs
set SERVER_URL=https://marei-alshamal.vercel.app

cls
echo.
echo   ╔══════════════════════════════════════════╗
echo   ║      مراعي الشمال - تحديث وإصلاح        ║
echo   ╚══════════════════════════════════════════╝
echo.

:: ── إنشاء المجلد إذا لم يوجد ──────────────────────────
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" >nul 2>&1

:: ══════════════════════════════════════════════════════
:: اكتشاف الوضع: تحديث أم تثبيت أول مرة؟
:: ══════════════════════════════════════════════════════
if exist "%INSTALL_DIR%\config.json" (
    echo   ✅ النظام مثبّت - جاري التحديث والإصلاح...
    echo.
    goto :UPDATE_MODE
) else (
    echo   📦 تثبيت أول مرة...
    echo.
    goto :FIRST_INSTALL
)

:: ══════════════════════════════════════════════════════
:: وضع التحديث: config.json موجود
:: يحدّث sync.py + يصلح كل شيء + يعيد التشغيل
:: ══════════════════════════════════════════════════════
:UPDATE_MODE
echo   [1/4] تحديث sync.py...
curl -L --silent --max-time 30 "%GITHUB_SYNC%" -o "%INSTALL_DIR%\sync.py.new" 2>nul
if not exist "%INSTALL_DIR%\sync.py.new" (
    powershell -NoProfile -Command "try{Invoke-WebRequest -Uri '%GITHUB_SYNC%' -OutFile '%INSTALL_DIR%\sync.py.new' -UseBasicParsing}catch{}" 2>nul
)
if exist "%INSTALL_DIR%\sync.py.new" (
    for %%A in ("%INSTALL_DIR%\sync.py.new") do if %%~zA GTR 1000 (
        if exist "%INSTALL_DIR%\sync.py" copy /Y "%INSTALL_DIR%\sync.py" "%INSTALL_DIR%\sync.bak.py" >nul 2>&1
        move /Y "%INSTALL_DIR%\sync.py.new" "%INSTALL_DIR%\sync.py" >nul 2>&1
        echo   [OK] تم تحميل آخر إصدار
    ) else (
        del "%INSTALL_DIR%\sync.py.new" >nul 2>&1
        echo   [OK] الإصدار الحالي محدّث
    )
) else (
    echo   [~] الإنترنت غير متاح - سيُستخدم الإصدار الحالي
)

:: البحث عن Python
echo   [2/4] البحث عن Python...
set PYTHON_EXE=
for /f "delims=" %%i in ('where python 2^>nul') do (if not defined PYTHON_EXE set "PYTHON_EXE=%%i")
if not defined PYTHON_EXE for /f "delims=" %%i in ('where py 2^>nul') do (if not defined PYTHON_EXE set "PYTHON_EXE=%%i")
if not defined PYTHON_EXE (
    for %%d in ("%LOCALAPPDATA%\Programs\Python\Python313" "%LOCALAPPDATA%\Programs\Python\Python312" "%LOCALAPPDATA%\Programs\Python\Python311" "%LOCALAPPDATA%\Programs\Python\Python310" "%LOCALAPPDATA%\Programs\Python\Python39" "C:\Python313" "C:\Python312" "C:\Python311" "C:\Python310" "C:\Python39" "C:\Program Files\Python313" "C:\Program Files\Python312") do (
        if not defined PYTHON_EXE if exist "%%~d\python.exe" set "PYTHON_EXE=%%~d\python.exe"
    )
)
if not defined PYTHON_EXE (
    echo   [!] Python غير موجود - تواصل مع المسؤول
    timeout /t 8 /nobreak >nul & goto :cleanup_no_del
)
echo   [OK] %PYTHON_EXE%

:: إعادة ضبط التشغيل التلقائي
echo   [3/4] إعادة ضبط التشغيل التلقائي...
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

:: إعادة التشغيل
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
    echo   ║  ✅ تم التحديث والإصلاح بنجاح!          ║
    echo   ║  المزامنة تعمل الآن في الخلفية           ║
    echo   ╚══════════════════════════════════════════╝
) else (
    echo.
    echo   ╔══════════════════════════════════════════╗
    echo   ║  ✅ تم التحديث                           ║
    echo   ║  سيبدأ تلقائياً عند التشغيل القادم       ║
    echo   ╚══════════════════════════════════════════╝
)
echo.
timeout /t 4 /nobreak >nul
goto :eof

:: ══════════════════════════════════════════════════════
:: أول مرة: يكتشف كل شيء بنفسه (Aronium + branch)
:: ══════════════════════════════════════════════════════
:FIRST_INSTALL

:: البحث عن Python
echo   [1/5] البحث عن Python...
set PYTHON_EXE=
for /f "delims=" %%i in ('where python 2^>nul') do (if not defined PYTHON_EXE set "PYTHON_EXE=%%i")
if not defined PYTHON_EXE for /f "delims=" %%i in ('where py 2^>nul') do (if not defined PYTHON_EXE set "PYTHON_EXE=%%i")
if not defined PYTHON_EXE (
    for %%d in ("%LOCALAPPDATA%\Programs\Python\Python313" "%LOCALAPPDATA%\Programs\Python\Python312" "%LOCALAPPDATA%\Programs\Python\Python311" "%LOCALAPPDATA%\Programs\Python\Python310" "%LOCALAPPDATA%\Programs\Python\Python39" "C:\Python313" "C:\Python312" "C:\Python311" "C:\Python310" "C:\Python39") do (
        if not defined PYTHON_EXE if exist "%%~d\python.exe" set "PYTHON_EXE=%%~d\python.exe"
    )
)
if not defined PYTHON_EXE (
    echo   [!] Python غير موجود - تواصل مع المسؤول
    timeout /t 10 /nobreak >nul & goto :cleanup_no_del
)
echo   [OK] %PYTHON_EXE%

:: البحث عن Aronium
echo   [2/5] البحث عن برنامج الكاشير...
set ARONIUM_DB=
for /f "delims=" %%f in ('dir /s /b "%LOCALAPPDATA%\Aronium\Data\pos.db" 2^>nul') do (if not defined ARONIUM_DB set "ARONIUM_DB=%%f")
if not defined ARONIUM_DB for /f "delims=" %%f in ('dir /s /b "%APPDATA%\Aronium\Data\pos.db" 2^>nul') do (if not defined ARONIUM_DB set "ARONIUM_DB=%%f")
if not defined ARONIUM_DB for /f "delims=" %%f in ('dir /s /b "C:\Aronium\pos.db" 2^>nul') do (if not defined ARONIUM_DB set "ARONIUM_DB=%%f")
if not defined ARONIUM_DB (
    for %%d in (C D E) do (
        if not defined ARONIUM_DB for /f "delims=" %%f in ('dir /s /b "%%d:\pos.db" 2^>nul') do (if not defined ARONIUM_DB set "ARONIUM_DB=%%f")
    )
)
if not defined ARONIUM_DB (
    echo   [!] لم يُعثر على Aronium - أدخل المسار:
    set /p ARONIUM_DB=   المسار: 
)
if not exist "%ARONIUM_DB%" (
    echo   [!] الملف غير موجود. تواصل مع المسؤول.
    timeout /t 10 /nobreak >nul & goto :cleanup_no_del
)
echo   [OK] %ARONIUM_DB%

:: طلب رمز الفرع
echo.
echo   [3/5] أدخل رمز الفرع (يرسله لك المسؤول):
set /p BRANCH_ID=   رمز الفرع: 
if "%BRANCH_ID%"=="" (
    echo   [!] رمز الفرع فارغ. تواصل مع المسؤول.
    timeout /t 10 /nobreak >nul & goto :cleanup_no_del
)

:: كتابة config.json
echo   [4/5] حفظ الإعدادات...
powershell -NoProfile -Command "$cfg = [ordered]@{branch_id='%BRANCH_ID%'; branch_name='فرع جديد'; aronium_db_path='%ARONIUM_DB:\=\\%'; supabase_url='%SUPABASE_URL%'; supabase_key='%SUPABASE_KEY%'; server_url='%SERVER_URL%'}; $cfg | ConvertTo-Json | Set-Content '%INSTALL_DIR%\config.json' -Encoding UTF8" >nul 2>&1
if not exist "%INSTALL_DIR%\config.json" (
    echo   [!] فشل حفظ الإعدادات. تواصل مع المسؤول.
    timeout /t 8 /nobreak >nul & goto :cleanup_no_del
)
echo   [OK] config.json

:: تحميل sync.py
echo   [5/5] تحميل وتشغيل...
curl -L --silent --max-time 30 "%GITHUB_SYNC%" -o "%INSTALL_DIR%\sync.py.new" 2>nul
if not exist "%INSTALL_DIR%\sync.py.new" powershell -NoProfile -Command "try{Invoke-WebRequest -Uri '%GITHUB_SYNC%' -OutFile '%INSTALL_DIR%\sync.py.new' -UseBasicParsing}catch{}" 2>nul
if exist "%INSTALL_DIR%\sync.py.new" (
    for %%A in ("%INSTALL_DIR%\sync.py.new") do if %%~zA GTR 1000 (move /Y "%INSTALL_DIR%\sync.py.new" "%INSTALL_DIR%\sync.py" >nul 2>&1)
)
if not exist "%INSTALL_DIR%\sync.py" (
    echo   [!] تعذّر التحميل. تحقق من الإنترنت.
    timeout /t 8 /nobreak >nul & goto :cleanup_no_del
)

:: البدء التلقائي
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

start "" wscript.exe "%INSTALL_DIR%\run_silent.vbs"
timeout /t 4 /nobreak >nul

echo.
echo   ╔══════════════════════════════════════════╗
echo   ║  ✅ تم التثبيت بنجاح!                   ║
echo   ║  المزامنة تعمل وستبدأ تلقائياً دائماً   ║
echo   ╚══════════════════════════════════════════╝
echo.
timeout /t 5 /nobreak >nul
goto :eof

:cleanup_no_del
timeout /t 3 /nobreak >nul
