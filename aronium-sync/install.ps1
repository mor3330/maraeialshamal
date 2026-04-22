# ═══════════════════════════════════════════════════════════
# install.ps1 - تثبيت نظام مزامنة Aronium POS
# مراعي الشمال - شغّل هذا كـ Administrator
# ═══════════════════════════════════════════════════════════
# الاستخدام:
#   powershell -ExecutionPolicy Bypass -File install.ps1
# ═══════════════════════════════════════════════════════════

param(
    [string]$BranchId    = "",
    [string]$BranchName  = "",
    [string]$SupabaseUrl = "",
    [string]$SupabaseKey = ""
)

$INSTALL_DIR = "C:\AroniumSync"
$TASK_NAME   = "AroniumSync-MaraeiAlShimal"

Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  تثبيت نظام مزامنة Aronium POS" -ForegroundColor Cyan
Write-Host "  مراعي الشمال" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ─── 1. التحقق من صلاحية Admin ──────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ يجب تشغيل هذا السكربت كـ Administrator!" -ForegroundColor Red
    Write-Host "   انقر بالزر الأيمن على PowerShell ← Run as Administrator" -ForegroundColor Yellow
    exit 1
}

# ─── 2. التحقق من بيانات الفرع ──────────────────────────
if (-not $BranchId) {
    $BranchId = Read-Host "أدخل branch_id للفرع (UUID من Supabase)"
}
if (-not $BranchName) {
    $BranchName = Read-Host "أدخل اسم الفرع (مثال: فرع العليا)"
}
if (-not $SupabaseUrl) {
    $SupabaseUrl = Read-Host "أدخل Supabase URL (مثال: https://abc.supabase.co)"
}
if (-not $SupabaseKey) {
    $SupabaseKey = Read-Host "أدخل Supabase service_role key"
}

# ─── 3. إيجاد مسار قاعدة بيانات Aronium ────────────────
Write-Host ""
Write-Host "🔍 البحث عن قاعدة بيانات Aronium..." -ForegroundColor Yellow

$possiblePaths = @(
    "$env:LOCALAPPDATA\Aronium\Data\pos.db",
    "C:\Aronium\Data\pos.db",
    "C:\Program Files\Aronium\Data\pos.db",
    "C:\Program Files (x86)\Aronium\Data\pos.db"
)

$aroniumDb = ""
foreach ($p in $possiblePaths) {
    if (Test-Path $p) {
        $aroniumDb = $p
        Write-Host "✓ وجدت قاعدة البيانات: $p" -ForegroundColor Green
        break
    }
}

if (-not $aroniumDb) {
    Write-Host "⚠ لم يتم إيجاد قاعدة البيانات تلقائياً" -ForegroundColor Yellow
    $aroniumDb = Read-Host "أدخل المسار يدوياً (مثال: C:\Users\user\AppData\Local\Aronium\Data\pos.db)"
}

# ─── 4. إنشاء مجلد التثبيت ──────────────────────────────
Write-Host ""
Write-Host "📁 إنشاء مجلد التثبيت: $INSTALL_DIR" -ForegroundColor Yellow

if (-not (Test-Path $INSTALL_DIR)) {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
}

# ─── 5. نسخ الملفات ─────────────────────────────────────
Write-Host "📋 نسخ الملفات..." -ForegroundColor Yellow

$sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Copy-Item "$sourceDir\sync.py"       "$INSTALL_DIR\sync.py"       -Force
Copy-Item "$sourceDir\run_silent.vbs" "$INSTALL_DIR\run_silent.vbs" -Force

# ─── 6. كتابة config.json ────────────────────────────────
Write-Host "⚙  كتابة config.json..." -ForegroundColor Yellow

$config = @{
    branch_id       = $BranchId
    supabase_url    = $SupabaseUrl
    supabase_key    = $SupabaseKey
    aronium_db_path = $aroniumDb
    branch_name     = $BranchName
}
$config | ConvertTo-Json -Depth 2 | Set-Content "$INSTALL_DIR\config.json" -Encoding UTF8

# ─── 7. التحقق من Python ────────────────────────────────
Write-Host "🐍 التحقق من Python..." -ForegroundColor Yellow

$pythonOk = $false
try {
    $ver = python --version 2>&1
    if ($ver -like "Python 3*") {
        Write-Host "✓ Python موجود: $ver" -ForegroundColor Green
        $pythonOk = $true
    }
} catch {}

