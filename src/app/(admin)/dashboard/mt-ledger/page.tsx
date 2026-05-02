"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AddEntryModal from "@/components/accounting/AddEntryModal";

/* ─── helpers ─── */
const fmt = (v: number, dec = 2) =>
  v.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtDate = (d: string) =>
  d ? new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "numeric", month: "long", year: "numeric" })
        .format(new Date(`${d}T00:00:00`)) : "—";

function todayStr() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function monthStart() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}

/* ─── types ─── */
interface Transaction {
  id: string; entryId: string; entryNumber: string; entryDate: string;
  hijriDate?: string; description: string; lineDescription?: string;
  referenceNumber?: string; entryType: string; sourceType: string;
  notes?: string; debit: number; credit: number;
  quantity?: number; unitPrice?: number; itemType?: string;
  runningBalance: number;
}
interface Summary { openingBalance: number; totalDebit: number; totalCredit: number; balance: number; }
interface SupplierInfo {
  id: string; name: string; phone?: string; notes?: string;
  opening_balance?: number; opening_balance_date?: string;
  credit_limit?: number; payment_terms_days?: number;
  tax_number?: string;
}

const entryTypeLabels: Record<string, { ar: string; color: string; bg: string }> = {
  purchase:   { ar: "فاتورة شراء",   color: "#b45309", bg: "rgba(180,83,9,0.08)"   },
  payment:    { ar: "دفعة",           color: "#166534", bg: "rgba(22,101,52,0.08)"  },
  adjustment: { ar: "تسوية",          color: "#6b21a8", bg: "rgba(107,33,168,0.08)" },
  opening:    { ar: "رصيد افتتاحي",  color: "#0369a1", bg: "rgba(3,105,161,0.08)"  },
  standard:   { ar: "قيد يومية",      color: "#374151", bg: "rgba(55,65,81,0.08)"   },
  reversing:  { ar: "عكسي",           color: "#dc2626", bg: "rgba(220,38,38,0.08)"  },
};

const itemTypeLabels: Record<string, string> = {
  hashi: "حاشي", sheep: "غنم", beef: "عجل", offal: "مخلفات", other: "أخرى",
};

