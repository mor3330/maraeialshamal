"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

/* ─── helpers ─── */
const fmt = (v: number, dec = 2) =>
  v.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtDate = (d: string) =>
  d
    ? new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
        day: "numeric", month: "long", year: "numeric",
      }).format(new Date(`${d}T00:00:00`))
    : "—";

function todayStr() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthStart() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/* ─── types ─── */
interface Transaction {
  id: string;
  entryId: string;
  entryNumber: string;
  entryDate: string;
  hijriDate?: string;
  description: string;
  lineDescription?: string;
  referenceNumber?: string;
  entryType: string;
  sourceType: string;
  notes?: string;
  debit: number;
  credit: number;
  quantity?: number;
  unitPrice?: number;
  itemType?: string;
  runningBalance: number;
}
interface Summary {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}
interface SupplierInfo {
  id: string; name: string; phone?: string; notes?: string;
  opening_balance?: number; opening_balance_date?: string;
  credit_limit?: number; payment_terms_days?: number;
  tax_number?: string; bank_details?: any;
}

const entryTypeLabels: Record<string, { ar: string; color: string; bg: string }> = {
  purchase:    { ar: "فاتورة شراء",   color: "#b45309", bg: "#fffbeb" },
  payment:     { ar: "دفعة",          color: "#166534", bg: "#f0fdf4" },
  adjustment:  { ar: "تسوية",         color: "#6b21a8", bg: "#faf5ff" },
  opening:     { ar: "رصيد افتتاحي", color: "#0369a1", bg: "#f0f9ff" },
  standard:    { ar: "قيد يومية",     color: "#374151", bg: "#f9fafb" },
  reversing:   { ar: "عكسي",          color: "#dc2626", bg: "#fef2f2" },
};

const itemTypeLabels: Record<string, string> = {
  hashi: "حاشي", sheep: "غنم", beef: "عجل", offal: "مخلفات", other: "أخرى",
};

