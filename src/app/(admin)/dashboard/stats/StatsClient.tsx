"use client";

import { useState, useEffect, useCallback } from "react";

/* ───────── Types ───────── */
interface BranchStat {
  id: string;
  name: string;
  slug: string;
  code: string;
  totalSales: number;
  invoiceCount: number;
  cashVariance: number;
  cash: number;
  network: number;
  transfer: number;
  deferred: number;
  expenses: number;
  reportCount: number;
  reports: ReportRow[];
}

interface ReportRow {
  id: string;
  branch_id: string;
  report_date: string;
  status: string | null;
  total_sales: number;
  invoice_count: number;
  cash_expected: number;
  cash_actual: number;
  cash_difference: number;
  cash: number;
  network: number;
  transfer: number;
  deferred: number;
  expenses: number;
  submitted_at: string;
}

interface DailyTotal {
  date: string;
  sales: number;
  invoices: number;
}

interface Summary {
  totalSales: number;
  totalInvoices: number;
  totalCash: number;
  totalNetwork: number;
  totalTransfer: number;
  totalDeferred: number;
  totalExpenses: number;
  totalCashVariance: number;
  reportCount: number;
  branchCount: number;
}

interface StatsData {
  range: { from: string; to: string };
  summary: Summary;
  branchStats: BranchStat[];
  dailyTotals: DailyTotal[];
}

/* ───────── Helpers ───────── */
function fmt(n: number) {
  return n.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function fmtDate(v: string) {
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(v + "T00:00:00"));
}
function fmtShortDate(v: string) {
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "numeric", month: "short" })
    .format(new Date(v + "T00:00:00"));
}

const PERIODS = [
  { key: "daily",   label: "اليوم" },
  { key: "weekly",  label: "أسبوعي" },
  { key: "monthly", label: "شهري" },
  { key: "yearly",  label: "سنوي" },
  { key: "custom",  label: "مخصص" },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  submitted: { label: "مرفوع",   cls: "bg-sky-500/10 text-sky-300 border-sky-500/20" },
  approved:  { label: "معتمد",   cls: "bg-green/10 text-green border-green/20" },
  flagged:   { label: "ملاحظات", cls: "bg-amber/10 text-amber border-amber/20" },
  draft:     { label: "مسودة",   cls: "bg-card-hi text-muted border-line" },
};

