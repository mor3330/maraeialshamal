"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Period = "today" | "yesterday" | "week" | "month" | "custom";

const CAT_INFO: Record<string, { label: string; color: string; bg: string }> = {
  hashi: { label: "حاشي",   color: "text-amber",      bg: "bg-amber/10 border-amber/30"           },
  sheep: { label: "غنم",    color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/30"     },
  beef:  { label: "عجل",    color: "text-red-400",    bg: "bg-red-400/10 border-red-400/30"       },
  offal: { label: "مخلفات", color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/30" },
  other: { label: "أخرى",   color: "text-muted",      bg: "bg-card-hi border-line"                },
};

const PAY_INFO: Record<string, { label: string; color: string }> = {
  cash:     { label: "كاش",          color: "text-green"      },
  network:  { label: "شبكة",         color: "text-sky-400"    },
  transfer: { label: "تحويل بنكي",   color: "text-purple-400" },
  deferred: { label: "آجل",          color: "text-amber"      },
  mixed:    { label: "مختلط",        color: "text-teal-400"   },
};

const fmtNum = (n: number) =>
  n.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fmtTime = (s: string) => {
  try { return new Date(s).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" }); }
  catch { return s; }
};

const fmtDate = (s: string) => {
  try { return new Date(s).toLocaleDateString("ar-SA-u-nu-latn", { day: "numeric", month: "short", timeZone: "Asia/Riyadh" }); }
  catch { return s; }
};

const fmtCountdown = (secs: number) => {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const todayStr = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const payMethod = (method: string | null) => {
  if (!method) return { label: "—", color: "text-muted" };
  const m = method.toLowerCase();
  if (m.includes("cash") || m.includes("نقد") || m.includes("كاش") || m === "1") return PAY_INFO.cash;
  if (m.includes("card") || m.includes("network") || m.includes("شبكة") || m === "2") return PAY_INFO.network;
  if (m.includes("transfer") || m.includes("تحويل") || m === "3") return PAY_INFO.transfer;
  if (m.includes("deferred") || m.includes("آجل") || m === "4") return PAY_INFO.deferred;
  if (m === "mixed") return PAY_INFO.mixed;
  return { label: method, color: "text-muted" };
};

// عدد الدورات = 12 (كل 5 دقائق × 12 = ساعة كاملة)
const SYNC_CYCLES  = 12;
const SYNC_INTERVAL_SECS = 300; // 5 دقائق

export default function BranchPosDetailsPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [period, setPeriod]         = useState<Period>("today");
  const [data, setData]             = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<"summary" | "invoices">("summary");

  // ─── التاريخ المخصص (عرض) ───
  const [showCustom, setShowCustom]       = useState(false);
  const [customFrom, setCustomFrom]       = useState(todayStr());
  const [customTo, setCustomTo]           = useState(todayStr());
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string } | null>(null);

  // ─── المزامنة المخصصة (سحب من الكاشير) ───
  const [showCustomSync, setShowCustomSync] = useState(false);
  const [cSyncFrom, setCsyncFrom]           = useState(todayStr());
  const [cSyncTo, setCsyncTo]               = useState(todayStr());
  const [cSyncStatus, setCsyncStatus]       = useState<null | "sending" | "waiting" | "done" | "failed">(null);
  const [cSyncMsg, setCsyncMsg]             = useState("");
  const [cSyncTriggerId, setCsyncTriggerId] = useState<string | null>(null);
  const cSyncPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── مفتاح localStorage للاستئناف بعد تحديث الصفحة ───
  const syncStateKey = `csync_${slug}`;

  // ─── صحة السكريبت ───
  const [health, setHealth] = useState<any>(null);

  // ─── حالة المزامنة الفورية ───
  const [syncStatus, setSyncStatus]   = useState<null | "sending" | "running" | "done" | "failed">(null);
  const [syncMsg, setSyncMsg]         = useState<string>("");
  const [syncCycle, setSyncCycle]     = useState(0);
  const [countdown, setCountdown]     = useState(0);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const branchIdRef     = useRef<string>("");

  // دالة تحميل البيانات
  const load = useCallback(async (p: Period, custom?: { from: string; to: string }) => {
    setLoading(true);
    try {
      let url: string;
      if (p === "custom" && custom) {
        url = `/api/pos/branch-details?slug=${slug}&from=${custom.from}&to=${custom.to}`;
      } else {
        url = `/api/pos/branch-details?slug=${slug}&period=${p}`;
      }
      const res  = await fetch(url);
      const json = await res.json();
      setData(json);
      if (json?.branch?.id) branchIdRef.current = json.branch.id;
    } catch {}
    setLoading(false);
  }, [slug]);

  // جلب صحة السكريبت بعد تحميل بيانات الفرع
  useEffect(() => {
    const branchId = data?.branch?.id;
    if (!branchId) return;
    fetch(`/api/pos/sync-health?branchId=${branchId}`)
      .then(r => r.json())
      .then(setHealth)
      .catch(() => {});
  }, [data?.branch?.id]);

  useEffect(() => {
    if (period !== "custom") load(period);
  }, [period, load]);

  // تطبيق التاريخ المخصص (عرض فقط)
  function applyCustomDate() {
    if (!customFrom || !customTo) return;
    const applied = { from: customFrom, to: customTo };
    setAppliedCustom(applied);
    setPeriod("custom");
    setShowCustom(false);
    load("custom", applied);
  }

  // ─── إرسال طلب مزامنة مخصصة ───
  async function startCustomSync() {
    const branchId = branchIdRef.current || data?.branch?.id;
    if (!branchId || !cSyncFrom || !cSyncTo) return;

    // إيقاف أي polling سابق
    if (cSyncPollRef.current) clearInterval(cSyncPollRef.current);

    setCsyncStatus("sending");
    setCsyncMsg(`جاري إرسال طلب سحب البيانات (${cSyncFrom} → ${cSyncTo})...`);

    try {
      const res  = await fetch("/api/pos/trigger-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, dateFrom: cSyncFrom, dateTo: cSyncTo }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCsyncStatus("failed");
        setCsyncMsg(json.error || "فشل إرسال الطلب");
        return;
      }
      const triggerId = json.triggerId;
      setCsyncTriggerId(triggerId);
      setCsyncStatus("waiting");
      setCsyncMsg("تم إرسال الطلب — في انتظار تنفيذ السكريبت على الكاشير...");

      // ✅ حفظ الحالة في localStorage للاستئناف بعد تحديث الصفحة
      try {
        localStorage.setItem(syncStateKey, JSON.stringify({
          triggerId,
          branchId,
          dateFrom: cSyncFrom,
          dateTo:   cSyncTo,
          startedAt: Date.now(),
        }));
      } catch {}

      // بدء الـ polling
      startPolling(branchId, triggerId, cSyncFrom, cSyncTo);

    } catch {
      setCsyncStatus("failed");
      setCsyncMsg("خطأ في الاتصال");
    }
  }

  // ─── دالة Polling المشتركة (تُستخدم من startCustomSync والاستئناف) ───
  function startPolling(branchId: string, triggerId: string, fromDate: string, toDate: string) {
    if (cSyncPollRef.current) clearInterval(cSyncPollRef.current);
    let tries = 0;
    cSyncPollRef.current = setInterval(async () => {
      tries++;
      try {
        const pollRes  = await fetch(`/api/pos/trigger-sync?branchId=${branchId}&triggerId=${triggerId}`);
        const pollJson = await pollRes.json();
        const st = pollJson?.trigger?.status;

        if (st === "done") {
          clearInterval(cSyncPollRef.current!);
          cSyncPollRef.current = null;
          try { localStorage.removeItem(`csync_${slug}`); } catch {}
          setCsyncStatus("done");
          setCsyncMsg(`✅ تمت المزامنة! تم سحب بيانات ${fromDate} → ${toDate}`);
          // تحميل البيانات تلقائياً للفترة المسحوبة
          const applied = { from: fromDate, to: toDate };
          setAppliedCustom(applied);
          setPeriod("custom");
          setShowCustomSync(false);
          await load("custom", applied);
          setTimeout(() => { setCsyncStatus(null); setCsyncMsg(""); }, 8000);

        } else if (st === "failed") {
          clearInterval(cSyncPollRef.current!);
          cSyncPollRef.current = null;
          try { localStorage.removeItem(`csync_${slug}`); } catch {}
          setCsyncStatus("failed");
          setCsyncMsg("❌ فشل تنفيذ المزامنة — تحقق من السكريبت على الكاشير");

        } else if (tries >= 72) {
          // بعد 6 دقائق (72 × 5 ثوانٍ) نوقف الانتظار
          clearInterval(cSyncPollRef.current!);
          cSyncPollRef.current = null;
          try { localStorage.removeItem(`csync_${slug}`); } catch {}
          setCsyncStatus("failed");
          setCsyncMsg("⏰ انتهت مهلة الانتظار — تأكد أن السكريبت يعمل على الكاشير");
        } else {
          const elapsed = Math.round((tries * 5) / 60);
          setCsyncMsg(`⏳ في انتظار تنفيذ المزامنة على الكاشير... (${elapsed > 0 ? elapsed + " دقيقة" : "أقل من دقيقة"})`);
        }
      } catch {}
    }, 5000);
  }

  // ─── useEffect: استئناف الـ polling تلقائياً عند تحديث الصفحة ───
  useEffect(() => {
    const branchId = data?.branch?.id;
    if (!branchId) return;
    if (cSyncPollRef.current) return; // polling جارٍ بالفعل

    // فحص localStorage
    try {
      const saved = localStorage.getItem(`csync_${slug}`);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const ageMs  = Date.now() - (parsed.startedAt || 0);
      // تجاهل إذا مضى أكثر من 15 دقيقة
      if (ageMs > 15 * 60 * 1000 || !parsed.triggerId) {
        localStorage.removeItem(`csync_${slug}`);
        return;
      }
      // استئناف!
      setCsyncTriggerId(parsed.triggerId);
      setCsyncStatus("waiting");
      setCsyncFrom(parsed.dateFrom || todayStr());
      setCsyncTo(parsed.dateTo || todayStr());
      const elapsed = Math.round(ageMs / 60000);
      setCsyncMsg(`⏳ استئناف المزامنة (${parsed.dateFrom} → ${parsed.dateTo}) — مضت ${elapsed} دقيقة...`);
      startPolling(branchId, parsed.triggerId, parsed.dateFrom, parsed.dateTo);
    } catch {
      try { localStorage.removeItem(`csync_${slug}`); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.branch?.id]);

  // ─── إيقاف المزامنة التلقائية ───
  function stopAutoSync() {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    if (countdownRef.current)    clearInterval(countdownRef.current);
    syncIntervalRef.current = null;
    countdownRef.current    = null;
    setSyncStatus(null);
    setSyncMsg("");
    setSyncCycle(0);
    setCountdown(0);
  }

  // ─── إرسال طلب مزامنة واحدة ───
  async function sendOneSyncRequest(branchId: string): Promise<boolean> {
    try {
      const res  = await fetch("/api/pos/trigger-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ─── بدء المزامنة المتكررة ───
  async function startAutoSync() {
    const branchId = branchIdRef.current || data?.branch?.id;
    if (!branchId) return;
    branchIdRef.current = branchId;

    // إيقاف أي جلسة سابقة
    stopAutoSync();

    let cycle = 1;
    setSyncStatus("sending");
    setSyncCycle(cycle);
    setSyncMsg(`إرسال الدورة ${cycle} من ${SYNC_CYCLES}...`);

    // الإرسال الأول فوراً
    const ok = await sendOneSyncRequest(branchId);
    if (!ok) {
      setSyncStatus("failed");
      setSyncMsg("فشل إرسال الطلب");
      return;
    }

    setSyncStatus("running");
    setSyncMsg(`الدورة ${cycle} من ${SYNC_CYCLES} — المزامنة التالية خلال`);
    setCountdown(SYNC_INTERVAL_SECS);

    // عداد تنازلي
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    // تكرار كل SYNC_INTERVAL_SECS ثانية
    syncIntervalRef.current = setInterval(async () => {
      cycle++;
      if (cycle > SYNC_CYCLES) {
        stopAutoSync();
        setSyncStatus("done");
        setSyncMsg("اكتملت جميع دورات المزامنة");
        // تحديث البيانات
        if (period === "custom" && appliedCustom) {
          load("custom", appliedCustom);
        } else {
          load(period);
        }
        setTimeout(() => { setSyncStatus(null); setSyncMsg(""); }, 5000);
        return;
      }
      setSyncCycle(cycle);
      setSyncMsg(`الدورة ${cycle} من ${SYNC_CYCLES} — المزامنة التالية خلال`);
      setCountdown(SYNC_INTERVAL_SECS);
      await sendOneSyncRequest(branchId);
      // تحديث البيانات بعد كل مزامنة
      if (period === "custom" && appliedCustom) {
        load("custom", appliedCustom);
      } else {
        load(period);
      }
    }, SYNC_INTERVAL_SECS * 1000);
  }

  // تنظيف عند الخروج
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current)  clearInterval(syncIntervalRef.current);
      if (countdownRef.current)     clearInterval(countdownRef.current);
      if (cSyncPollRef.current)     clearInterval(cSyncPollRef.current);
    };
  }, []);

  const periods: { key: Period; label: string }[] = [
    { key: "today",     label: "اليوم"      },
    { key: "yesterday", label: "أمس"        },
    { key: "week",      label: "آخر 7 أيام" },
    { key: "month",     label: "هذا الشهر" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/dashboard/pos-sales"
          className="text-muted hover:text-cream text-sm transition-colors flex-shrink-0">
          &larr; العودة
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-cream">
            {data?.branch?.name ?? "جاري التحميل..."}
          </h1>
          {data?.period && (
            <p className="text-muted text-sm mt-1">
              {data.period.from === data.period.to
                ? data.period.from
                : `${data.period.from} → ${data.period.to}`}
            </p>
          )}
        </div>

        {/* زر تحديث */}
        <button
          onClick={() => period === "custom" && appliedCustom ? load("custom", appliedCustom) : load(period)}
          className="bg-card border border-line text-muted hover:text-cream px-4 py-2 rounded-xl text-sm transition-colors">
          تحديث
        </button>

        {/* زر مزامنة مخصصة */}
        <button
          onClick={() => setShowCustomSync(v => !v)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            showCustomSync || cSyncStatus === "waiting"
              ? "bg-purple-500 text-white"
              : "bg-card border border-purple-400/30 text-purple-400 hover:bg-purple-400/10"
          }`}>
          {cSyncStatus === "waiting" ? "جاري السحب..." : "سحب تاريخ مخصص"}
        </button>

        {/* زر مزامنة الآن */}
        {syncStatus === "running" ? (
          <button
            onClick={stopAutoSync}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red/10 border border-red/30 text-red hover:bg-red/20 transition-colors">
            <span className="w-4 h-4 border-2 border-red border-t-transparent rounded-full animate-spin" />
            إيقاف المزامنة
          </button>
        ) : (
          <button
            onClick={startAutoSync}
            disabled={syncStatus === "sending"}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              syncStatus === "done"
                ? "bg-green/20 border border-green/40 text-green"
                : syncStatus === "failed"
                ? "bg-red/20 border border-red/40 text-red"
                : syncStatus === "sending"
                ? "bg-amber/10 border border-amber/30 text-amber cursor-not-allowed"
                : "bg-amber/10 border border-amber/30 text-amber hover:bg-amber/20"
            }`}>
            {syncStatus === "sending" && (
              <span className="w-4 h-4 border-2 border-amber border-t-transparent rounded-full animate-spin" />
            )}
            مزامنة الآن
          </button>
        )}
      </div>

      {/* ── شريط صحة السكريبت ── */}
      {health && (
        <>
          {health.scriptStatus === "dead" && (
            <div className="rounded-xl border border-red/40 bg-red/5 px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="text-red text-lg flex-shrink-0 mt-0.5">⛔</span>
                <div className="flex-1">
                  <p className="text-red font-bold text-sm">السكريبت على الكاشير متوقف!</p>
                  <p className="text-red/70 text-xs mt-0.5">
                    {health.lastSync
                      ? `آخر مزامنة: منذ ${health.lastSync.minutesAgo} دقيقة — يجب أن يعمل كل 5 دقائق`
                      : "لم يتم تسجيل أي مزامنة من قبل"}
                    {health.stuckTriggers > 0 && ` • ${health.stuckTriggers} طلب عالق`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-red/60">
                    <span>الحل: اذهب لكمبيوتر الكاشير وشغّل:</span>
                    <code className="bg-red/10 rounded px-2 py-0.5 text-red font-mono">
                      تشخيص-المزامنة.bat
                    </code>
                    <span>أو:</span>
                    <code className="bg-red/10 rounded px-2 py-0.5 text-red font-mono">
                      python C:\AroniumSync\sync.py --trigger
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}
          {health.scriptStatus === "warning" && (
            <div className="rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 flex items-center gap-3">
              <span className="text-amber text-base">⚠️</span>
              <div>
                <p className="text-amber text-sm font-semibold">السكريبت متأخر</p>
                <p className="text-amber/70 text-xs">
                  آخر مزامنة: منذ {health.lastSync?.minutesAgo} دقيقة
                  {health.stuckTriggers > 0 && ` • ${health.stuckTriggers} طلب عالق`}
                </p>
              </div>
            </div>
          )}
          {health.scriptStatus === "healthy" && health.lastSync && (
            <div className="rounded-xl border border-green/20 bg-green/5 px-4 py-2 flex items-center gap-2 text-xs text-green/70">
              <span className="w-2 h-2 bg-green rounded-full animate-pulse flex-shrink-0" />
              السكريبت يعمل • آخر مزامنة: منذ {health.lastSync.minutesAgo} دقيقة
              {health.lastSync.salesCount != null && ` • ${health.lastSync.salesCount} فاتورة`}
            </div>
          )}
          {health.scriptStatus === "unknown" && (
            <div className="rounded-xl border border-line bg-card-hi px-4 py-2 flex items-center gap-2 text-xs text-muted">
              <span>❔</span>
              لم يُسجَّل أي مزامنة بعد — تأكد من تثبيت السكريبت على كمبيوتر الكاشير
            </div>
          )}
        </>
      )}

      {/* ── شريط حالة المزامنة مع تايمر ── */}
      {syncStatus && syncStatus !== "done" && syncStatus !== "failed" && (
        <div className="rounded-xl px-4 py-3 border bg-amber/10 border-amber/30 text-amber">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-amber rounded-full animate-pulse" />
              <span className="text-sm font-medium">
                {syncMsg}
                {syncStatus === "running" && (
                  <span className="font-mono font-black text-base mr-2">
                    {fmtCountdown(countdown)}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* شريط التقدم */}
              <div className="flex gap-1">
                {Array.from({ length: SYNC_CYCLES }).map((_, i) => (
                  <div key={i} className={`h-2 w-2 rounded-full ${
                    i < syncCycle ? "bg-amber" : "bg-amber/20"
                  }`} />
                ))}
              </div>
              <span className="text-xs text-amber/70">{syncCycle}/{SYNC_CYCLES} دورة</span>
            </div>
          </div>
        </div>
      )}
      {(syncStatus === "done" || syncStatus === "failed") && syncMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${
          syncStatus === "done" ? "bg-green/10 border-green/30 text-green" : "bg-red/10 border-red/30 text-red"
        }`}>
          {syncMsg}
        </div>
      )}

      {/* ── شريط حالة المزامنة المخصصة (يظهر دائماً خارج اللوحة) ── */}
      {cSyncStatus && cSyncStatus !== "done" && cSyncStatus !== "failed" && !showCustomSync && (
        <div className="rounded-xl px-4 py-3 border bg-purple-500/10 border-purple-400/30 text-purple-300 flex items-center gap-3">
          <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm flex-1">{cSyncMsg || "جاري سحب البيانات من الكاشير..."}</span>
          <button onClick={() => setShowCustomSync(true)}
            className="text-xs text-purple-400 hover:text-purple-300 underline whitespace-nowrap">
            عرض التفاصيل
          </button>
        </div>
      )}
      {(cSyncStatus === "done" || cSyncStatus === "failed") && !showCustomSync && cSyncMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm border flex items-center gap-2 ${
          cSyncStatus === "done" ? "bg-green/10 border-green/30 text-green" : "bg-red/10 border-red/30 text-red"
        }`}>
          <span className="flex-1">{cSyncMsg}</span>
          <button onClick={() => { setCsyncStatus(null); setCsyncMsg(""); }}
            className="text-lg leading-none opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* ── لوحة المزامنة المخصصة (سحب من الكاشير) ── */}
      {showCustomSync && (
        <div className="bg-card border border-purple-400/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-cream font-bold text-sm">سحب بيانات تاريخية من الكاشير</h3>
              <p className="text-muted text-xs mt-1">
                حدّد الفترة وسيُرسَل طلب للسكريبت على كمبيوتر الكاشير يجلب البيانات من Aronium
              </p>
            </div>
            <button onClick={() => setShowCustomSync(false)} className="text-muted hover:text-cream text-lg leading-none">×</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-muted text-xs block mb-1">من تاريخ</label>
              <input type="date" value={cSyncFrom}
                onChange={e => setCsyncFrom(e.target.value)}
                className="w-full bg-card-hi border border-line rounded-xl px-3 py-2 text-cream text-sm focus:outline-none focus:border-purple-400/50" />
            </div>
            <div>
              <label className="text-muted text-xs block mb-1">إلى تاريخ</label>
              <input type="date" value={cSyncTo} min={cSyncFrom}
                onChange={e => setCsyncTo(e.target.value)}
                className="w-full bg-card-hi border border-line rounded-xl px-3 py-2 text-cream text-sm focus:outline-none focus:border-purple-400/50" />
            </div>
          </div>

          {/* اختصارات سريعة */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "أمس",       days: 1  },
              { label: "3 أيام",    days: 3  },
              { label: "أسبوع",     days: 7  },
              { label: "شهر كامل",  days: 30 },
            ].map(s => (
              <button key={s.label}
                onClick={() => {
                  const to = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
                  const toStr = `${to.getFullYear()}-${String(to.getMonth()+1).padStart(2,"0")}-${String(to.getDate()).padStart(2,"0")}`;
                  const from = new Date(to); from.setDate(from.getDate() - (s.days - 1));
                  const fromStr = `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,"0")}-${String(from.getDate()).padStart(2,"0")}`;
                  setCsyncFrom(fromStr); setCsyncTo(toStr);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-purple-400/20 text-purple-400 hover:bg-purple-400/10 transition-colors">
                {s.label}
              </button>
            ))}
          </div>

          {/* شريط الحالة */}
          {cSyncMsg && (
            <div className={`rounded-xl px-4 py-3 text-sm border flex items-center gap-3 ${
              cSyncStatus === "done"    ? "bg-green/10 border-green/30 text-green"   :
              cSyncStatus === "failed"  ? "bg-red/10 border-red/30 text-red"         :
              "bg-purple-500/10 border-purple-400/30 text-purple-300"
            }`}>
              {cSyncStatus === "waiting" && (
                <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
              {cSyncMsg}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={startCustomSync}
              disabled={!cSyncFrom || !cSyncTo || cSyncStatus === "sending" || cSyncStatus === "waiting"}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-purple-500 text-white hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {cSyncStatus === "sending" || cSyncStatus === "waiting"
                ? "جاري الطلب..."
                : `سحب البيانات من الكاشير`}
            </button>
            <button onClick={() => { setShowCustomSync(false); setCsyncStatus(null); setCsyncMsg(""); }}
              className="px-4 py-2.5 rounded-xl text-sm bg-card border border-line text-muted hover:text-cream transition-colors">
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* ── Period Tabs + زر تاريخ مخصص (للعرض فقط) ── */}
      <div className="flex gap-2 flex-wrap items-center">
        {periods.map(p => (
          <button key={p.key}
            onClick={() => { setPeriod(p.key); setAppliedCustom(null); setShowCustom(false); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              period === p.key
                ? "bg-green text-white"
                : "bg-card border border-line text-muted hover:text-cream"
            }`}>
            {p.label}
          </button>
        ))}

        {/* زر تاريخ مخصص */}
        <button
          onClick={() => setShowCustom(v => !v)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            period === "custom"
              ? "bg-purple-500 text-white"
              : "bg-card border border-purple-400/30 text-purple-400 hover:bg-purple-400/10"
          }`}>
          {period === "custom" && appliedCustom
            ? `${appliedCustom.from} → ${appliedCustom.to}`
            : "تاريخ مخصص"}
        </button>
      </div>

      {/* ── لوحة التاريخ المخصص ── */}
      {showCustom && (
        <div className="bg-card border border-purple-400/30 rounded-2xl p-4 space-y-4">
          <p className="text-cream font-semibold text-sm">اختر الفترة المطلوبة</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-muted text-xs block mb-1">من تاريخ</label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full bg-card-hi border border-line rounded-xl px-3 py-2 text-cream text-sm focus:outline-none focus:border-purple-400/50"
              />
            </div>
            <div>
              <label className="text-muted text-xs block mb-1">إلى تاريخ</label>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={e => setCustomTo(e.target.value)}
                className="w-full bg-card-hi border border-line rounded-xl px-3 py-2 text-cream text-sm focus:outline-none focus:border-purple-400/50"
              />
            </div>
          </div>

          {/* اختصارات سريعة */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "أمس", days: 1 },
              { label: "آخر 3 أيام", days: 3 },
              { label: "آخر 7 أيام", days: 7 },
              { label: "آخر 30 يوم", days: 30 },
            ].map(s => (
              <button key={s.label}
                onClick={() => {
                  const to = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
                  const toStr = `${to.getFullYear()}-${String(to.getMonth()+1).padStart(2,"0")}-${String(to.getDate()).padStart(2,"0")}`;
                  const from = new Date(to); from.setDate(from.getDate() - (s.days - 1));
                  const fromStr = `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,"0")}-${String(from.getDate()).padStart(2,"0")}`;
                  setCustomFrom(fromStr);
                  setCustomTo(toStr);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-purple-400/20 text-purple-400 hover:bg-purple-400/10 transition-colors">
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={applyCustomDate}
              disabled={!customFrom || !customTo}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-500 text-white hover:bg-purple-600 transition-colors disabled:opacity-50">
              عرض البيانات
            </button>
            <button
              onClick={() => setShowCustom(false)}
              className="px-4 py-2.5 rounded-xl text-sm bg-card border border-line text-muted hover:text-cream transition-colors">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ── المحتوى ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data?.error ? (
        <div className="text-center py-20 text-red">{data.error}</div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-green/20 rounded-2xl p-4 text-center col-span-2 md:col-span-1">
              <p className="text-muted text-xs mb-1">صافي المبيعات</p>
              <p className="text-green font-black text-2xl ltr-num" dir="ltr">{fmtNum(data.summary.netSales)}</p>
              <p className="text-muted text-xs">ريال</p>
            </div>
            <div className="bg-card border border-line rounded-2xl p-4 text-center">
              <p className="text-muted text-xs mb-1">الإجمالي</p>
              <p className="text-cream font-bold text-xl ltr-num" dir="ltr">{fmtNum(data.summary.totalSales)}</p>
              <p className="text-muted text-xs">ريال</p>
            </div>
            <div className="bg-card border border-line rounded-2xl p-4 text-center">
              <p className="text-muted text-xs mb-1">الفواتير</p>
              <p className="text-cream font-bold text-xl">{data.summary.invoiceCount}</p>
              <p className="text-muted text-xs">فاتورة</p>
            </div>
            <div className="bg-card border border-red/20 rounded-2xl p-4 text-center">
              <p className="text-muted text-xs mb-1">المرتجعات</p>
              <p className="text-red font-bold text-xl ltr-num" dir="ltr">{fmtNum(data.summary.totalReturns)}</p>
              <p className="text-muted text-xs">ريال</p>
            </div>
          </div>

          {/* طرق الدفع */}
          <div className="bg-card border border-line rounded-2xl overflow-hidden">
            <div className="bg-card-hi px-4 py-3 border-b border-line">
              <h3 className="text-cream font-bold">تفصيل الصندوق</h3>
            </div>
            {/* ملاحظة: الفواتير المختلطة موزّعة تلقائياً على كاش وشبكة */}
            {data.summary.mixed > 0 && (
              <div className="px-4 pt-3 pb-0">
                <p className="text-xs text-teal-400/80 bg-teal-400/5 border border-teal-400/20 rounded-lg px-3 py-1.5">
                  ⚡ يوجد فواتير مختلطة — مبالغ الكاش والشبكة منها مضمّنة في الأرقام أدناه
                </p>
              </div>
            )}
            <div className={`grid gap-0 divide-x divide-x-reverse divide-line ${
              data.summary.unknownPay > 0
                ? "grid-cols-2 md:grid-cols-5"
                : "grid-cols-2 md:grid-cols-4"
            }`}>
              {(["cash", "network", "transfer", "deferred"] as const).map(key => {
                const info = PAY_INFO[key];
                const val  = data.summary[key];
                return (
                  <div key={key} className="p-4 text-center">
                    <p className="text-muted text-xs mb-1">{info.label}</p>
                    <p className={`font-bold text-lg ltr-num ${info.color}`} dir="ltr">
                      {fmtNum(val)}
                    </p>
                    <p className="text-muted text-xs">ر.س</p>
                  </div>
                );
              })}
              {/* طرق دفع غير معروفة */}
              {data.summary.unknownPay > 0 && (
                <div className="p-4 text-center bg-orange-500/5">
                  <p className="text-muted text-xs mb-1">غير مصنف ⚠️</p>
                  <p className="font-bold text-lg ltr-num text-orange-400" dir="ltr">
                    {fmtNum(data.summary.unknownPay)}
                  </p>
                  <p className="text-muted text-xs">ر.س</p>
                </div>
              )}
            </div>
            {/* شريط النسب */}
            <div className="px-4 pb-4">
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {(["cash", "network", "transfer", "deferred"] as const).map(key => {
                  const val   = data.summary[key];
                  const total = data.summary.totalSales || 1;
                  const pct   = Math.max(0, (val / total) * 100);
                  const colors = { cash: "bg-green", network: "bg-sky-400", transfer: "bg-purple-400", deferred: "bg-amber" };
                  return pct > 0.5 ? (
                    <div key={key} style={{ width: `${pct}%` }}
                      className={`${colors[key]} rounded-sm`}
                      title={`${PAY_INFO[key].label}: ${fmtNum(val)} ر.س`} />
                  ) : null;
                })}
                {data.summary.unknownPay > 0 && (() => {
                  const pct = Math.max(0, (data.summary.unknownPay / (data.summary.totalSales || 1)) * 100);
                  return pct > 0.5 ? (
                    <div style={{ width: `${pct}%` }}
                      className="bg-orange-400 rounded-sm"
                      title={`غير مصنف: ${fmtNum(data.summary.unknownPay)} ر.س`} />
                  ) : null;
                })()}
              </div>
              <div className="flex gap-4 mt-2 flex-wrap">
                {(["cash", "network", "transfer", "deferred"] as const).map(key => {
                  const val   = data.summary[key];
                  const total = data.summary.totalSales || 1;
                  const pct   = ((val / total) * 100).toFixed(1);
                  return (
                    <span key={key} className={`text-xs ${PAY_INFO[key].color}`}>
                      {PAY_INFO[key].label}: {pct}%
                    </span>
                  );
                })}
                {data.summary.unknownPay > 0 && (
                  <span className="text-xs text-orange-400">
                    غير مصنف: {((data.summary.unknownPay / (data.summary.totalSales || 1)) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            {/* ── debug: طرق الدفع غير المعروفة ── */}
            {data.summary.unknownPay > 0 && data.debug?.uniquePayMethods?.length > 0 && (
              <div className="px-4 pb-4 border-t border-line/50 pt-3">
                <p className="text-xs text-orange-400 font-bold mb-2">
                  ⚠️ يوجد مبالغ غير مصنفة ({fmtNum(data.summary.unknownPay)} ر.س) — طرق الدفع المسجلة في Aronium:
                </p>
                <div className="flex gap-2 flex-wrap">
                  {data.debug.uniquePayMethods.map((m: string) => (
                    <code key={m} className="text-xs bg-card-hi border border-orange-400/20 text-orange-300 rounded px-2 py-1">
                      {m || '""'}
                    </code>
                  ))}
                </div>
                <p className="text-xs text-muted mt-2">
                  👆 أبلغ المطور بهذه القيم لإضافتها إلى نظام التصنيف
                </p>
              </div>
            )}
          </div>

          {/* المبيعات حسب الفئة */}
          {data.topProducts?.length > 0 && (
            <div className="bg-card border border-line rounded-2xl overflow-hidden">
              <div className="bg-card-hi px-4 py-3 border-b border-line">
                <h3 className="text-cream font-bold">المبيعات حسب الفئة</h3>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(data.byCategory).map(([cat, vals]: [string, any]) => {
                  const info = CAT_INFO[cat] ?? CAT_INFO.other;
                  if (vals.amount === 0 && vals.qty === 0) return null;
                  return (
                    <div key={cat} className={`rounded-xl border p-4 ${info.bg}`}>
                      <p className={`font-bold mb-2 ${info.color}`}>{info.label}</p>
                      <div className="flex justify-between text-sm">
                        <div>
                          <p className="text-muted text-xs">الكمية</p>
                          <p className="text-cream font-bold ltr-num">{fmtNum(vals.qty)}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-muted text-xs">المبلغ</p>
                          <p className="text-cream font-black text-lg ltr-num">
                            {fmtNum(vals.amount)} <span className="text-muted text-xs font-normal">ر.س</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-card-hi rounded-xl p-1">
            <button onClick={() => setActiveTab("summary")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === "summary" ? "bg-card text-cream shadow" : "text-muted hover:text-cream"
              }`}>
              أفضل المنتجات
            </button>
            <button onClick={() => setActiveTab("invoices")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === "invoices" ? "bg-card text-cream shadow" : "text-muted hover:text-cream"
              }`}>
              الفواتير ({data.invoices?.length ?? 0})
            </button>
          </div>

          {/* أفضل المنتجات */}
          {activeTab === "summary" && (
            <div className="bg-card border border-line rounded-2xl overflow-hidden">
              <div className="bg-card-hi px-4 py-3 border-b border-line grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs text-muted font-semibold">
                <span>المنتج</span>
                <span className="text-center">الفئة</span>
                <span className="text-center">الكمية</span>
                <span className="text-left">المبلغ</span>
              </div>
              <div className="divide-y divide-line/50">
                {data.topProducts?.length === 0 && (
                  <div className="text-center py-8 text-muted text-sm">
                    لا توجد بيانات أصناف
                    <p className="text-xs mt-2">تأكد أن المزامنة تشمل أصناف الفواتير (sale_items)</p>
                  </div>
                )}
                {data.topProducts?.map((p: any, i: number) => {
                  const info = CAT_INFO[p.category] ?? CAT_INFO.other;
                  return (
                    <div key={i}
                      className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-3 items-center hover:bg-card-hi/50 transition-colors">
                      <p className="text-cream text-sm font-medium">{p.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-lg border ${info.bg} ${info.color} text-center whitespace-nowrap`}>
                        {info.label}
                      </span>
                      <span className="text-muted text-sm ltr-num text-center">{fmtNum(p.qty)}</span>
                      <span className="text-amber font-bold text-sm ltr-num text-left whitespace-nowrap">
                        {fmtNum(p.amount)} ر.س
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* الفواتير */}
          {activeTab === "invoices" && (
            <div className="bg-card border border-line rounded-2xl overflow-hidden">
              <div className="bg-card-hi px-4 py-3 border-b border-line grid grid-cols-[auto_1fr_auto_auto] gap-2 text-xs text-muted font-semibold">
                <span>#</span>
                <span>الوقت</span>
                <span className="text-center">الدفع</span>
                <span className="text-left">المبلغ</span>
              </div>
              <div className="divide-y divide-line/50 max-h-[500px] overflow-y-auto">
                {data.invoices?.length === 0 && (
                  <div className="text-center py-8 text-muted text-sm">لا توجد فواتير</div>
                )}
                {data.invoices?.map((inv: any, i: number) => {
                  const pm        = payMethod(inv.payment_method);
                  const isMixed   = inv.payment_method?.toLowerCase() === "mixed";
                  const hasSplit  = isMixed && (inv.mixed_cash_amount > 0 || inv.mixed_network_amount > 0);
                  const isReturn  = inv.document_type?.toLowerCase().includes("refund") ||
                                    inv.document_type?.toLowerCase().includes("return");
                  return (
                    <div key={inv.id}
                      className={`grid grid-cols-[auto_1fr_auto_auto] gap-2 px-4 py-2.5 items-center hover:bg-card-hi/50 ${isReturn ? "opacity-60" : ""}`}>
                      <span className="text-muted text-xs ltr-num">{inv.invoice_number || `#${i + 1}`}</span>
                      <div>
                        <p className="text-cream text-xs">{fmtDate(inv.sale_date)} {fmtTime(inv.sale_date)}</p>
                        {inv.cashier_name && <p className="text-muted text-xs">{inv.cashier_name}</p>}
                      </div>
                      <div className="text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-lg border bg-card-hi border-line ${pm.color} whitespace-nowrap`}>
                          {pm.label}
                        </span>
                        {/* تفاصيل الدفع المختلط */}
                        {hasSplit && (
                          <p className="text-xs mt-0.5 text-muted">
                            {inv.mixed_cash_amount > 0 && (
                              <span className="text-green">{fmtNum(inv.mixed_cash_amount)} كاش</span>
                            )}
                            {inv.mixed_cash_amount > 0 && inv.mixed_network_amount > 0 && (
                              <span className="mx-1 opacity-40">|</span>
                            )}
                            {inv.mixed_network_amount > 0 && (
                              <span className="text-sky-400">{fmtNum(inv.mixed_network_amount)} شبكة</span>
                            )}
                          </p>
                        )}
                      </div>
                      <span
                        className={`font-bold text-sm ltr-num text-left whitespace-nowrap ${isReturn ? "text-red" : "text-cream"}`}
                        dir="ltr">
                        {isReturn ? "-" : ""}{fmtNum(inv.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
