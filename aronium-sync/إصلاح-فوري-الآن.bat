@echo off
chcp 65001 >nul 2>&1
title إصلاح المزامنة - مراعي الشمال
color 0A

echo.
echo ═══════════════════════════════════════════════════
echo   إصلاح نظام المزامنة - مراعي الشمال
echo ═══════════════════════════════════════════════════
echo.
echo [1] إيقاف أي نسخة قديمة من sync.py...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM pythonw.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo     تم.

echo.
echo [2] تحديث ملف run_silent.vbs...
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.CurrentDirectory = "C:\AroniumSync"
echo WshShell.Run "python sync.py --daemon", 0, False
) > "C:\AroniumSync\run_silent.vbs"
echo     تم تحديث run_silent.vbs

echo.
echo [3] تشغيل sync.py في وضع daemon الآن...
cd /d "C:\AroniumSync"
start "" /B wscript.exe "C:\AroniumSync\run_silent.vbs"
timeout /t 3 /nobreak >nul
echo     تم تشغيل السكريبت في الخلفية.

echo.
echo [4] انتظار 5 ثوانٍ ثم فحص السجل...
timeout /t 5 /nobreak >nul

echo.
echo ═══════════════════════════════════════════════════
echo   آخر سطور من sync.log:
echo ═══════════════════════════════════════════════════
powershell -command "if (Test-Path 'C:\AroniumSync\sync.log') { Get-Content 'C:\AroniumSync\sync.log' -Tail 8 } else { Write-Host '(لا يوجد sync.log بعد)' }"

echo.
echo ═══════════════════════════════════════════════════
echo   ✅ اكتمل الإصلاح!
echo.
echo   السكريبت يعمل الآن في الخلفية بشكل مستمر.
echo   يفحص الطلبات كل 30 ثانية ويزامن كل 5 دقائق.
echo.
echo   ارجع للداشبورد وجرب "مزامنة الآن" مرة ثانية.
echo ═══════════════════════════════════════════════════
pause
