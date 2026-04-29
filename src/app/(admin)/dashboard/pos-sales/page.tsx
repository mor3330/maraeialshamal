"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Period = "today" | "yesterday" | "week" | "month";

interface BranchStat {
  id: string; name: string; slug: string; code: string;
  is_active: boolean; pos_sync_enabled: boolean;
  totalSales: number; invoiceCount: number; refundCount: number;
  cash: number; network: number; transfer: number; deferred: number;
  lastSync: string | null; lastSyncStatus: string | null;
  lastSyncError: string | null; syncedToday: boolean;
}
interface Summary {
  totalSales: number; invoiceCount: number;
  totalCash: number; totalNetwork: number; totalTransfer: number; totalDeferred: number;
  branchesWithData: number; branchesTotal: number; syncedBranches: number;
}
interface DashData {
  range: { from: string; to: string };
  period: string;
  summary: Summary;
  branches: BranchStat[];
}

const fmtNum = (n: number) => n.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function syncBadge(b: BranchStat) {
  if (!b.pos_sync_enabled)
    return <span className="text-xs px-2 py-1 rounded-full bg-red/10 text-red border border-red/20">POS متوقف</span>;
  if (b.lastSyncStatus === "failed")
    return <span className="text-xs px-2 py-1 rounded-full bg-red/10 text-red">فشل</span>;
  if (b.lastSync) {
    const mins = Math.floor((Date.now() - new Date(b.lastSync).getTime()) / 60000);
    if (mins < 10)   return <span className="text-xs px-2 py-1 rounded-full bg-green/10 text-green">منذ {mins}د</span>;
    if (mins < 60)   return <span className="text-xs px-2 py-1 rounded-full bg-green/10 text-green border border-green/20">منذ {mins}د</span>;
    if (mins < 1440) return <span className="text-xs px-2 py-1 rounded-full bg-amber/10 text-amber">منذ {Math.floor(mins/60)}س</span>;
    return <span className="text-xs px-2 py-1 rounded-full bg-red/10 text-red">منذ {Math.floor(mins/1440)}ي</span>;
  }
  // لا يوجد سجل مزامنة مكتمل — لم يزامن بعد (أو في منتصف مزامنة)
  return <span className="text-xs px-2 py-1 rounded-full bg-card-hi text-muted border border-line">لم يزامن</span>;
}