/* ══════════════════════════════════════════════════
   KPI Card
══════════════════════════════════════════════════ */
function KPICard({ title, value, sub, color, bg, border, icon }: {
  title: string; value: string; sub?: string;
  color: string; bg: string; border: string; icon: string;
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}` }}
      className="rounded-3xl p-5 flex items-start gap-4">
      <div style={{ background: color + "20", color }}
        className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0">
        {icon}
      </div>
      <div>
        <p style={{ color }} className="text-xs font-semibold mb-1 opacity-80">{title}</p>
        <p style={{ color }} className="text-2xl font-black tabular-nums">{value}</p>
        {sub && <p className="text-xs mt-0.5 opacity-60" style={{ color }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Modal إضافة قيد
══════════════════════════════════════════════════ */
function AddEntryModal({
  supplierId, onClose, onSuccess,
}: { supplierId: string; onClose: () => void; onSuccess: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    entry_date:       todayStr(),
    entry_type:       "purchase",
    description:      "",
    reference_number: "",
    notes:            "",
    amount:           "",
    quantity:         "",
    unit_price:       "",
    item_type:        "",
  });

  // "شراء" → مدين (المورد يستحق علينا) → direction=debit
  // "دفعة" → دائن (دفعنا له)           → direction=credit
  const direction = ["purchase","opening","adjustment"].includes(form.entry_type) ? "debit" : "credit";

  const entryTypes = [
    { value: "purchase",   label: "فاتورة شراء",    icon: "📦" },
    { value: "payment",    label: "دفعة تسديد",     icon: "💵" },
    { value: "opening",    label: "رصيد افتتاحي",   icon: "🏦" },
    { value: "adjustment", label: "تسوية/تعديل",    icon: "⚖️" },
    { value: "reversing",  label: "قيد عكسي",       icon: "↩️" },
  ];

  async function handleSave() {
    if (!form.description.trim()) { setError("اكتب وصف القيد"); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError("أدخل مبلغاً صحيحاً"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, direction, amount: Number(form.amount) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل الحفظ");
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const f = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f1511] border border-[#2a3830] rounded-[28px] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[#2a3830] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">قيد يومية جديد</h2>
            <p className="text-sm text-[#8a9690] mt-0.5">إدخال حركة محاسبية</p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#1a2420] hover:bg-[#2a3830] text-[#8a9690] flex items-center justify-center transition-colors">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* نوع القيد */}
          <div>
            <label className="text-xs text-[#8a9690] block mb-2">نوع القيد</label>
            <div className="grid grid-cols-3 gap-2">
              {entryTypes.map(t => (
                <button key={t.value}
                  onClick={() => f("entry_type", t.value)}
                  className={`flex flex-col items-center gap-1 rounded-2xl p-3 border transition-all text-sm font-bold
                    ${form.entry_type === t.value
                      ? "border-[#3fa66a] bg-[#3fa66a]/10 text-[#3fa66a]"
                      : "border-[#2a3830] bg-[#1a2420] text-[#8a9690] hover:border-[#3fa66a]/30"}`}>
                  <span className="text-lg">{t.icon}</span>
                  <span className="text-xs">{t.label}</span>
                </button>
              ))}
            </div>
            {/* بيان الطرف */}
            <div className={`mt-3 rounded-xl p-3 text-xs font-medium flex items-center gap-2
              ${direction === "debit"
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>
              <span className="text-base">{direction === "debit" ? "⬆️" : "⬇️"}</span>
              {direction === "debit"
                ? "هذا القيد يزيد من مبالغ المورد المستحقة عليك (مدين)"
                : "هذا القيد يُقلّل من مبالغ المورد المستحقة (دائن)"}
            </div>
          </div>

          {/* التاريخ + المبلغ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#8a9690] block mb-1.5">التاريخ *</label>
              <input type="date" value={form.entry_date} onChange={e => f("entry_date", e.target.value)}
                className="w-full rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3fa66a]/50" />
            </div>
            <div>
              <label className="text-xs text-[#8a9690] block mb-1.5">المبلغ (ريال) *</label>
              <input type="number" value={form.amount} onChange={e => f("amount", e.target.value)}
                placeholder="0.00" min="0" step="0.01"
                className="w-full rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3fa66a]/50" />
            </div>
          </div>

          {/* الوصف */}
          <div>
            <label className="text-xs text-[#8a9690] block mb-1.5">الوصف / البيان *</label>
            <input type="text" value={form.description} onChange={e => f("description", e.target.value)}
              placeholder="مثال: فاتورة رقم 1234 — 50 رأس حاشي"
              className="w-full rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3fa66a]/50" />
          </div>

          {/* رقم المرجع */}
          <div>
            <label className="text-xs text-[#8a9690] block mb-1.5">رقم الفاتورة / المرجع</label>
            <input type="text" value={form.reference_number} onChange={e => f("reference_number", e.target.value)}
              placeholder="INV-1234"
              className="w-full rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3fa66a]/50" />
          </div>

          {/* الكمية والوزن والصنف — للمشتريات */}
          {form.entry_type === "purchase" && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <p className="text-xs text-amber-400 font-bold">تفاصيل المشتريات (اختياري)</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-[#8a9690] block mb-1">الكمية (رأس)</label>
                  <input type="number" value={form.quantity} onChange={e => f("quantity", e.target.value)}
                    placeholder="0" min="0"
                    className="w-full rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-xs text-[#8a9690] block mb-1">الوزن (كجم)</label>
                  <input type="number" value={form.unit_price} onChange={e => f("unit_price", e.target.value)}
                    placeholder="0.000" step="0.001"
                    className="w-full rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-xs text-[#8a9690] block mb-1">الصنف</label>
                  <select value={form.item_type} onChange={e => f("item_type", e.target.value)}
                    className="w-full rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50">
                    <option value="">—</option>
                    <option value="hashi">حاشي</option>
                    <option value="sheep">غنم</option>
                    <option value="beef">عجل</option>
                    <option value="offal">مخلفات</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ملاحظات */}
          <div>
            <label className="text-xs text-[#8a9690] block mb-1.5">ملاحظات</label>
            <textarea value={form.notes} onChange={e => f("notes", e.target.value)}
              rows={2} placeholder="ملاحظات إضافية..."
              className="w-full rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3fa66a]/50 resize-none" />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 rounded-2xl bg-[#1a2420] border border-[#2a3830] py-3 text-sm font-bold text-[#8a9690] hover:text-white transition-colors">
              إلغاء
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-[2] rounded-2xl bg-[#3fa66a] hover:bg-[#2d7a4e] disabled:opacity-50 py-3 text-sm font-black text-white transition-colors">
              {saving ? "جاري الحفظ..." : "✓ حفظ القيد"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════ */
export default function SupplierLedgerPage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = params.id as string;

  const [loading, setLoading]         = useState(true);
  const [supplier, setSupplier]       = useState<SupplierInfo | null>(null);
  const [transactions, setTrans]      = useState<Transaction[]>([]);
  const [summary, setSummary]         = useState<Summary | null>(null);
  const [showModal, setShowModal]     = useState(false);
  const [voidingId, setVoidingId]     = useState<string | null>(null);
  const [searchQ, setSearchQ]         = useState("");
  const [filterType, setFilterType]   = useState<string>("all");
  const [range, setRange]             = useState({ from: monthStart(), to: todayStr() });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetch(`/api/suppliers/${id}/ledger?${qs}`);
      if (!res.ok) { console.error("ledger load failed"); return; }
      const json = await res.json();
      setSupplier(json.supplier);
      setTrans(json.transactions ?? []);
      setSummary(json.summary ?? null);
    } finally {
      setLoading(false);
    }
  }, [id, range]);

  useEffect(() => { load(); }, [load]);

  async function handleVoid(entryId: string) {
    if (!confirm("هل أنت متأكد من إلغاء هذا القيد؟ لا يمكن التراجع عن الإلغاء.")) return;
    const reason = prompt("سبب الإلغاء (اختياري):") ?? "";
    setVoidingId(entryId);
    try {
      const res = await fetch(`/api/suppliers/${id}/ledger`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, voidReason: reason }),
      });
      if (res.ok) load();
    } finally {
      setVoidingId(null);
    }
  }

  /* فلترة العرض */
  const filtered = transactions.filter(t => {
    const q = searchQ.toLowerCase();
    const matchQ = !q ||
      t.description.toLowerCase().includes(q) ||
      (t.referenceNumber ?? "").toLowerCase().includes(q) ||
      (t.entryNumber ?? "").toLowerCase().includes(q);
    const matchType = filterType === "all" || t.entryType === filterType;
    return matchQ && matchType;
  });

  const balance = summary?.balance ?? 0;
  const isCredit = balance < 0; // المورد يستحق تسديد (نادر)

  /* ── Presets ── */
  function applyPreset(preset: string) {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    const pad = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (preset === "today")  { const s = pad(now); setRange({ from: s, to: s }); }
    if (preset === "week")   { const s = new Date(now); s.setDate(now.getDate() - 7); setRange({ from: pad(s), to: pad(now) }); }
    if (preset === "month")  { setRange({ from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, to: pad(now) }); }
    if (preset === "3month") { const s = new Date(now); s.setMonth(now.getMonth() - 3); setRange({ from: pad(s), to: pad(now) }); }
    if (preset === "year")   { setRange({ from: `${now.getFullYear()}-01-01`, to: pad(now) }); }
    if (preset === "all")    { setRange({ from: "2020-01-01", to: pad(now) }); }
  }

  return (
    <div className="min-h-screen bg-[#0a0f0c] text-white" dir="rtl">

      {/* ─── Gradient radial ─── */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(63,166,106,0.06),_transparent_60%)] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 py-8">

        {/* ─── Header ─── */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <button onClick={() => router.push("/dashboard/suppliers")}
              className="mt-1 w-10 h-10 rounded-2xl bg-[#1a2420] border border-[#2a3830] flex items-center justify-center text-[#8a9690] hover:text-white hover:border-[#3fa66a]/40 transition-all">
              →
            </button>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#3fa66a]/20 bg-[#3fa66a]/10 px-3 py-1 text-xs text-[#3fa66a] mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fa66a] animate-pulse" />
                النظام المحاسبي
              </div>
              <h1 className="text-3xl font-black">{supplier?.name ?? "..."}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-[#8a9690]">
                {supplier?.phone && <span dir="ltr">📞 {supplier.phone}</span>}
                {supplier?.payment_terms_days && <span>شروط الدفع: {supplier.payment_terms_days} يوم</span>}
                {supplier?.tax_number && <span>رقم الضريبي: {supplier.tax_number}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/dashboard/purchases-review?supplierId=${id}`)}
              className="rounded-2xl bg-[#1a2420] border border-[#2a3830] hover:border-amber-500/30 px-5 py-2.5 text-sm font-bold text-[#8a9690] hover:text-amber-400 transition-all">
              📦 سجل المشتريات
            </button>
            <button onClick={() => setShowModal(true)}
              className="rounded-2xl bg-[#3fa66a] hover:bg-[#2d7a4e] px-6 py-2.5 text-sm font-black text-white transition-all hover:scale-[1.02] flex items-center gap-2">
              <span className="text-lg">+</span> قيد جديد
            </button>
          </div>
        </div>

        {/* ─── KPIs ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            title="الرصيد الحالي"
            value={`${fmt(Math.abs(balance))} ر.س`}
            sub={balance > 0 ? "مستحق على الشركة" : balance < 0 ? "رصيد دائن" : "مسدَّد بالكامل"}
            color={balance > 5 ? "#b45309" : balance < -5 ? "#15803d" : "#6b7280"}
            bg={balance > 5 ? "#fffbeb" : balance < -5 ? "#f0fdf4" : "#f9fafb"}
            border={balance > 5 ? "#fde68a" : balance < -5 ? "#bbf7d0" : "#e5e7eb"}
            icon={balance > 5 ? "⬆️" : balance < -5 ? "✅" : "⚖️"}
          />
          <KPICard
            title="إجمالي المشتريات"
            value={`${fmt(summary?.totalDebit ?? 0)} ر.س`}
            sub="مجموع الفواتير"
            color="#b45309" bg="#fffbeb" border="#fde68a" icon="📦"
          />
          <KPICard
            title="إجمالي المدفوعات"
            value={`${fmt(summary?.totalCredit ?? 0)} ر.س`}
            sub="مجموع الدفعات"
            color="#166534" bg="#f0fdf4" border="#bbf7d0" icon="💵"
          />
          <KPICard
            title="عدد الحركات"
            value={String(transactions.length)}
            sub={`في الفترة المحددة`}
            color="#6b21a8" bg="#faf5ff" border="#e9d5ff" icon="📊"
          />
        </div>

        {/* ─── Filters ─── */}
        <div className="rounded-[24px] border border-[#2a3830] bg-[#0f1511] p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">

            {/* Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: "today",  label: "اليوم" },
                { key: "week",   label: "أسبوع" },
                { key: "month",  label: "الشهر" },
                { key: "3month", label: "3 أشهر" },
                { key: "year",   label: "السنة" },
                { key: "all",    label: "الكل" },
              ].map(p => (
                <button key={p.key} onClick={() => applyPreset(p.key)}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium border border-[#2a3830] text-[#8a9690] hover:border-[#3fa66a]/40 hover:text-[#3fa66a] transition-all bg-[#1a2420]">
                  {p.label}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-[#2a3830]" />

            {/* Date range */}
            <div className="flex items-center gap-2">
              <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
                className="rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#3fa66a]/50" />
              <span className="text-[#8a9690] text-xs">—</span>
              <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
                className="rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#3fa66a]/50" />
            </div>

            <div className="h-4 w-px bg-[#2a3830]" />

            {/* Type filter */}
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#3fa66a]/50">
              <option value="all">كل الأنواع</option>
              <option value="purchase">فواتير الشراء</option>
              <option value="payment">الدفعات</option>
              <option value="adjustment">التسويات</option>
              <option value="opening">الرصيد الافتتاحي</option>
              <option value="reversing">القيود العكسية</option>
            </select>

            {/* Search */}
            <div className="flex-1 min-w-[180px]">
              <input type="text" placeholder="بحث بالوصف أو رقم الفاتورة..."
                value={searchQ} onChange={e => setSearchQ(e.target.value)}
                className="w-full rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-1.5 text-white text-xs placeholder:text-[#4a5550] focus:outline-none focus:border-[#3fa66a]/50" />
            </div>

            <button onClick={load}
              className="rounded-xl bg-[#1a2420] border border-[#2a3830] hover:border-[#3fa66a]/30 px-4 py-1.5 text-xs text-[#8a9690] hover:text-white transition-all">
              ↻ تحديث
            </button>
          </div>
        </div>

        {/* ─── Statement Table ─── */}
        <div className="rounded-[24px] border border-[#2a3830] bg-[#0f1511] overflow-hidden">

          {/* Table header */}
          <div className="bg-[#0a0f0c] border-b border-[#2a3830] px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-black">كشف حساب</span>
              <span className="text-xs text-[#8a9690]">
                {filtered.length} حركة · {fmtDate(range.from)} — {fmtDate(range.to)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#8a9690]">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> مدين
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block mr-2" /> دائن
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-[#3fa66a] border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-[#8a9690] text-sm">جاري تحميل الحركات...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">📒</div>
              <p className="text-[#8a9690] text-lg font-medium mb-2">لا توجد حركات محاسبية</p>
              <p className="text-[#4a5550] text-sm mb-6">ابدأ بإضافة فاتورة شراء أو تسجيل رصيد افتتاحي</p>
              <button onClick={() => setShowModal(true)}
                className="rounded-2xl bg-[#3fa66a] hover:bg-[#2d7a4e] px-6 py-3 text-sm font-black text-white transition-all">
                + أضف أول قيد
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: "800px" }}>
                <colgroup>
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "90px" }} />
                  <col />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "60px" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#2a3830] text-[#8a9690] text-xs">
                    <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                    <th className="px-4 py-3 text-right font-semibold">رقم القيد</th>
                    <th className="px-4 py-3 text-right font-semibold">البيان</th>
                    <th className="px-4 py-3 text-right font-semibold">النوع</th>
                    <th className="px-4 py-3 text-center font-semibold text-amber-500">مدين ▲</th>
                    <th className="px-4 py-3 text-center font-semibold text-green-500">دائن ▼</th>
                    <th className="px-4 py-3 text-center font-semibold">الرصيد</th>
                    <th className="px-4 py-3 text-center font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {/* سطر الرصيد الافتتاحي */}
                  {summary && summary.openingBalance !== 0 && (
                    <tr className="border-b border-[#2a3830]/50 bg-[#0369a1]/5">
                      <td className="px-4 py-3 text-[#8a9690] text-xs">{fmtDate(supplier?.opening_balance_date ?? "")}</td>
                      <td className="px-4 py-3 text-[#8a9690] text-xs">—</td>
                      <td className="px-4 py-3 text-[#a0c4ff] font-medium">رصيد مرحّل / افتتاحي</td>
                      <td className="px-4 py-3">
                        <span className="rounded-lg px-2 py-0.5 text-[10px] font-bold" style={{ background: "#f0f9ff", color: "#0369a1" }}>افتتاحي</span>
                      </td>
                      <td className="px-4 py-3 text-center text-amber-400 font-bold tabular-nums">
                        {summary.openingBalance > 0 ? fmt(summary.openingBalance) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-green-400 font-bold tabular-nums">
                        {summary.openingBalance < 0 ? fmt(Math.abs(summary.openingBalance)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-black tabular-nums" style={{
                        color: summary.openingBalance > 0 ? "#b45309" : "#15803d"
                      }}>
                        {fmt(Math.abs(summary.openingBalance))}
                      </td>
                      <td />
                    </tr>
                  )}

                  {filtered.map((t, i) => {
                    const typeInfo = entryTypeLabels[t.entryType] ?? entryTypeLabels.standard;
                    const bal = t.runningBalance;
                    return (
                      <tr key={t.id}
                        className={`border-b border-[#2a3830]/40 transition-colors hover:bg-[#1a2420]/60
                          ${i % 2 === 0 ? "" : "bg-[#0f1511]"}`}>
                        <td className="px-4 py-3.5">
                          <div className="text-white text-xs font-medium">{fmtDate(t.entryDate)}</div>
                          {t.hijriDate && <div className="text-[#8a9690] text-[10px] mt-0.5">{t.hijriDate}</div>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[#8a9690] text-xs font-mono">{t.entryNumber ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-white font-medium text-sm truncate">{t.description}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {t.referenceNumber && (
                              <span className="text-[10px] text-[#3fa66a] font-mono bg-[#3fa66a]/10 px-1.5 py-0.5 rounded-md">
                                #{t.referenceNumber}
                              </span>
                            )}
                            {t.itemType && (
                              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                                {itemTypeLabels[t.itemType] ?? t.itemType}
                              </span>
                            )}
                            {t.quantity && (
                              <span className="text-[10px] text-[#8a9690]">{fmt(t.quantity, 0)} رأس</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded-xl px-2.5 py-1 text-[10px] font-bold"
                            style={{ background: typeInfo.bg, color: typeInfo.color }}>
                            {typeInfo.ar}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {t.debit > 0 ? (
                            <span className="text-amber-400 font-black tabular-nums text-sm">
                              {fmt(t.debit)}
                            </span>
                          ) : <span className="text-[#2a3830]">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {t.credit > 0 ? (
                            <span className="text-green-400 font-black tabular-nums text-sm">
                              {fmt(t.credit)}
                            </span>
                          ) : <span className="text-[#2a3830]">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`font-black tabular-nums text-sm ${
                            bal > 5 ? "text-amber-300" : bal < -5 ? "text-green-300" : "text-[#8a9690]"
                          }`}>
                            {fmt(Math.abs(bal))}
                            {bal !== 0 && (
                              <span className="text-[9px] ml-1 opacity-60">{bal > 0 ? "م" : "د"}</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => handleVoid(t.entryId)}
                            disabled={voidingId === t.entryId}
                            title="إلغاء القيد"
                            className="w-7 h-7 rounded-lg bg-red-500/0 hover:bg-red-500/15 text-[#8a9690] hover:text-red-400 transition-all text-xs disabled:opacity-30">
                            🗑
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Footer */}
                <tfoot>
                  <tr className="bg-[#1a2420] border-t-2 border-[#3fa66a]/20 font-black">
                    <td colSpan={4} className="px-4 py-4 text-white text-sm">
                      الإجمالي
                      <span className="text-[#8a9690] text-xs font-normal mr-2">({filtered.length} حركة)</span>
                    </td>
                    <td className="px-4 py-4 text-center text-amber-300 text-base tabular-nums">
                      {fmt(filtered.reduce((s, t) => s + t.debit, 0))}
                    </td>
                    <td className="px-4 py-4 text-center text-green-300 text-base tabular-nums">
                      {fmt(filtered.reduce((s, t) => s + t.credit, 0))}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className={`text-lg font-black tabular-nums rounded-xl px-3 py-1 inline-block ${
                        balance > 5 ? "bg-amber-500/10 text-amber-300" :
                        balance < -5 ? "bg-green-500/10 text-green-300" :
                        "bg-[#2a3830] text-white"}`}>
                        {fmt(Math.abs(balance))} ر.س
                      </div>
                      <div className="text-[10px] mt-0.5 text-[#8a9690]">
                        {balance > 5 ? "مستحق للمورد" : balance < -5 ? "رصيد لصالحك" : "متوازن ✓"}
                      </div>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ─── Credit limit warning ─── */}
        {supplier?.credit_limit && balance > supplier.credit_limit && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-red-400 text-sm">تجاوز حد الائتمان</p>
              <p className="text-red-300/70 text-xs mt-0.5">
                الرصيد الحالي ({fmt(balance)} ر.س) تجاوز حد الائتمان المحدد ({fmt(supplier.credit_limit)} ر.س)
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Modal */}
      {showModal && (
        <AddEntryModal
          supplierId={id}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
