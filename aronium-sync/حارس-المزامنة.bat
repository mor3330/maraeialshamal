@echo off
chcp 65001 >nul 2>&1
::
:: حارس-المزامنة.bat
:: يشتغل كل 5 دقائق تلقائياً (عبر Task Scheduler)
:: يتحقق هل السكريبت يعمل → إن لا، يُعيد تشغيله
::

set INSTALL_DIR=C:\AroniumSync
set PID_FILE=%INSTALL_DIR%\sync.pid
set VBS_FILE=%INSTALL_DIR%\run_silent.vbs

:: ── إذا ملف PID غير موجود → السكريبت متوقف، شغّله ──────
if not exist "%PID_FILE%" goto :start_sync

:: ── اقرأ الـ PID من الملف ──────────────────────────────
set /p STORED_PID=<"%PID_FILE%"

:: ── تحقق هل هذا الـ PID لا يزال يعمل ──────────────────
tasklist /FI "PID eq %STORED_PID%" /FI "IMAGENAME eq python*" 2>nul | findstr /I "python" >nul
if %errorlevel% EQU 0 (
    :: السكريبت يعمل بشكل طبيعي
    exit /b 0
)

:: ── الـ PID غير موجود = السكريبت وقف، احذف الملف وأعد التشغيل ──
del "%PID_FILE%" 2>nul

:start_sync
:: ── تشغيل السكريبت بشكل خفي ─────────────────────────────
if exist "%VBS_FILE%" (
    wscript.exe "%VBS_FILE%"
) else (
    cd /d "%INSTALL_DIR%"
    start /MIN "" python sync.py
)
exit /b 0