export default function PosSalesPage() {
  const [period, setPeriod]   = useState<Period>("today");
  const [data, setData]       = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  // ─── حالة المزامنة الفورية ───
  const [syncingBranch, setSyncingBranch] = useState<string | null>(null);
  const [syncToast, setSyncToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  // ─── حالة تبديل مزامنة POS ───
  const [togglingPos, setTogglingPos] = useState<string | null>(null);

  // ─── نشر تحديث السكريبت لجميع الفروع ───
  const [pushingUpdate, setPushingUpdate] = useState(false);
  const [pushResult, setPushResult]       = useState<{ msg: string; ok: boolean } | null>(null);

  async function pushAgentUpdate() {
    if (pushingUpdate) return;
    setPushingUpdate(true);
    setPushResult(null);
    try {
      const res  = await fetch("/api/pos/agent-update", { method: "POST" });
      const json = await res.json();
      setPushResult({
        msg: res.ok
          ? (json.message || `✅ تم نشر v${json.version} — الفروع ستتحدث خلال ساعتين`)
          : `❌ ${json.error || "فشل النشر"}`,
        ok: res.ok,
      });
    } catch {
      setPushResult({ msg: "❌ خطأ في الاتصال", ok: false });
    }
    setPushingUpdate(false);
    setTimeout(() => setPushResult(null), 8000);
  }

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/dashboard?period=${p}`);
      const json = await res.json();
      setData(json);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  // ─── طلب مزامنة فورية ───
  async function requestSync(branchId: string, branchName: string) {
    if (syncingBranch) return;
    setSyncingBranch(branchId);
    setSyncToast({ msg: `⏳ جاري إرسال طلب مزامنة "${branchName}"...`, ok: true });
    try {
      const res = await fetch("/api/pos/trigger-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSyncToast({ msg: `❌ ${json.error || "فشل الإرسال"}`, ok: false });
        setSyncingBranch(null);
        setTimeout(() => setSyncToast(null), 4000);
        return;
      }
      setSyncToast({ msg: `✅ تم إرسال الطلب! ستتم المزامنة خلال دقيقة`, ok: true });
      setSyncingBranch(null);
      setTimeout(() => { load(period); setSyncToast(null); }, 65000);
    } catch {
      setSyncToast({ msg: "❌ خطأ في الاتصال", ok: false });
      setSyncingBranch(null);
      setTimeout(() => setSyncToast(null), 4000);
    }
  }

  // ─── تبديل تفعيل/إيقاف مزامنة POS للفرع ───
  async function togglePosSync(branch: BranchStat) {
    if (togglingPos) return;
    setTogglingPos(branch.id);
    try {
      const newVal = !branch.pos_sync_enabled;
      const res = await fetch(`/api/admin/branches/${branch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pos_sync_enabled: newVal }),
      });
      if (res.ok) {
        setSyncToast({
          msg: newVal
            ? `✅ تم تفعيل مزامنة POS لـ "${branch.name}"`
            : `🔴 تم إيقاف مزامنة POS لـ "${branch.name}"`,
          ok: newVal,
        });
        await load(period);
      } else {
        setSyncToast({ msg: "❌ فشل تحديث الإعداد", ok: false });
      }
    } catch {
      setSyncToast({ msg: "❌ خطأ في الاتصال", ok: false });
    }
    setTogglingPos(null);
    setTimeout(() => setSyncToast(null), 3000);
  }

  const filtered = (data?.branches ?? []).filter(b =>
    b.name.includes(search) || b.code?.includes(search)
  );

  const periods: { key: Period; label: string }[] = [
    { key: "today",     label: "اليوم" },
    { key: "yesterday", label: "أمس" },
    { key: "week",      label: "آخر 7 أيام" },
    { key: "month",     label: "هذا الشهر" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cream">مبيعات Aronium POS</h1>
          <p className="text-muted text-sm mt-1">
            {data ? `${data.range.from === data.range.to ? data.range.from : `${data.range.from} → ${data.range.to}`}` : "جاري التحميل..."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* زر نشر تحديث السكريبت لجميع الفروع */}
          <button
            onClick={pushAgentUpdate}
            disabled={pushingUpdate}
            title="يُحدّث sync.py على جميع الفروع الـ 30 تلقائياً خلال ساعتين"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${
              pushingUpdate
                ? "bg-sky-500/10 border-sky-400/30 text-sky-400 cursor-not-allowed"
                : "bg-sky-500/10 border-sky-400/30 text-sky-400 hover:bg-sky-400/20"
            }`}>
            {pushingUpdate ? (
              <span className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
            نشر تحديث للفروع
          </button>

          <button onClick={() => load(period)}
            className="flex items-center gap-2 bg-card border border-line text-muted hover:text-cream px-4 py-2 rounded-xl text-sm transition-colors">
            تحديث
          </button>
        </div>
      </div>

      {/* ── نتيجة نشر التحديث ── */}
      {pushResult && (
        <div className={`rounded-xl px-4 py-3 text-sm border flex items-center justify-between gap-3 ${
          pushResult.ok ? "bg-sky-500/10 border-sky-400/30 text-sky-300" : "bg-red/10 border-red/30 text-red"
        }`}>
          <span>{pushResult.msg}</span>
          <button onClick={() => setPushResult(null)} className="text-lg opacity-50 hover:opacity-100">×</button>
        </div>
      )}

      {/* ── Period Tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {periods.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              period === p.key ? "bg-green text-white" : "bg-card border border-line text-muted hover:text-cream"
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-line rounded-2xl p-4 text-center">
              <p className="text-muted text-xs mb-1">إجمالي المبيعات</p>
              <p className="text-cream font-bold text-xl ltr-num" dir="ltr">{fmtNum(data.summary.totalSales)}</p>
              <p className="text-muted text-xs">ريال</p>
            </div>
            <div className="bg-card border border-line rounded-2xl p-4 text-center">
              <p className="text-muted text-xs mb-1">عدد الفواتير</p>
              <p className="text-cream font-bold text-xl">{data.summary.invoiceCount}</p>
              <p className="text-muted text-xs">فاتورة</p>
            </div>
            <div className="bg-card border border-green/20 rounded-2xl p-4 text-center">
              <p className="text-muted text-xs mb-1">فروع لها بيانات</p>
              <p className="text-green font-bold text-xl">{data.summary.branchesWithData} / {data.summary.branchesTotal}</p>
              <p className="text-muted text-xs">فرع</p>
            </div>
            <div className="bg-card border border-amber/20 rounded-2xl p-4 text-center">
              <p className="text-muted text-xs mb-1">زامنت اليوم</p>
              <p className="text-amber font-bold text-xl">{data.summary.syncedBranches} / {data.summary.branchesTotal}</p>
              <p className="text-muted text-xs">فرع</p>
            </div>
          </div>

          {/* ── Payment Methods ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "كاش",    val: data.summary.totalCash,     color: "green" },
              { label: "شبكة",   val: data.summary.totalNetwork,  color: "sky-400" },
              { label: "تحويل",  val: data.summary.totalTransfer, color: "purple-400" },
              { label: "آجل",    val: data.summary.totalDeferred, color: "amber" },
            ].map(card => (
              <div key={card.label} className="bg-card-hi border border-line rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-muted text-xs">{card.label}</p>
                  <p className={`text-${card.color} font-bold ltr-num`} dir="ltr">{fmtNum(card.val)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Search ── */}
          <input type="text" placeholder="بحث عن فرع..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm bg-card border border-line rounded-xl px-4 py-2 text-cream text-sm placeholder:text-muted focus:outline-none focus:border-green/50" />

          {/* ── Branches Table ── */}
          <div className="bg-card border border-line rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-card-hi text-muted text-xs border-b border-line">
                  <th className="text-right px-4 py-3">الفرع</th>
                  <th className="text-center px-3 py-3 hidden md:table-cell">المبيعات (ريال)</th>
                  <th className="text-center px-3 py-3 hidden md:table-cell">فواتير</th>
                  <th className="text-center px-3 py-3 hidden lg:table-cell">كاش</th>
                  <th className="text-center px-3 py-3 hidden lg:table-cell">شبكة</th>
                  <th className="text-center px-3 py-3">آخر مزامنة</th>
                  <th className="text-center px-3 py-3">مزامنة</th>
                  <th className="text-center px-3 py-3">POS</th>
                  <th className="text-center px-3 py-3 hidden md:table-cell">تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => (
                  <tr key={b.id}
                    className={`border-b border-line/50 transition-colors hover:bg-card-hi ${
                      !b.pos_sync_enabled ? "opacity-60 bg-red/5" : b.invoiceCount === 0 ? "opacity-50" : ""
                    } ${i % 2 === 0 ? "" : "bg-card-hi/30"}`}>

                    {/* اسم الفرع */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-cream flex items-center gap-2">
                        {b.name}
                        {!b.pos_sync_enabled && (
                          <span className="text-xs bg-red/10 text-red border border-red/20 rounded-full px-1.5 py-0.5">
                            POS متوقف
                          </span>
                        )}
                      </div>
                      {b.code && <div className="text-muted text-xs">{b.code}</div>}
                    </td>

                    <td className="text-center px-3 py-3 hidden md:table-cell">
                      <span className={`font-bold ltr-num ${b.totalSales > 0 ? "text-green" : "text-muted"}`} dir="ltr">
                        {fmtNum(b.totalSales)}
                      </span>
                    </td>
                    <td className="text-center px-3 py-3 hidden md:table-cell text-cream">{b.invoiceCount}</td>
                    <td className="text-center px-3 py-3 hidden lg:table-cell text-muted ltr-num" dir="ltr">{fmtNum(b.cash)}</td>
                    <td className="text-center px-3 py-3 hidden lg:table-cell text-muted ltr-num" dir="ltr">{fmtNum(b.network)}</td>
                    <td className="text-center px-3 py-3">{syncBadge(b)}</td>

                    {/* زر مزامنة فورية */}
                    <td className="text-center px-3 py-3">
                      <button
                        onClick={() => requestSync(b.id, b.name)}
                        disabled={syncingBranch === b.id || !b.pos_sync_enabled}
                        title={!b.pos_sync_enabled ? "مزامنة POS متوقفة" : "طلب مزامنة فورية"}
                        className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                          !b.pos_sync_enabled
                            ? "border-line/20 text-muted/30 cursor-not-allowed"
                            : syncingBranch === b.id
                            ? "border-amber/30 text-amber bg-amber/5 cursor-not-allowed"
                            : "border-amber/20 text-amber hover:bg-amber/10"
                        }`}>
                        {syncingBranch === b.id
                          ? <span className="flex items-center gap-1">
                              <span className="w-3 h-3 border border-amber border-t-transparent rounded-full animate-spin inline-block" />
                              جاري...
                            </span>
                          : "الآن"}
                      </button>
                    </td>

                    {/* زر تفعيل/إيقاف مزامنة POS */}
                    <td className="text-center px-3 py-3">
                      <button
                        onClick={() => togglePosSync(b)}
                        disabled={togglingPos === b.id}
                        title={b.pos_sync_enabled ? "إيقاف مزامنة POS" : "تفعيل مزامنة POS"}
                        className={`text-xs px-2 py-1 rounded-lg border transition-colors flex items-center gap-1 mx-auto ${
                          togglingPos === b.id
                            ? "border-line/20 text-muted/50 cursor-not-allowed"
                            : b.pos_sync_enabled
                            ? "border-red/20 text-red hover:bg-red/10"
                            : "border-green/20 text-green hover:bg-green/10"
                        }`}>
                        {togglingPos === b.id
                          ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          : b.pos_sync_enabled
                          ? <>
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd"/>
                              </svg>
                              إيقاف
                            </>
                          : <>
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                              </svg>
                              تفعيل
                            </>
                        }
                      </button>
                    </td>

                    <td className="text-center px-3 py-3 hidden md:table-cell">
                      <Link href={`/dashboard/pos-sales/${b.slug}`}
                        className="text-xs text-green hover:text-green/70 transition-colors">
                        عرض →
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted">لا توجد نتائج</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Toast إشعار ── */}
          {syncToast && (
            <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold transition-all border ${
              syncToast.ok ? "bg-green/10 border-green/30 text-green" : "bg-red/10 border-red/30 text-red"
            }`}>
              {syncToast.msg}
            </div>
          )}

          {/* ── Sync Health Footer ── */}
          <div className="bg-card-hi border border-line rounded-2xl p-4">
            <h3 className="text-cream text-sm font-bold mb-3">حالة المزامنة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.branches
                .filter(b => b.lastSync && b.pos_sync_enabled)
                .sort((a, b) => (b.lastSync! > a.lastSync! ? 1 : -1))
                .slice(0, 6)
                .map(b => (
                  <div key={b.id} className="flex items-center justify-between bg-bg rounded-xl px-3 py-2">
                    <span className="text-muted text-xs">{b.name}</span>
                    <div className="flex items-center gap-2">
                      {syncBadge(b)}
                      <span className="text-muted text-xs">
                        {b.lastSync
                          ? new Date(b.lastSync).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