function StatusBadge({ status }: { status: string | null }) {
  const m = STATUS_MAP[status ?? "draft"] ?? STATUS_MAP.draft;
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${m.cls}`}>{m.label}</span>;
}

/* ───────── KPI Card ───────── */
function KpiCard({
  label, value, sub, accent, icon, big,
}: {
  label: string; value: string; sub?: string;
  accent?: "green" | "sky" | "amber" | "purple" | "red" | "teal";
  icon?: string; big?: boolean;
}) {
  const colors: Record<string, string> = {
    green:  "border-green/20 bg-green/5",
    sky:    "border-sky-500/20 bg-sky-500/5",
    amber:  "border-amber/20 bg-amber/5",
    purple: "border-purple-500/20 bg-purple-500/5",
    red:    "border-red/20 bg-red/5",
    teal:   "border-teal-500/20 bg-teal-500/5",
  };
  const textColors: Record<string, string> = {
    green:  "text-green",
    sky:    "text-sky-300",
    amber:  "text-amber",
    purple: "text-purple-300",
    red:    "text-red",
    teal:   "text-teal-300",
  };
  const cardCls = accent ? colors[accent] : "border-line bg-card";
  const valCls  = accent ? textColors[accent] : "text-cream";

  return (
    <div className={`rounded-3xl border p-5 flex flex-col gap-2 ${cardCls}`}>
      <div className="flex items-center justify-between">
        <p className="text-muted text-sm">{label}</p>
        {icon && <span className="text-xl opacity-60">{icon}</span>}
      </div>
      <p className={`font-black ltr-num ${big ? "text-4xl" : "text-3xl"} ${valCls}`} dir="ltr">{value}</p>
      {sub && <p className="text-muted text-xs">{sub}</p>}
    </div>
  );
}

/* ───────── Bar chart ───────── */
function SalesBar({ dailyTotals }: { dailyTotals: DailyTotal[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (dailyTotals.length === 0) return (
    <div className="h-32 flex items-center justify-center text-muted text-sm">لا توجد بيانات</div>
  );
  const max = Math.max(...dailyTotals.map(d => d.sales), 1);
  return (
    <div className="mt-4 relative">
      {/* Tooltip */}
      {hovered !== null && dailyTotals[hovered] && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-line rounded-xl px-3 py-1.5 text-xs text-cream whitespace-nowrap z-10 pointer-events-none">
          {fmtShortDate(dailyTotals[hovered].date)}: <span className="text-green font-bold">{fmt(dailyTotals[hovered].sales)}</span> ريال
        </div>
      )}
      <div className="flex items-end gap-1 h-32" dir="ltr">
        {dailyTotals.map((d, i) => {
          const h = Math.max(4, (d.sales / max) * 100);
          const isTop = d.sales === max;
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-1 min-w-0 cursor-pointer"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className={`w-full rounded-t-md transition-all duration-300 ${isTop ? "bg-green" : hovered === i ? "bg-green/80" : "bg-green/40"}`}
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}
      </div>
      {dailyTotals.length <= 14 && (
        <div className="flex gap-1 mt-1" dir="ltr">
          {dailyTotals.map(d => (
            <div key={d.date} className="flex-1 text-center min-w-0">
              <span className="text-muted text-[9px] truncate block">{fmtShortDate(d.date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── Payment method mini bar ───────── */
function PaymentBar({ cash, network, transfer, deferred }: { cash: number; network: number; transfer: number; deferred: number }) {
  const total = cash + network + transfer + deferred;
  if (total === 0) return <div className="h-2 rounded-full bg-card-hi" />;
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-px">
      {cash > 0    && <div style={{ width: `${(cash/total)*100}%`    }} className="bg-green/70"    title={`كاش: ${fmt(cash)}`} />}
      {network > 0 && <div style={{ width: `${(network/total)*100}%` }} className="bg-sky-500/70"  title={`شبكة: ${fmt(network)}`} />}
      {transfer > 0&& <div style={{ width: `${(transfer/total)*100}%`}} className="bg-purple-500/70" title={`تحويل: ${fmt(transfer)}`} />}
      {deferred > 0&& <div style={{ width: `${(deferred/total)*100}%`}} className="bg-amber/70"   title={`آجل: ${fmt(deferred)}`} />}
    </div>
  );
}

/* ───────── Branch Details Modal ───────── */
function BranchDetailsModal({ branch, onClose }: { branch: BranchStat; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-line rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-line px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <div>
            <h2 className="text-xl font-bold text-cream">{branch.name}</h2>
            <p className="text-muted text-sm mt-0.5">{branch.reportCount} تقرير في الفترة المحددة</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-card-hi border border-line text-muted hover:text-cream flex items-center justify-center text-lg">
            ×
          </button>
        </div>

        {/* Summary cards */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-line bg-card-hi p-4">
            <p className="text-muted text-xs">إجمالي المبيعات</p>
            <p className="text-cream font-bold text-lg mt-1 ltr-num" dir="ltr">{fmt(branch.totalSales)}</p>
            <p className="text-muted text-xs mt-1">ريال</p>
          </div>
          <div className="rounded-2xl border border-green/20 bg-green/5 p-4">
            <p className="text-muted text-xs">الكاش</p>
            <p className="text-green font-bold text-lg mt-1 ltr-num" dir="ltr">{fmt(branch.cash)}</p>
            <p className="text-muted text-xs mt-1">ريال</p>
          </div>
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
            <p className="text-muted text-xs">الشبكة</p>
            <p className="text-sky-300 font-bold text-lg mt-1 ltr-num" dir="ltr">{fmt(branch.network)}</p>
            <p className="text-muted text-xs mt-1">ريال</p>
          </div>
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
            <p className="text-muted text-xs">التحويل</p>
            <p className="text-purple-300 font-bold text-lg mt-1 ltr-num" dir="ltr">{fmt(branch.transfer)}</p>
            <p className="text-muted text-xs mt-1">ريال</p>
          </div>
          <div className="rounded-2xl border border-amber/20 bg-amber/5 p-4">
            <p className="text-muted text-xs">الآجل</p>
            <p className="text-amber font-bold text-lg mt-1 ltr-num" dir="ltr">{fmt(branch.deferred)}</p>
            <p className="text-muted text-xs mt-1">ريال</p>
          </div>
          <div className="rounded-2xl border border-red/20 bg-red/5 p-4">
            <p className="text-muted text-xs">المصروفات</p>
            <p className="text-red font-bold text-lg mt-1 ltr-num" dir="ltr">{fmt(branch.expenses)}</p>
            <p className="text-muted text-xs mt-1">ريال</p>
          </div>
        </div>

        {/* Payment bar */}
        <div className="px-6 pb-4">
          <PaymentBar cash={branch.cash} network={branch.network} transfer={branch.transfer} deferred={branch.deferred} />
          <div className="flex gap-4 mt-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-muted"><span className="w-2 h-2 rounded-full bg-green/70" />كاش</span>
            <span className="flex items-center gap-1 text-xs text-muted"><span className="w-2 h-2 rounded-full bg-sky-500/70" />شبكة</span>
            <span className="flex items-center gap-1 text-xs text-muted"><span className="w-2 h-2 rounded-full bg-purple-500/70" />تحويل</span>
            <span className="flex items-center gap-1 text-xs text-muted"><span className="w-2 h-2 rounded-full bg-amber/70" />آجل</span>
          </div>
        </div>

        {/* Reports table */}
        <div className="px-6 pb-6">
          <h3 className="text-cream font-bold mb-3 border-t border-line pt-4">تفاصيل التقارير</h3>
          {branch.reports.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">لا توجد تقارير في هذه الفترة</p>
          ) : (
            <div className="space-y-2">
              {branch.reports.map(r => (
                <div key={r.id} className="rounded-2xl border border-line bg-card-hi p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div>
                      <p className="text-cream font-medium">{fmtDate(r.report_date)}</p>
                      <p className="text-muted text-xs mt-0.5">
                        {new Intl.DateTimeFormat("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" }).format(new Date(r.submitted_at))}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-bg p-2.5">
                      <p className="text-muted text-[10px]">المبيعات</p>
                      <p className="text-cream font-bold text-sm ltr-num mt-0.5" dir="ltr">{fmt(Number(r.total_sales ?? 0))}</p>
                    </div>
                    <div className="rounded-xl bg-green/5 border border-green/10 p-2.5">
                      <p className="text-muted text-[10px]">الكاش</p>
                      <p className="text-green font-bold text-sm ltr-num mt-0.5" dir="ltr">{fmt(Number(r.cash ?? 0))}</p>
                    </div>
                    <div className="rounded-xl bg-sky-500/5 border border-sky-500/10 p-2.5">
                      <p className="text-muted text-[10px]">الشبكة</p>
                      <p className="text-sky-300 font-bold text-sm ltr-num mt-0.5" dir="ltr">{fmt(Number(r.network ?? 0))}</p>
                    </div>
                    <div className="rounded-xl bg-purple-500/5 border border-purple-500/10 p-2.5">
                      <p className="text-muted text-[10px]">التحويل</p>
                      <p className="text-purple-300 font-bold text-sm ltr-num mt-0.5" dir="ltr">{fmt(Number(r.transfer ?? 0))}</p>
                    </div>
                    <div className="rounded-xl bg-amber/5 border border-amber/10 p-2.5">
                      <p className="text-muted text-[10px]">الآجل</p>
                      <p className="text-amber font-bold text-sm ltr-num mt-0.5" dir="ltr">{fmt(Number(r.deferred ?? 0))}</p>
                    </div>
                    <div className="rounded-xl bg-red/5 border border-red/10 p-2.5">
                      <p className="text-muted text-[10px]">المصروفات</p>
                      <p className="text-red font-bold text-sm ltr-num mt-0.5" dir="ltr">{fmt(Number(r.expenses ?? 0))}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── Main Component ───────── */
export default function StatsClient() {
  const [period, setPeriod] = useState<PeriodKey>("weekly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<BranchStat | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let url = `/api/admin/stats?period=${period}`;
      if (period === "custom") {
        if (!customFrom || !customTo) { setLoading(false); return; }
        url += `&from=${customFrom}&to=${customTo}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "خطأ في التحميل"); setLoading(false); return; }
      setData(json);
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => {
    if (period !== "custom") load();
  }, [period, load]);

  const s = data?.summary;
  const avgPerReport = s && s.reportCount > 0 ? s.totalSales / s.reportCount : 0;
  const activeBranches = data?.branchStats.filter(b => b.reportCount > 0) ?? [];
  const topBranch  = activeBranches.length > 0
    ? activeBranches.reduce((a, b) => b.totalSales > a.totalSales ? b : a)
    : null;
  const worstBranch = activeBranches.length > 0
    ? activeBranches.reduce((a, b) => b.totalSales < a.totalSales ? b : a)
    : null;

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/10 px-3 py-1 text-xs text-green mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          تقارير مباشرة
        </div>
        <h1 className="text-4xl font-black text-cream">الإحصائيات</h1>
        <p className="text-muted text-sm mt-1">ملخص شامل لأداء الفروع حسب الفترة الزمنية</p>
      </div>

      {/* Period Selector */}
      <div className="bg-card border border-line rounded-3xl p-5 mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-2xl px-5 py-2.5 text-sm font-bold transition-all ${
                period === p.key
                  ? "bg-green text-white shadow-lg shadow-green/20"
                  : "bg-card-hi border border-line text-muted hover:text-cream hover:border-green/30"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4 mt-2">
            <div>
              <label className="text-muted text-xs block mb-1">من تاريخ</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="bg-bg border border-line rounded-xl px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-green/50" />
            </div>
            <div>
              <label className="text-muted text-xs block mb-1">إلى تاريخ</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="bg-bg border border-line rounded-xl px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-green/50" />
            </div>
            <button onClick={load} disabled={!customFrom || !customTo || loading}
              className="bg-green hover:bg-green-dark disabled:opacity-50 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-colors">
              {loading ? "جاري التحميل..." : "عرض"}
            </button>
          </div>
        )}

        {data && (
          <p className="text-muted text-xs mt-2 pt-2 border-t border-line">
            📅 الفترة: {fmtDate(data.range.from)} — {fmtDate(data.range.to)}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red/20 bg-red/10 px-4 py-3 text-sm text-red mb-6">{error}</div>
      )}

      {loading && !data && (
        <div className="flex flex-col items-center py-20 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-green border-t-transparent animate-spin" />
          <p className="text-muted text-sm">جاري تحميل البيانات...</p>
        </div>
      )}

      {data && s && (
        <>
          {/* ── Row 1: الأرقام الكبيرة ── */}
          <div className="grid gap-4 mb-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="إجمالي المبيعات"
              value={fmt(s.totalSales)}
              sub="ريال سعودي"
              accent="sky"
              icon="📊"
              big
            />
            <KpiCard
              label="الكاش"
              value={fmt(s.totalCash)}
              sub="إجمالي مبالغ الكاش"
              accent="green"
              icon="💵"
              big
            />
            <KpiCard
              label="الشبكة"
              value={fmt(s.totalNetwork)}
              sub="مدفوعات POS والبطاقات"
              accent="sky"
              icon="💳"
            />
            <KpiCard
              label="التحويل البنكي"
              value={fmt(s.totalTransfer)}
              sub="تحويلات بنكية"
              accent="purple"
              icon="🏦"
            />
          </div>

          {/* ── Row 2: أرقام إضافية ── */}
          <div className="grid gap-4 mb-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="الآجل"
              value={fmt(s.totalDeferred)}
              sub="مبيعات مؤجلة الدفع"
              accent="amber"
              icon="📋"
            />
            <KpiCard
              label="المصروفات"
              value={fmt(s.totalExpenses)}
              sub="مجموع مصروفات الفروع"
              accent="red"
              icon="🧾"
            />
            <KpiCard
              label="التقارير المستلمة"
              value={String(s.reportCount)}
              sub={`متوسط ${fmt(avgPerReport)} ريال / تقرير`}
              icon="📁"
            />
            <div className="rounded-3xl border border-line bg-card p-5 flex flex-col gap-1">
              <p className="text-muted text-sm">الفروع النشطة</p>
              <p className="font-black text-3xl text-cream" dir="ltr">{activeBranches.length}</p>
              <p className="text-muted text-xs">من أصل {s.branchCount} فرع</p>
            </div>
          </div>

          {/* ── Row 3: أعلى وأسوأ فرع ── */}
          <div className="grid gap-4 mb-6 sm:grid-cols-2">
            <div className="rounded-3xl border border-teal-500/20 bg-teal-500/5 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-2xl flex-shrink-0">🏆</div>
              <div className="min-w-0">
                <p className="text-muted text-xs mb-1">أعلى فرع مبيعاً</p>
                <p className="text-teal-300 font-black text-xl truncate">{topBranch?.name ?? "—"}</p>
                <p className="text-muted text-xs mt-0.5">
                  {topBranch && topBranch.totalSales > 0 ? `${fmt(topBranch.totalSales)} ريال` : "لا توجد بيانات"}
                </p>
              </div>
            </div>
            <div className="rounded-3xl border border-red/20 bg-red/5 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red/10 border border-red/20 flex items-center justify-center text-2xl flex-shrink-0">📉</div>
              <div className="min-w-0">
                <p className="text-muted text-xs mb-1">أسوأ فرع مبيعاً</p>
                <p className="text-red font-black text-xl truncate">{worstBranch?.name ?? "—"}</p>
                <p className="text-muted text-xs mt-0.5">
                  {worstBranch && worstBranch.totalSales > 0 ? `${fmt(worstBranch.totalSales)} ريال` : "لا توجد بيانات"}
                </p>
              </div>
            </div>
          </div>

          {/* ── طرق الدفع (Stacked visual) ── */}
          {s.totalSales > 0 && (
            <div className="rounded-3xl border border-line bg-card p-5 sm:p-6 mb-6">
              <h2 className="text-lg font-bold text-cream mb-1">توزيع طرق الدفع</h2>
              <p className="text-muted text-xs mb-4">نسبة كل طريقة دفع من إجمالي المبيعات</p>
              <PaymentBar cash={s.totalCash} network={s.totalNetwork} transfer={s.totalTransfer} deferred={s.totalDeferred} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {[
                  { label: "كاش", val: s.totalCash, color: "bg-green/70", text: "text-green" },
                  { label: "شبكة", val: s.totalNetwork, color: "bg-sky-500/70", text: "text-sky-300" },
                  { label: "تحويل", val: s.totalTransfer, color: "bg-purple-500/70", text: "text-purple-300" },
                  { label: "آجل", val: s.totalDeferred, color: "bg-amber/70", text: "text-amber" },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl border border-line bg-card-hi p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      <span className="text-muted text-xs">{item.label}</span>
                    </div>
                    <p className={`font-bold text-base ltr-num ${item.text}`} dir="ltr">{fmt(item.val)}</p>
                    <p className="text-muted text-xs mt-0.5">
                      {s.totalSales > 0 ? `${((item.val / s.totalSales) * 100).toFixed(1)}%` : "0%"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── مبيعات يومية ── */}
          {data.dailyTotals.length > 1 && (
            <div className="rounded-3xl border border-line bg-card p-5 sm:p-6 mb-6">
              <h2 className="text-lg font-bold text-cream mb-1">المبيعات اليومية</h2>
              <p className="text-muted text-xs">توزيع المبيعات خلال الفترة المحددة (مرر على الأعمدة للتفاصيل)</p>
              <SalesBar dailyTotals={data.dailyTotals} />
            </div>
          )}

          {/* ── تفاصيل الفروع ── */}
          <div className="rounded-3xl border border-line bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-cream">تفاصيل الفروع</h2>
                <p className="text-muted text-xs mt-1">مرتبة من الأعلى مبيعاً — اضغط التفاصيل لعرض تقارير كل فرع</p>
              </div>
              <span className="text-muted text-xs bg-card-hi border border-line rounded-full px-3 py-1">
                {data.branchStats.filter(b => b.reportCount > 0).length} / {data.branchStats.length} فرع
              </span>
            </div>

            {data.branchStats.length === 0 ? (
              <p className="text-muted text-center py-8">لا توجد بيانات في هذه الفترة</p>
            ) : (
              <div className="space-y-3">
                {[...data.branchStats]
                  .sort((a, b) => b.totalSales - a.totalSales)
                  .map(branch => {
                    const maxSales = Math.max(...data.branchStats.map(b => b.totalSales), 1);
                    const pct = branch.totalSales > 0 ? Math.max(3, (branch.totalSales / maxSales) * 100) : 0;
                    const hasReports = branch.reportCount > 0;
                    return (
                      <div key={branch.id}
                        className={`rounded-2xl border p-4 transition-all ${hasReports ? "border-line bg-card-hi hover:border-green/20" : "border-line/50 bg-card-hi/50 opacity-50"}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            {/* Branch name & badges */}
                            <div className="flex items-center gap-2 flex-wrap mb-3">
                              <p className="font-bold text-cream">{branch.name}</p>
                              {hasReports ? (
                                <span className="text-xs text-green bg-green/10 border border-green/20 rounded-full px-2 py-0.5">
                                  {branch.reportCount} تقرير
                                </span>
                              ) : (
                                <span className="text-xs text-muted bg-card border border-line rounded-full px-2 py-0.5">
                                  لا يوجد تقرير
                                </span>
                              )}
                            </div>

                            {/* Payment breakdown */}
                            {hasReports && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                <div className="rounded-xl bg-green/5 border border-green/10 p-2">
                                  <p className="text-[10px] text-muted">كاش</p>
                                  <p className="text-green font-bold text-sm ltr-num" dir="ltr">{fmt(branch.cash)}</p>
                                </div>
                                <div className="rounded-xl bg-sky-500/5 border border-sky-500/10 p-2">
                                  <p className="text-[10px] text-muted">شبكة</p>
                                  <p className="text-sky-300 font-bold text-sm ltr-num" dir="ltr">{fmt(branch.network)}</p>
                                </div>
                                <div className="rounded-xl bg-purple-500/5 border border-purple-500/10 p-2">
                                  <p className="text-[10px] text-muted">تحويل</p>
                                  <p className="text-purple-300 font-bold text-sm ltr-num" dir="ltr">{fmt(branch.transfer)}</p>
                                </div>
                                <div className="rounded-xl bg-amber/5 border border-amber/10 p-2">
                                  <p className="text-[10px] text-muted">آجل</p>
                                  <p className="text-amber font-bold text-sm ltr-num" dir="ltr">{fmt(branch.deferred)}</p>
                                </div>
                              </div>
                            )}

                            {/* Progress bar */}
                            <PaymentBar cash={branch.cash} network={branch.network} transfer={branch.transfer} deferred={branch.deferred} />
                            <div className="flex justify-between mt-1.5">
                              <span className="text-cream text-xs font-bold">{fmt(branch.totalSales)} ريال</span>
                              {branch.expenses > 0 && (
                                <span className="text-red text-xs">مصروفات: {fmt(branch.expenses)}</span>
                              )}
                            </div>
                          </div>
                          {hasReports && (
                            <button
                              onClick={() => setSelectedBranch(branch)}
                              className="rounded-xl bg-green/10 border border-green/20 text-green hover:bg-green/20 px-4 py-2 text-sm font-bold transition-colors flex-shrink-0 self-start"
                            >
                              التفاصيل
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Branch Details Modal */}
      {selectedBranch && (
        <BranchDetailsModal branch={selectedBranch} onClose={() => setSelectedBranch(null)} />
      )}
    </div>
  );
}