/* ══════ KPI Card ══════ */
function KPICard({ title, value, sub, accent }: {
  title: string; value: string; sub?: string; accent: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#2a3830] bg-[#0f1511] p-5">
      <p className="text-xs font-semibold mb-1" style={{ color: accent, opacity: 0.75 }}>{title}</p>
      <p className="text-2xl font-black tabular-nums" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs mt-0.5 text-[#6a7870]">{sub}</p>}
    </div>
  );
}

/* ══════ Main Page ══════ */
export default function MtLedgerPage() {
  const router = useRouter();

  const [resolving, setResolving]     = useState(true);
  const [supplierId, setSupplierId]   = useState<string | null>(null);
  const [supplier, setSupplier]       = useState<SupplierInfo | null>(null);
  const [transactions, setTrans]      = useState<Transaction[]>([]);
  const [summary, setSummary]         = useState<Summary | null>(null);
  const [loading, setLoading]         = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [voidingId, setVoidingId]     = useState<string | null>(null);
  const [searchQ, setSearchQ]         = useState("");
  const [filterType, setFilterType]   = useState("all");
  const [range, setRange]             = useState({ from: monthStart(), to: todayStr() });

  /* ── الخطوة الأولى: جلب ID محمد طه ── */
  useEffect(() => {
    async function resolve() {
      try {
        const res  = await fetch("/api/suppliers");
        const json = await res.json();
        const list: any[] = json.suppliers ?? [];
        // ابحث عن محمد طه بالاسم
        const mt = list.find(s =>
          s.name.includes("محمد طه") || s.name.toLowerCase().includes("mohammed taha")
        );
        if (mt) setSupplierId(mt.id);
        else {
          // إذا لم يوجد، خذ أول مورد أو أظهر رسالة
          if (list.length > 0) setSupplierId(list[0].id);
        }
      } finally { setResolving(false); }
    }
    resolve();
  }, []);

  /* ── تحميل الدفتر ── */
  const load = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    try {
      const qs  = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetch(`/api/suppliers/${supplierId}/ledger?${qs}`);
      if (!res.ok) return;
      const json = await res.json();
      setSupplier(json.supplier);
      setTrans(json.transactions ?? []);
      setSummary(json.summary ?? null);
    } finally { setLoading(false); }
  }, [supplierId, range]);

  useEffect(() => { if (supplierId) load(); }, [supplierId, load]);

  async function handleVoid(entryId: string) {
    if (!confirm("هل أنت متأكد من إلغاء هذا القيد؟")) return;
    const reason = prompt("سبب الإلغاء (اختياري):") ?? "";
    setVoidingId(entryId);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/ledger`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, voidReason: reason }),
      });
      if (res.ok) load();
    } finally { setVoidingId(null); }
  }

  function applyPreset(preset: string) {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    const pad = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (preset === "today")  { const s = pad(now); setRange({ from: s, to: s }); }
    if (preset === "week")   { const s = new Date(now); s.setDate(now.getDate()-7); setRange({ from: pad(s), to: pad(now) }); }
    if (preset === "month")  { setRange({ from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`, to: pad(now) }); }
    if (preset === "3month") { const s = new Date(now); s.setMonth(now.getMonth()-3); setRange({ from: pad(s), to: pad(now) }); }
    if (preset === "year")   { setRange({ from: `${now.getFullYear()}-01-01`, to: pad(now) }); }
    if (preset === "all")    { setRange({ from: "2020-01-01", to: pad(now) }); }
  }

  const filtered = transactions.filter(t => {
    const q = searchQ.toLowerCase();
    const matchQ = !q || t.description.toLowerCase().includes(q)
      || (t.referenceNumber ?? "").toLowerCase().includes(q)
      || (t.entryNumber ?? "").toLowerCase().includes(q);
    return matchQ && (filterType === "all" || t.entryType === filterType);
  });

  const balance = summary?.balance ?? 0;

  /* ── شاشة التحميل الأولي ── */
  if (resolving) {
    return (
      <div className="min-h-screen bg-[#0a0f0c] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#3fa66a] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!supplierId) {
    return (
      <div className="min-h-screen bg-[#0a0f0c] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-lg font-bold mb-2">لم يُعثر على المورد "محمد طه"</p>
          <p className="text-[#6a7870] text-sm mb-4">أضفه أولاً من صفحة الموردين</p>
          <button onClick={() => router.push("/dashboard/suppliers")}
            className="rounded-2xl bg-[#3fa66a] px-6 py-3 text-sm font-bold text-white">
            الذهاب للموردين
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f0c] text-white" dir="rtl">
      {/* ─── Print CSS ─── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-only { visibility: visible !important; display: block !important;
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100% !important; background: white !important; z-index: 99999 !important; }
          .print-only * { visibility: visible !important; }
          @page { size: A4 portrait; margin: 12mm 10mm; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(63,166,106,0.05),transparent_60%)] pointer-events-none no-print" />

      <div className="relative max-w-7xl mx-auto px-6 py-8 no-print">

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#3fa66a]/20 bg-[#3fa66a]/10 px-3 py-1 text-xs text-[#3fa66a] mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3fa66a] animate-pulse" />
              النظام المحاسبي
            </div>
            <h1 className="text-3xl font-black">محمد طه</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-[#6a7870]">
              {supplier?.phone && <span dir="ltr">{supplier.phone}</span>}
              {supplier?.payment_terms_days && <span>شروط الدفع: {supplier.payment_terms_days} يوم</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard/purchases-review")}
              className="rounded-2xl bg-[#1a2420] border border-[#2a3830] hover:border-amber-500/30 px-5 py-2.5 text-sm font-bold text-[#6a7870] hover:text-amber-400">
              مراجعة المشتريات
            </button>
            <button onClick={() => window.print()}
              className="rounded-2xl bg-[#1a2420] border border-[#2a3830] hover:border-[#3fa66a]/40 px-5 py-2.5 text-sm font-bold text-[#6a7870] hover:text-[#3fa66a] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              طباعة كشف الحساب
            </button>
            <button onClick={() => setShowModal(true)}
              className="rounded-2xl bg-[#3fa66a] hover:bg-[#2d7a4e] px-6 py-2.5 text-sm font-black text-white">
              + قيد جديد
            </button>
          </div>
        </div>

        {/* ─── KPIs ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            title="الرصيد الحالي"
            value={`${fmt(Math.abs(balance))} ر.س`}
            sub={balance > 5 ? "مستحق على الشركة" : balance < -5 ? "رصيد دائن" : "مسدّد بالكامل"}
            accent={balance > 5 ? "#d97706" : balance < -5 ? "#16a34a" : "#6b7280"}
          />
          <KPICard
            title="إجمالي المشتريات"
            value={`${fmt(summary?.totalDebit ?? 0)} ر.س`}
            sub="مجموع الفواتير"
            accent="#d97706"
          />
          <KPICard
            title="إجمالي المدفوعات"
            value={`${fmt(summary?.totalCredit ?? 0)} ر.س`}
            sub="مجموع الدفعات"
            accent="#16a34a"
          />
          <KPICard
            title="عدد الحركات"
            value={String(transactions.length)}
            sub="في الفترة المحددة"
            accent="#7c3aed"
          />
        </div>

        {/* ─── Filters ─── */}
        <div className="rounded-[20px] border border-[#2a3830] bg-[#0f1511] p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Presets */}
            {["today","week","month","3month","year","all"].map(p => (
              <button key={p} onClick={() => applyPreset(p)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium border border-[#2a3830] text-[#6a7870] hover:border-[#3fa66a]/40 hover:text-[#3fa66a] bg-[#1a2420]">
                {{ today:"اليوم", week:"أسبوع", month:"الشهر", "3month":"3 أشهر", year:"السنة", all:"الكل" }[p]}
              </button>
            ))}
            <div className="h-4 w-px bg-[#2a3830]" />
            <div className="flex items-center gap-2">
              <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
                className="rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-1.5 text-white text-xs focus:outline-none" />
              <span className="text-[#6a7870] text-xs">—</span>
              <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
                className="rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-1.5 text-white text-xs focus:outline-none" />
            </div>
            <div className="h-4 w-px bg-[#2a3830]" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-1.5 text-white text-xs focus:outline-none">
              <option value="all">كل الأنواع</option>
              <option value="purchase">فواتير الشراء</option>
              <option value="payment">الدفعات</option>
              <option value="adjustment">التسويات</option>
              <option value="opening">الرصيد الافتتاحي</option>
            </select>
            <div className="flex-1 min-w-[180px]">
              <input type="text" placeholder="بحث بالوصف أو رقم الفاتورة..."
                value={searchQ} onChange={e => setSearchQ(e.target.value)}
                className="w-full rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-1.5 text-white text-xs placeholder:text-[#4a5550] focus:outline-none" />
            </div>
            <button onClick={load}
              className="rounded-xl bg-[#1a2420] border border-[#2a3830] px-4 py-1.5 text-xs text-[#6a7870] hover:text-white">
              تحديث
            </button>
          </div>
        </div>

        {/* ─── Table ─── */}
        <div className="rounded-[20px] border border-[#2a3830] bg-[#0f1511] overflow-hidden">
          <div className="bg-[#0a0f0c] border-b border-[#2a3830] px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-black">كشف حساب — محمد طه</span>
              <span className="text-xs text-[#6a7870]">{filtered.length} حركة · {fmtDate(range.from)} — {fmtDate(range.to)}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#6a7870]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> مدين
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> دائن
              </span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-[#3fa66a] border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-[#6a7870] text-sm">جاري تحميل الحركات...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[#6a7870] text-lg font-medium mb-2">لا توجد حركات محاسبية</p>
              <p className="text-[#4a5550] text-sm mb-6">ابدأ بإضافة فاتورة شراء أو رصيد افتتاحي</p>
              <button onClick={() => setShowModal(true)}
                className="rounded-2xl bg-[#3fa66a] hover:bg-[#2d7a4e] px-6 py-3 text-sm font-black text-white">
                أضف أول قيد
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ tableLayout:"fixed", minWidth:"800px" }}>
                <colgroup>
                  <col style={{ width:"110px" }} /><col style={{ width:"90px" }} />
                  <col /><col style={{ width:"90px" }} />
                  <col style={{ width:"110px" }} /><col style={{ width:"110px" }} />
                  <col style={{ width:"120px" }} /><col style={{ width:"50px" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#2a3830] text-[#6a7870] text-xs">
                    <th className="px-4 py-3 text-right">التاريخ</th>
                    <th className="px-4 py-3 text-right">رقم القيد</th>
                    <th className="px-4 py-3 text-right">البيان</th>
                    <th className="px-4 py-3 text-right">النوع</th>
                    <th className="px-4 py-3 text-center text-amber-500">مدين</th>
                    <th className="px-4 py-3 text-center text-green-500">دائن</th>
                    <th className="px-4 py-3 text-center">الرصيد</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {summary && summary.openingBalance !== 0 && (
                    <tr className="border-b border-[#2a3830]/50 bg-[#0369a1]/5">
                      <td className="px-4 py-3 text-[#6a7870] text-xs">{fmtDate(supplier?.opening_balance_date ?? "")}</td>
                      <td className="px-4 py-3 text-[#6a7870] text-xs">—</td>
                      <td className="px-4 py-3 text-[#a0c4ff] font-medium text-sm">رصيد مرحّل / افتتاحي</td>
                      <td className="px-4 py-3">
                        <span className="rounded-lg px-2 py-0.5 text-[10px] font-bold bg-[#0369a1]/10 text-[#60aeff]">افتتاحي</span>
                      </td>
                      <td className="px-4 py-3 text-center text-amber-400 font-bold tabular-nums">
                        {summary.openingBalance > 0 ? fmt(summary.openingBalance) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-green-400 font-bold tabular-nums">
                        {summary.openingBalance < 0 ? fmt(Math.abs(summary.openingBalance)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-black tabular-nums" style={{ color: summary.openingBalance > 0 ? "#d97706" : "#16a34a" }}>
                        {fmt(Math.abs(summary.openingBalance))}
                      </td>
                      <td />
                    </tr>
                  )}

                  {filtered.map((t, i) => {
                    const ti = entryTypeLabels[t.entryType] ?? entryTypeLabels.standard;
                    const bal = t.runningBalance;
                    return (
                      <tr key={t.id}
                        className={`border-b border-[#2a3830]/40 hover:bg-[#1a2420]/60 transition-colors ${i%2===0 ? "" : "bg-[#0a0c0b]"}`}>
                        <td className="px-4 py-3.5">
                          <div className="text-white text-xs font-medium">{fmtDate(t.entryDate)}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[#6a7870] text-xs font-mono">{t.entryNumber ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-white font-medium text-sm truncate">{t.description}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {t.referenceNumber && (
                              <span className="text-[10px] text-[#3fa66a] font-mono bg-[#3fa66a]/8 px-1.5 py-0.5 rounded">
                                #{t.referenceNumber}
                              </span>
                            )}
                            {t.itemType && (
                              <span className="text-[10px] text-amber-400 bg-amber-500/8 px-1.5 py-0.5 rounded">
                                {itemTypeLabels[t.itemType] ?? t.itemType}
                              </span>
                            )}
                            {t.quantity && <span className="text-[10px] text-[#6a7870]">{fmt(t.quantity,0)} رأس</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded-xl px-2.5 py-1 text-[10px] font-bold" style={{ background: ti.bg, color: ti.color }}>
                            {ti.ar}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {t.debit > 0
                            ? <span className="text-amber-400 font-black tabular-nums text-sm">{fmt(t.debit)}</span>
                            : <span className="text-[#2a3830]">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {t.credit > 0
                            ? <span className="text-green-400 font-black tabular-nums text-sm">{fmt(t.credit)}</span>
                            : <span className="text-[#2a3830]">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`font-black tabular-nums text-sm ${
                            bal > 5 ? "text-amber-300" : bal < -5 ? "text-green-300" : "text-[#6a7870]"}`}>
                            {fmt(Math.abs(bal))}
                            {bal !== 0 && <span className="text-[9px] ml-1 opacity-60">{bal > 0 ? "م" : "د"}</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button onClick={() => handleVoid(t.entryId)} disabled={voidingId === t.entryId}
                            title="إلغاء القيد"
                            className="w-7 h-7 rounded-lg hover:bg-red-500/15 text-[#4a5550] hover:text-red-400 text-xs disabled:opacity-30">
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1a2420] border-t-2 border-[#3fa66a]/20 font-black">
                    <td colSpan={4} className="px-4 py-4 text-white text-sm">
                      الإجمالي
                      <span className="text-[#6a7870] text-xs font-normal mr-2">({filtered.length} حركة)</span>
                    </td>
                    <td className="px-4 py-4 text-center text-amber-300 text-base tabular-nums">
                      {fmt(filtered.reduce((s,t) => s+t.debit, 0))}
                    </td>
                    <td className="px-4 py-4 text-center text-green-300 text-base tabular-nums">
                      {fmt(filtered.reduce((s,t) => s+t.credit, 0))}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className={`text-lg font-black tabular-nums rounded-xl px-3 py-1 inline-block ${
                        balance > 5 ? "bg-amber-500/10 text-amber-300" :
                        balance < -5 ? "bg-green-500/10 text-green-300" : "bg-[#2a3830] text-white"}`}>
                        {fmt(Math.abs(balance))} ر.س
                      </div>
                      <div className="text-[10px] mt-0.5 text-[#6a7870]">
                        {balance > 5 ? "مستحق للمورد" : balance < -5 ? "رصيد لصالحك" : "متوازن"}
                      </div>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* تحذير تجاوز حد الائتمان */}
        {supplier?.credit_limit && balance > supplier.credit_limit && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="font-bold text-red-400 text-sm">تجاوز حد الائتمان</p>
            <p className="text-red-300/70 text-xs mt-0.5">
              الرصيد الحالي ({fmt(balance)} ر.س) تجاوز حد الائتمان ({fmt(supplier.credit_limit)} ر.س)
            </p>
          </div>
        )}
      </div>

      {/* ════════════════════════════════
          قالب الطباعة — يظهر عند print فقط
      ════════════════════════════════ */}
      <div className="print-only" style={{
        fontFamily: "'Arial', 'Tahoma', sans-serif",
        direction: "rtl", color: "#000", background: "#fff",
        padding: "0", fontSize: "11px",
      }}>
        {/* رأس الكشف */}
        <div style={{ borderBottom: "3px solid #1a6b3a", paddingBottom: "14px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: "20px", fontWeight: "900", margin: 0, color: "#1a6b3a" }}>
                كشف حساب مورد
              </h1>
              <p style={{ fontSize: "13px", fontWeight: "bold", margin: "4px 0 0", color: "#000" }}>
                شركة الشمال للمواشي
              </p>
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "10px", color: "#555" }}>
                تاريخ الطباعة: {new Date().toLocaleDateString("ar-SA-u-nu-latn", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#555" }}>
                الفترة: {fmtDate(range.from)} — {fmtDate(range.to)}
              </p>
            </div>
          </div>
        </div>

        {/* بيانات المورد */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px", background: "#f5f5f5", border: "1px solid #ddd",
          borderRadius: "6px", padding: "10px", marginBottom: "16px",
        }}>
          <div>
            <span style={{ fontSize: "9px", color: "#666", display: "block" }}>اسم المورد</span>
            <span style={{ fontWeight: "bold", fontSize: "13px" }}>{supplier?.name ?? "محمد طه"}</span>
          </div>
          {supplier?.phone && (
            <div>
              <span style={{ fontSize: "9px", color: "#666", display: "block" }}>رقم الجوال</span>
              <span style={{ fontWeight: "bold", direction: "ltr", display: "block" }}>{supplier.phone}</span>
            </div>
          )}
          {supplier?.tax_number && (
            <div>
              <span style={{ fontSize: "9px", color: "#666", display: "block" }}>الرقم الضريبي</span>
              <span style={{ fontWeight: "bold" }}>{supplier.tax_number}</span>
            </div>
          )}
        </div>

        {/* ملخص الحساب */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: "6px", marginBottom: "16px",
        }}>
          {[
            { label: "الرصيد الافتتاحي",   value: fmt(Math.abs(summary?.openingBalance ?? 0)), color: "#1a6b3a" },
            { label: "إجمالي المشتريات",   value: fmt(summary?.totalDebit ?? 0),    color: "#b45309" },
            { label: "إجمالي المدفوعات",   value: fmt(summary?.totalCredit ?? 0),   color: "#166534" },
            {
              label: balance > 5 ? "الرصيد المستحق" : balance < -5 ? "رصيد لصالحكم" : "الرصيد",
              value: fmt(Math.abs(balance)),
              color: balance > 5 ? "#b45309" : balance < -5 ? "#166534" : "#333",
            },
          ].map((item, i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid #ddd", borderTop: `3px solid ${item.color}`,
              borderRadius: "4px", padding: "8px", textAlign: "center",
            }}>
              <p style={{ fontSize: "9px", color: "#666", margin: "0 0 4px" }}>{item.label}</p>
              <p style={{ fontSize: "13px", fontWeight: "900", color: item.color, margin: 0 }}>{item.value} ر.س</p>
            </div>
          ))}
        </div>

        {/* جدول الحركات */}
        <table style={{
          width: "100%", borderCollapse: "collapse", fontSize: "9.5px",
        }}>
          <thead>
            <tr style={{ background: "#1a6b3a", color: "#fff" }}>
              {["التاريخ","رقم القيد","البيان / المرجع","النوع","مدين (ر.س)","دائن (ر.س)","الرصيد (ر.س)"].map(h => (
                <th key={h} style={{
                  padding: "6px 8px", textAlign: "center", fontWeight: "bold",
                  border: "1px solid #1a6b3a", whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* رصيد افتتاحي إن وجد */}
            {summary && summary.openingBalance !== 0 && (
              <tr style={{ background: "#e8f0fe" }}>
                <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center" }}>—</td>
                <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center" }}>—</td>
                <td style={{ padding: "5px 8px", border: "1px solid #ddd", fontWeight: "bold" }}>رصيد مرحّل / افتتاحي</td>
                <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center" }}>افتتاحي</td>
                <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center", fontWeight: "bold" }}>
                  {summary.openingBalance > 0 ? fmt(summary.openingBalance) : "—"}
                </td>
                <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center", fontWeight: "bold" }}>
                  {summary.openingBalance < 0 ? fmt(Math.abs(summary.openingBalance)) : "—"}
                </td>
                <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center", fontWeight: "bold" }}>
                  {fmt(Math.abs(summary.openingBalance))}
                </td>
              </tr>
            )}

            {/* الحركات */}
            {filtered.map((t, i) => {
              const typeLabel = entryTypeLabels[t.entryType]?.ar ?? "قيد";
              const rowBg = i % 2 === 0 ? "#fff" : "#f9f9f9";
              return (
                <tr key={t.id} style={{ background: rowBg }}>
                  <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center", whiteSpace: "nowrap" }}>
                    {fmtDate(t.entryDate)}
                  </td>
                  <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center", fontFamily: "monospace", fontSize: "8px" }}>
                    {t.entryNumber ?? "—"}
                  </td>
                  <td style={{ padding: "5px 8px", border: "1px solid #ddd" }}>
                    <div style={{ fontWeight: "bold" }}>{t.description}</div>
                    {t.referenceNumber && (
                      <div style={{ fontSize: "8px", color: "#1a6b3a", marginTop: "2px" }}>رقم الفاتورة: {t.referenceNumber}</div>
                    )}
                  </td>
                  <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center", whiteSpace: "nowrap" }}>
                    {typeLabel}
                  </td>
                  <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center", fontWeight: t.debit > 0 ? "bold" : "normal", color: t.debit > 0 ? "#b45309" : "#aaa" }}>
                    {t.debit > 0 ? fmt(t.debit) : "—"}
                  </td>
                  <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center", fontWeight: t.credit > 0 ? "bold" : "normal", color: t.credit > 0 ? "#166534" : "#aaa" }}>
                    {t.credit > 0 ? fmt(t.credit) : "—"}
                  </td>
                  <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "center", fontWeight: "bold",
                    color: t.runningBalance > 0 ? "#b45309" : t.runningBalance < 0 ? "#166534" : "#333" }}>
                    {fmt(Math.abs(t.runningBalance))}
                    {t.runningBalance !== 0 && (
                      <span style={{ fontSize: "7px", marginRight: "2px", color: "#666" }}>
                        {t.runningBalance > 0 ? "م" : "د"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* الإجمالي */}
          <tfoot>
            <tr style={{ background: "#1a6b3a", color: "#fff", fontWeight: "bold" }}>
              <td colSpan={4} style={{ padding: "7px 10px", border: "1px solid #1a6b3a", fontSize: "11px" }}>
                الإجمالي ({filtered.length} حركة)
              </td>
              <td style={{ padding: "7px 10px", border: "1px solid #1a6b3a", textAlign: "center", fontSize: "12px" }}>
                {fmt(filtered.reduce((s,t)=>s+t.debit,0))}
              </td>
              <td style={{ padding: "7px 10px", border: "1px solid #1a6b3a", textAlign: "center", fontSize: "12px" }}>
                {fmt(filtered.reduce((s,t)=>s+t.credit,0))}
              </td>
              <td style={{ padding: "7px 10px", border: "1px solid #1a6b3a", textAlign: "center", fontSize: "13px", fontWeight: "900" }}>
                {fmt(Math.abs(balance))} ر.س
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ملاحظة الرصيد النهائي */}
        <div style={{
          marginTop: "16px", padding: "10px 14px",
          background: balance > 5 ? "#fff7ed" : "#f0fdf4",
          border: `1px solid ${balance > 5 ? "#f97316" : "#22c55e"}`,
          borderRadius: "6px",
        }}>
          <p style={{ margin: 0, fontWeight: "bold", fontSize: "12px",
            color: balance > 5 ? "#b45309" : "#166534" }}>
            {balance > 5
              ? `إجمالي المبلغ المستحق لـ ${supplier?.name ?? "المورد"}: ${fmt(balance)} ريال سعودي`
              : balance < -5
              ? `رصيد لصالح شركة الشمال: ${fmt(Math.abs(balance))} ريال سعودي`
              : "الحساب متوازن — لا يوجد رصيد مستحق"}
          </p>
        </div>

        {/* تذييل الكشف */}
        <div style={{
          marginTop: "30px", borderTop: "1px solid #ddd", paddingTop: "12px",
          display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#888",
        }}>
          <span>شركة الشمال للمواشي — نظام إدارة الموردين</span>
          <span>هذا الكشف مُولَّد إلكترونياً ولا يحتاج إلى ختم أو توقيع يدوي</span>
          <span>طُبع بتاريخ: {new Date().toLocaleDateString("ar-SA")}</span>
        </div>

        {/* مساحة التوقيع */}
        <div style={{
          marginTop: "40px", display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: "20px",
        }}>
          <div style={{ borderTop: "1px solid #333", paddingTop: "8px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "10px", color: "#555" }}>توقيع المسؤول المالي</p>
          </div>
          <div style={{ borderTop: "1px solid #333", paddingTop: "8px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "10px", color: "#555" }}>توقيع المورد / الاستلام</p>
          </div>
        </div>
      </div>

      {showModal && supplierId && (
        <AddEntryModal
          supplierId={supplierId}
          supplierName={supplier?.name || "محمد طه"}
          currentBalance={summary?.balance ?? 0}
          onClose={() => setShowModal(false)}
          onSuccess={(entryNumber) => {
            setShowModal(false);
            load();
            // toast بسيط
            const t = document.createElement("div");
            t.className = "fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-[#3fa66a] text-white text-sm font-black px-6 py-3 rounded-2xl shadow-xl";
            t.textContent = `تم حفظ القيد ${entryNumber}`;
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 3500);
          }}
        />
      )}
    </div>
  );
}