if (-not $pythonOk) {
    Write-Host "⬇  تحميل Python 3.11..." -ForegroundColor Yellow
    $pyInstaller = "$env:TEMP\python-3.11.9.exe"
    $pyUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
    
    try {
        Invoke-WebRequest -Uri $pyUrl -OutFile $pyInstaller -UseBasicParsing
        Write-Host "✓ تم التحميل. جاري التثبيت..." -ForegroundColor Green
        Start-Process -FilePath $pyInstaller -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_pip=1" -Wait
        Write-Host "✓ تم تثبيت Python" -ForegroundColor Green
    } catch {
        Write-Host "❌ فشل تحميل Python. ثبّته يدوياً من python.org" -ForegroundColor Red
    }
}

# ─── 8. تسجيل Task Scheduler ────────────────────────────
Write-Host ""
Write-Host "⏰ تسجيل Task Scheduler..." -ForegroundColor Yellow

# احذف المهمة القديمة إن وجدت
Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue

$action  = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$INSTALL_DIR\run_silent.vbs`""
$trigger = New-ScheduledTaskTrigger -Daily -At "00:00AM"

# تكرار كل 5 دقائق لمدة يوم كامل
$trigger.Repetition = New-Object System.Xml.XmlDocument
$xmlDoc = New-Object System.Xml.XmlDocument

# نستخدم schtasks لضبط التكرار بدقة
$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -RunOnlyIfNetworkAvailable:$false `
    -DisallowStartIfOnBatteries:$false `
    -StopIfGoingOnBatteries:$false `
    -StartWhenAvailable

$principal = New-ScheduledTaskPrincipal -RunLevel Highest -LogonType S4U -UserId "SYSTEM"

Register-ScheduledTask `
    -TaskName    $TASK_NAME `
    -Action      $action `
    -Trigger     $trigger `
    -Settings    $settings `
    -Principal   $principal `
    -Description "مزامنة مبيعات Aronium POS لمراعي الشمال - $BranchName" `
    -Force | Out-Null

# ضبط التكرار كل 5 دقائق عبر schtasks.exe (أكثر موثوقية)
schtasks /Change /TN "$TASK_NAME" /RI 5 /DU 9999:59 2>&1 | Out-Null

Write-Host "✓ تم تسجيل المهمة: $TASK_NAME" -ForegroundColor Green

# ─── 9. اختبار أول مزامنة ───────────────────────────────
Write-Host ""
Write-Host "🧪 تشغيل اختبار المزامنة الأول..." -ForegroundColor Yellow
Write-Host "   (قد يستغرق 10-30 ثانية)" -ForegroundColor Gray

try {
    $proc = Start-Process -FilePath "python" `
        -ArgumentList "`"$INSTALL_DIR\sync.py`"" `
        -WorkingDirectory $INSTALL_DIR `
        -Wait -PassThru -NoNewWindow
    
    if ($proc.ExitCode -eq 0) {
        Write-Host "✓ نجح الاختبار!" -ForegroundColor Green
    } else {
        Write-Host "⚠ انتهى بكود $($proc.ExitCode) - تحقق من sync.log" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ تعذّر تشغيل الاختبار: $_" -ForegroundColor Yellow
}

# ─── 10. عرض ملف السجل ──────────────────────────────────
if (Test-Path "$INSTALL_DIR\sync.log") {
    Write-Host ""
    Write-Host "📄 آخر سطور في sync.log:" -ForegroundColor Cyan
    Get-Content "$INSTALL_DIR\sync.log" -Tail 10 | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Gray
    }
}

# ─── انتهى ──────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ اكتمل التثبيت بنجاح!" -ForegroundColor Green
Write-Host ""
Write-Host "  الفرع:    $BranchName" -ForegroundColor White
Write-Host "  المجلد:   $INSTALL_DIR" -ForegroundColor White
Write-Host "  التكرار:  كل 5 دقائق (24/7)" -ForegroundColor White
Write-Host "  السجل:    $INSTALL_DIR\sync.log" -ForegroundColor White
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "لتشغيل يدوي: python `"$INSTALL_DIR\sync.py`"" -ForegroundColor Gray
Write-Host "لمشاهدة السجل: notepad `"$INSTALL_DIR\sync.log`"" -ForegroundColor Gray
