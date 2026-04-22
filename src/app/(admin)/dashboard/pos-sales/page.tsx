"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Period = "today" | "yesterday" | "week" | "month";

interface BranchStat {
  id: string; name: string; slug: string; code: string; is_active: boolean;
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
  if (!b.lastSync) return <span className="text-xs px-2 py-1 rounded-full bg-red/10 text-red">لم يزامن</span>;
  const mins = Math.floor((Date.now() - new Date(b.lastSync).getTime()) / 60000);
  if (b.lastSyncStatus === "failed") return <span className="text-xs px-2 py-1 rounded-full bg-red/10 text-red">فشل</span>;
  if (mins < 60) return <span className="text-xs px-2 py-1 rounded-full bg-green/10 text-green">منذ {mins}د</span>;
  if (mins < 1440) return <span className="text-xs px-2 py-1 rounded-full bg-amber/10 text-amber">منذ {Math.floor(mins/60)}س</span>;
  return <span className="text-xs px-2 py-1 rounded-full bg-red/10 text-red">منذ {Math.floor(mins/1440)}ي</span>;
}

export default function PosSalesPage() {
  const [period, setPeriod]   = useState<Period>("today");
  const [data, setData]       = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

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
          <h1 className="text-2xl font-bold text-cream">🖥️ مبيعات Aronium POS</h1>
          <p className="text-muted text-sm mt-1">
            {data ? `${data.range.from === data.range.to ? data.range.from : `${data.range.from} → ${data.range.to}`}` : "جاري التحميل..."}
          </p>
        </div>
        <button
          onClick={() => load(period)}
          className="flex items-center gap-2 bg-card border border-line text-muted hover:text-cream px-4 py-2 rounded-xl text-sm transition-colors"
        >
          🔄 تحديث
        </button>
      </div>

      {/* ── Period Tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {periods.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              period === p.key
                ? "bg-green text-white"
                : "bg-card border border-line text-muted hover:text-cream"
            }`}
          >
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
              <p className="text-green font-bold text-xl">
                {data.summary.branchesWithData} / {data.summary.branchesTotal}
              </p>
              <p className="text-muted text-xs">فرع</p>
            </div>
            <div className="bg-card border border-amber/20 rounded-2xl p-4 text-center">
              <p className="text-muted text-xs mb-1">زامنت اليوم</p>
              <p className="text-amber font-bold text-xl">
                {data.summary.syncedBranches} / {data.summary.branchesTotal}
              </p>
              <p className="text-muted text-xs">فرع</p>
            </div>
          </div>

          {/* ── Payment Methods ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "💵 كاش",         val: data.summary.totalCash,     color: "green" },
              { label: "💳 شبكة",         val: data.summary.totalNetwork,  color: "sky-400" },
              { label: "🏦 تحويل",        val: data.summary.totalTransfer, color: "purple-400" },
              { label: "📋 آجل",          val: data.summary.totalDeferred, color: "amber" },
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
          <input
            type="text"
            placeholder="بحث عن فرع..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm bg-card border border-line rounded-xl px-4 py-2 text-cream text-sm placeholder:text-muted focus:outline-none focus:border-green/50"
          />

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
                  <th className="text-center px-3 py-3 hidden md:table-cell">تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => (
                  <tr
                    key={b.id}
                    className={`border-b border-line/50 transition-colors hover:bg-card-hi ${
                      b.invoiceCount === 0 ? "opacity-50" : ""
                    } ${i % 2 === 0 ? "" : "bg-card-hi/30"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-cream">{b.name}</div>
                      {b.code && <div className="text-muted text-xs">{b.code}</div>}
                    </td>
                    <td className="text-center px-3 py-3 hidden md:table-cell">
                      <span className={`font-bold ltr-num ${b.totalSales > 0 ? "text-green" : "text-muted"}`} dir="ltr">
                        {fmtNum(b.totalSales)}
                      </span>
                    </td>
                    <td className="text-center px-3 py-3 hidden md:table-cell text-cream">
                      {b.invoiceCount}
                    </td>
                    <td className="text-center px-3 py-3 hidden lg:table-cell text-muted ltr-num" dir="ltr">
                      {fmtNum(b.cash)}
                    </td>
                    <td className="text-center px-3 py-3 hidden lg:table-cell text-muted ltr-num" dir="ltr">
                      {fmtNum(b.network)}
                    </td>
                    <td className="text-center px-3 py-3">
                      {syncBadge(b)}
                    </td>
                    <td className="text-center px-3 py-3 hidden md:table-cell">
                      <Link
                        href={`/dashboard/pos-sales/${b.slug}`}
                        className="text-xs text-green hover:text-green/70 transition-colors"
                      >
                        عرض →
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted">
                      لا توجد نتائج
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Sync Health Footer ── */}
          <div className="bg-card-hi border border-line rounded-2xl p-4">
            <h3 className="text-cream text-sm font-bold mb-3">🔄 حالة المزامنة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.branches
                .filter(b => b.lastSync)
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
