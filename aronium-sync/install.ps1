# ═══════════════════════════════════════════════════════════════
# install.ps1 - تثبيت نظام مزامنة Aronium مع Supabase
# مراعي الشمال - يُثبَّت مرة واحدة ثم يعمل تلقائياً إلى الأبد
# ═══════════════════════════════════════════════════════════════

param(
    [string]$BranchId      = "",
    [string]$SupabaseUrl   = "",
    [string]$SupabaseKey   = "",
    [string]$AroniumDbPath = "",
    [string]$BranchName    = "",
    [string]$ServerUrl     = ""
)

$INSTALL_DIR = "C:\AroniumSync"
$TASK_NAME   = "AroniumSync-MaraeiAlShimal"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  تثبيت نظام مزامنة مراعي الشمال" -ForegroundColor Cyan
Write-Host "  يعمل تلقائياً دائماً - لا تدخل يدوي بعد اليوم" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── التحقق من صلاحيات Administrator ──────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  يجب تشغيل هذا السكريبت كـ Administrator" -ForegroundColor Red
    Write-Host "   انقر يمين على PowerShell → Run as Administrator" -ForegroundColor Yellow
    Pause
    exit 1
}

# ── التحقق من Python ──────────────────────────────────────
$pythonPath = ""
foreach ($candidate in @("python", "python3", "py")) {
    try {
        $ver = & $candidate --version 2>&1
        if ($ver -match "Python") {
            $pythonPath = (Get-Command $candidate -ErrorAction SilentlyContinue).Source
            if (-not $pythonPath) { $pythonPath = $candidate }
            Write-Host "✅ Python موجود: $ver" -ForegroundColor Green
            break
        }
    } catch {}
}
if (-not $pythonPath) {
    Write-Host "❌ Python غير مثبت!" -ForegroundColor Red
    Write-Host "   حمّله من: https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "   تأكد من وضع علامة صح على 'Add Python to PATH'" -ForegroundColor Yellow
    Pause
    exit 1
}

# ── جمع البيانات إذا لم تُعطَ ────────────────────────────
if (-not $BranchId) {
    Write-Host ""
    Write-Host "─── بيانات الفرع ───────────────────────────────────" -ForegroundColor Yellow
    $BranchId = Read-Host "  branch_id (UUID الفرع من Supabase)"
}
if (-not $SupabaseUrl) {
    $SupabaseUrl = Read-Host "  supabase_url (مثال: https://XXXX.supabase.co)"
}
if (-not $SupabaseKey) {
    $SupabaseKey = Read-Host "  supabase_key (anon أو service_role key)"
}
if (-not $AroniumDbPath) {
    $default = "$env:LOCALAPPDATA\Aronium\Data\pos.db"
    $input   = Read-Host "  مسار Aronium DB (Enter للافتراضي: $default)"
    $AroniumDbPath = if ($input) { $input } else { $default }
}
if (-not $BranchName) {
    $BranchName = Read-Host "  اسم الفرع (مثال: مراعي الشمال 3)"
}
if (-not $ServerUrl) {
    $ServerUrl = Read-Host "  رابط السيرفر للتحديثات التلقائية (مثال: https://yourapp.vercel.app)"
}

Write-Host ""
Write-Host "─── إنشاء المجلد وإعداد الملفات ────────────────────" -ForegroundColor Yellow

# ── إنشاء مجلد التثبيت ───────────────────────────────────
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null

# ── نسخ sync.py من المجلد الحالي ──────────────────────────
$scriptSource = Join-Path $PSScriptRoot "sync.py"
if (Test-Path $scriptSource) {
    Copy-Item $scriptSource "$INSTALL_DIR\sync.py" -Force
    Write-Host "✅ تم نسخ sync.py" -ForegroundColor Green
} else {
    Write-Host "⚠️  sync.py غير موجود في نفس مجلد install.ps1" -ForegroundColor Yellow
}

# ── كتابة config.json ─────────────────────────────────────
$config = @{
    branch_id      = $BranchId.Trim()
    supabase_url   = $SupabaseUrl.Trim()
    supabase_key   = $SupabaseKey.Trim()
    aronium_db_path = $AroniumDbPath.Trim()
    branch_name    = $BranchName.Trim()
    server_url     = $ServerUrl.Trim()
} | ConvertTo-Json -Depth 3

