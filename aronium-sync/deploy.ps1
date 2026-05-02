# ═══════════════════════════════════════════════════════════
# نشر sync.py الجديد لجميع الكاشيرات تلقائياً عبر Supabase
# شغّل نشر-تحديث-للكواشير.bat (مو هذا الملف مباشرة)
# ═══════════════════════════════════════════════════════════

# يمسك أي خطأ غير متوقع ويوقف الإغلاق
trap {
    Write-Host ""
    Write-Host "════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  خطأ غير متوقع:" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  السطر: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Yellow
    Write-Host "════════════════════════════════════════" -ForegroundColor Red
    Write-Host ""
    Write-Host "اضغط Enter للإغلاق..."
    Read-Host
    exit 1
}

$ErrorActionPreference = "Stop"

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$SyncPy     = Join-Path $ScriptDir "sync.py"
$ConfigJson = Join-Path $ScriptDir "config.json"

# ─── تحقق من الملفات ─────────────────────────────────────
Write-Host ""
Write-Host "فحص الملفات..." -ForegroundColor Gray

if (-not (Test-Path $SyncPy)) {
    Write-Host "❌ الملف مو موجود: $SyncPy" -ForegroundColor Red
    Write-Host "اضغط Enter للإغلاق..."; Read-Host; exit 1
}
if (-not (Test-Path $ConfigJson)) {
    Write-Host "❌ الملف مو موجود: $ConfigJson" -ForegroundColor Red
    Write-Host "اضغط Enter للإغلاق..."; Read-Host; exit 1
}

# ─── قراءة الإعدادات ─────────────────────────────────────
$cfgRaw  = Get-Content $ConfigJson -Encoding UTF8 -Raw
$cfg     = $cfgRaw | ConvertFrom-Json
$SupaUrl = $cfg.supabase_url.TrimEnd("/")
$SupaKey = $cfg.supabase_key

if (-not $SupaUrl -or -not $SupaKey) {
    Write-Host "❌ supabase_url أو supabase_key فارغ في config.json" -ForegroundColor Red
    Write-Host "اضغط Enter للإغلاق..."; Read-Host; exit 1
}

# ─── قراءة الإصدار من sync.py ────────────────────────────
$content  = Get-Content $SyncPy -Encoding UTF8 -Raw
$verMatch = [regex]::Match($content, 'AGENT_VERSION\s*=\s*"([^"]+)"')
if (-not $verMatch.Success) {
    Write-Host "❌ ما لقيت AGENT_VERSION في sync.py" -ForegroundColor Red
    Write-Host "اضغط Enter للإغلاق..."; Read-Host; exit 1
}
$NewVersion = $verMatch.Groups[1].Value

# ─── عرض المعلومات ───────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  نشر تحديث sync.py للكاشيرات" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  الملف    : $SyncPy" -ForegroundColor White
Write-Host "  الإصدار  : v$NewVersion" -ForegroundColor Green
Write-Host "  Supabase : $SupaUrl" -ForegroundColor White
Write-Host "  حجم الملف: $([math]::Round($content.Length/1024,1)) KB" -ForegroundColor White
Write-Host ""

# ─── تأكيد ────────────────────────────────────────────────
$confirm = Read-Host "هل تريد رفع v$NewVersion للكاشيرات؟ (y/n)"
if ($confirm -notin @("y","Y","yes","نعم")) {
    Write-Host "إلغاء." -ForegroundColor Yellow
    Write-Host "اضغط Enter للإغلاق..."; Read-Host; exit 0
}

# ─── تجهيز البيانات ──────────────────────────────────────
Write-Host ""
Write-Host "⬆️  جاري الرفع إلى Supabase..." -ForegroundColor Yellow

# بناء JSON يدوياً لضمان encoding صحيح للعربي
$escapedContent = $content -replace '\\', '\\\\' -replace '"', '\"' -replace "`r`n", '\n' -replace "`n", '\n' -replace "`t", '\t'
$now = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
$bodyJson = '{"id":"main","version":"' + $NewVersion + '","script_content":"' + $escapedContent + '","updated_at":"' + $now + '"}'

$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyJson)

$headers = @{
    "apikey"        = $SupaKey
    "Authorization" = "Bearer $SupaKey"
    "Content-Type"  = "application/json; charset=utf-8"
    "Prefer"        = "return=minimal,resolution=merge-duplicates"
}

# ─── الرفع ───────────────────────────────────────────────
$ErrorActionPreference = "Continue"
try {
    $response = Invoke-WebRequest `
        -Uri "$SupaUrl/rest/v1/sync_agent?on_conflict=id" `
        -Method POST `
        -Headers $headers `
        -Body $bodyBytes `
        -UseBasicParsing

    Write-Host ""
    if ($response.StatusCode -in 200,201,204) {
        Write-Host "✅ تم الرفع بنجاح!" -ForegroundColor Green
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
        Write-Host "  v$NewVersion موجودة الآن في Supabase" -ForegroundColor Green
        Write-Host "  الكاشيرات تحمّل التحديث خلال 10 دقائق" -ForegroundColor White
        Write-Host "  أو شغّل طلب force_update من لوحة التحكم" -ForegroundColor White
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    } else {
        Write-Host "⚠️  استجابة غير متوقعة: HTTP $($response.StatusCode)" -ForegroundColor Yellow
        Write-Host $response.Content -ForegroundColor Yellow
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host ""
    Write-Host "════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  ❌ فشل الرفع - HTTP $statusCode" -ForegroundColor Red
    Write-Host "────────────────────────────────────────" -ForegroundColor Red

    # قراءة تفاصيل الخطأ من Supabase
    if ($_.Exception.Response) {
        try {
            $errStream = $_.Exception.Response.GetResponseStream()
            $reader    = New-Object System.IO.StreamReader($errStream)
            $errBody   = $reader.ReadToEnd()
            Write-Host "  تفاصيل: $errBody" -ForegroundColor Red
        } catch {}
    }
    Write-Host "  الخطأ: $($_.Exception.Message)" -ForegroundColor Red

    # تشخيص الأخطاء الشائعة
    Write-Host ""
    Write-Host "  تشخيص محتمل:" -ForegroundColor Yellow
    if ($statusCode -eq 401 -or $statusCode -eq 403) {
        Write-Host "  → supabase_key خاطئ أو منتهي الصلاحية" -ForegroundColor Yellow
    } elseif ($statusCode -eq 404) {
        Write-Host "  → جدول sync_agent غير موجود، شغّل migration 21" -ForegroundColor Yellow
    } elseif ($statusCode -eq 0) {
        Write-Host "  → لا يوجد إنترنت أو supabase_url خاطئ" -ForegroundColor Yellow
    }
    Write-Host "════════════════════════════════════════" -ForegroundColor Red
}

Write-Host ""
Write-Host "اضغط Enter للإغلاق..."
Read-Host