Set-Content -Path "$INSTALL_DIR\config.json" -Value $config -Encoding UTF8
Write-Host "✅ تم إنشاء config.json" -ForegroundColor Green

# ── كتابة run_silent.vbs (يشغّل daemon بشكل خفي) ──────────
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\AroniumSync"
WshShell.Run "python sync.py", 0, False
"@
Set-Content -Path "$INSTALL_DIR\run_silent.vbs" -Value $vbsContent -Encoding UTF8
Write-Host "✅ تم إنشاء run_silent.vbs" -ForegroundColor Green

# ── إزالة المهمة القديمة إن وجدت ─────────────────────────
Write-Host ""
Write-Host "─── إعداد Task Scheduler ────────────────────────────" -ForegroundColor Yellow
schtasks /Delete /TN $TASK_NAME /F 2>&1 | Out-Null

# ── إنشاء مهمة جدولة تبدأ عند تشغيل الجهاز ──────────────
# المهمة:
#   - تبدأ عند تشغيل Windows (AtStartup)
#   - تعيد التشغيل تلقائياً إذا توقفت (كل دقيقة، 10 مرات)
#   - لا تتوقف عند الخمول
#   - تعمل بدون تسجيل دخول المستخدم (SYSTEM account)

$action  = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$INSTALL_DIR\run_silent.vbs`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances    IgnoreNew `
    -RunOnlyIfNetworkAvailable:$false `
    -DisallowStartIfOnBatteries:$false `
    -StopIfGoingOnBatteries:$false `
    -StartWhenAvailable `
    -ExecutionTimeLimit   (New-TimeSpan -Hours 0) `
    -RestartCount         10 `
    -RestartInterval      (New-TimeSpan -Minutes 1)

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest

$task = New-ScheduledTask `
    -Action    $action `
    -Trigger   $trigger `
    -Settings  $settings `
    -Principal $principal `
    -Description "مزامنة مراعي الشمال - يعمل تلقائياً عند بدء الجهاز"

Register-ScheduledTask -TaskName $TASK_NAME -InputObject $task -Force | Out-Null
Write-Host "✅ تم تسجيل المهمة: $TASK_NAME" -ForegroundColor Green
Write-Host "   • تبدأ تلقائياً عند تشغيل Windows" -ForegroundColor Gray
Write-Host "   • تعيد التشغيل تلقائياً إذا توقفت (10 محاولات)" -ForegroundColor Gray

# ── تشغيل فوري الآن (بدون انتظار إعادة تشغيل Windows) ────
Write-Host ""
Write-Host "─── تشغيل السكريبت الآن ────────────────────────────" -ForegroundColor Yellow

# إيقاف أي نسخة قديمة
taskkill /F /IM python.exe 2>&1 | Out-Null

# تشغيل المهمة فوراً
Start-ScheduledTask -TaskName $TASK_NAME 2>&1 | Out-Null
Start-Sleep -Seconds 3

Write-Host "✅ تم تشغيل المهمة!" -ForegroundColor Green

# ── التحقق من النجاح ──────────────────────────────────────
Write-Host ""
Write-Host "─── التحقق ──────────────────────────────────────────" -ForegroundColor Yellow
Start-Sleep -Seconds 5

$pythonProcs = Get-Process python -ErrorAction SilentlyContinue
if ($pythonProcs) {
    Write-Host "✅ Python يعمل في الخلفية (PID: $($pythonProcs[0].Id))" -ForegroundColor Green
} else {
    Write-Host "⚠️  Python لم يبدأ بعد - قد يحتاج لحظة" -ForegroundColor Yellow
}

# عرض آخر سطور من السجل
if (Test-Path "$INSTALL_DIR\sync.log") {
    Write-Host ""
    Write-Host "─── آخر سطور sync.log ───────────────────────────────" -ForegroundColor Yellow
    Get-Content "$INSTALL_DIR\sync.log" -Tail 5
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ اكتمل التثبيت بنجاح!" -ForegroundColor Green
Write-Host ""
Write-Host "  السكريبت يعمل الآن في الخلفية ويزامن كل 5 دقائق" -ForegroundColor White
Write-Host "  يفحص الطلبات الفورية كل 30 ثانية" -ForegroundColor White
Write-Host "  يتحدث تلقائياً من الداشبورد كل ساعتين" -ForegroundColor White
Write-Host "  يبدأ تلقائياً عند كل تشغيل لـ Windows" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Pause
