"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Buyer    { id: string; name: string; phone?: string; }
interface Supplier { id: string; name: string; }
interface ItemType { id: string; name: string; }
interface Sale {
  id: string;
  buyer_id:     string | null;
  supplier_id:  string | null;
  item_type_id: string;
  quantity:     number;
  weight:       number;
  price:        number;
  sale_date:    string;
  notes?:       string;
  buyers?:      { name: string; phone?: string };
  suppliers?:   { name: string };
  item_types?:  { name: string };
}

interface SaleRow {
  buyer_id:     string;
  supplier_id:  string;
  item_type_id: string;
  quantity:     string;
  weight:       string;
  price:        string;
}

const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmt = (v: number) => v.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const todayStr = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emptyRow = (): SaleRow => ({ buyer_id: "", supplier_id: "", item_type_id: "", quantity: "", weight: "", price: "" });

export default function ExternalSalesPage() {
  const router = useRouter();
  const [buyers,     setBuyers]     = useState<Buyer[]>([]);
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([]);
  const [itemTypes,  setItemTypes]  = useState<ItemType[]>([]);
  const [sales,      setSales]      = useState<Sale[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);

  const [targetDate, setTargetDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Modal إضافة
  const [showAdd, setShowAdd]   = useState(false);
  const [rows, setRows]         = useState<SaleRow[]>([emptyRow()]);
  const [addNotes, setAddNotes] = useState("");

  // Modal تعديل
  const [editSale, setEditSale]   = useState<Sale | null>(null);
  const [editRow, setEditRow]     = useState<SaleRow>(emptyRow());

  // فلتر عرض
  const [filterBuyer, setFilterBuyer] = useState("");

  useEffect(() => {
    loadAll(targetDate);
  }, []);

  async function loadAll(date: string) {
    setLoading(true);
    try {
      const [buyRes, suppRes, typesRes, salesRes] = await Promise.all([
        fetch("/api/buyers"),
        fetch("/api/suppliers"),
        fetch("/api/item-types"),
        fetch(`/api/external-sales?date=${date}`),
      ]);
      const [buyData, suppData, typesData, salesData] = await Promise.all([
        buyRes.json(), suppRes.json(), typesRes.json(), salesRes.json(),
      ]);
      setBuyers(buyData.buyers     || []);
      setSuppliers(suppData.suppliers || []);
      setItemTypes(typesData.itemTypes || []);
      setSales(salesData.sales     || []);
    } finally {
      setLoading(false);
    }
  }

  function handleDateChange(d: string) {
    setTargetDate(d);
    setShowDatePicker(false);
    loadAll(d);
  }

  // ── صفوف الإضافة ──
  function addRow()               { if (rows.length < 15) setRows([...rows, emptyRow()]); }
  function removeRow(i: number)   { setRows(rows.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, field: keyof SaleRow, val: string) {
    const updated = [...rows];
    updated[i][field] = val;
    setRows(updated);
  }

  async function handleSubmit() {
    const valid = rows.filter(r => r.item_type_id && r.quantity && r.weight && r.price);
    if (!valid.length) { alert("عبّئ صنف واحد على الأقل (الصنف + العدد + الوزن + السعر)"); return; }
    setSaving(true);
    try {
      const results = await Promise.all(valid.map(r =>
        fetch("/api/external-sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buyer_id:    r.buyer_id    || null,
            supplier_id: r.supplier_id || null,
            item_type_id: r.item_type_id,
            sale_date:   targetDate,
            quantity:    parseFloat(r.quantity),
            weight:      parseFloat(r.weight),
            price:       parseFloat(r.price),
            notes:       addNotes || null,
          }),
        })
      ));
      for (const res of results) {
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل الحفظ"); }
      }
      setShowAdd(false);
      setRows([emptyRow()]);
      setAddNotes("");
      loadAll(targetDate);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally { setSaving(false); }
  }

  // ── التعديل ──
  function openEdit(s: Sale) {
    setEditSale(s);
    setEditRow({
      buyer_id:     s.buyer_id    || "",
      supplier_id:  s.supplier_id || "",
      item_type_id: s.item_type_id,
      quantity:     String(s.quantity),
      weight:       String(s.weight),
      price:        String(s.price),
    });
  }

  async function handleEditSave() {
    if (!editSale) return;
    if (!editRow.item_type_id || !editRow.quantity || !editRow.weight || !editRow.price) {
      alert("عبّئ جميع الحقول"); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/external-sales?id=${editSale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_id:    editRow.buyer_id    || null,
          supplier_id: editRow.supplier_id || null,
          item_type_id: editRow.item_type_id,
          quantity:    parseFloat(editRow.quantity),
          weight:      parseFloat(editRow.weight),
          price:       parseFloat(editRow.price),
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل التعديل"); }
      setEditSale(null);
      loadAll(targetDate);
    } catch (err: any) {
      alert(err.message);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    const res = await fetch(`/api/external-sales?id=${id}`, { method: "DELETE" });
    if (!res.ok) { alert("فشل الحذف"); return; }
    loadAll(targetDate);
  }

  // إحصائيات
  const displayed = filterBuyer ? sales.filter(s => s.buyer_id === filterBuyer) : sales;
  const stats = {
    count:  displayed.length,
    weight: displayed.reduce((a, s) => a + toN(s.weight),   0),
    price:  displayed.reduce((a, s) => a + toN(s.price),    0),
    qty:    displayed.reduce((a, s) => a + toN(s.quantity),  0),
  };

  // تجميع حسب المشترٍ
  const byBuyer: Record<string, Sale[]> = {};
  displayed.forEach(s => {
    const key = s.buyer_id || "__none__";
    if (!byBuyer[key]) byBuyer[key] = [];
    byBuyer[key].push(s);
  });

  const fmtDate = (d: string) => {
    try { return new Intl.DateTimeFormat("ar-SA-u-nu-latn", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(d + "T12:00:00")); }
    catch { return d; }
  };

  const inputCls = "w-full rounded-xl bg-bg border border-line px-3 py-2.5 text-cream text-sm focus:outline-none focus:border-green/50";
  const selectCls = inputCls;

  return (
    <div className="min-h-screen bg-bg text-cream p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-cream">المبيعات الخارجية</h1>
            <p className="text-muted text-sm mt-1">مبيعات لأشخاص وشركات خارج الفروع</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => router.push("/dashboard/buyers")}
              className="rounded-2xl bg-green/10 border border-green/30 hover:bg-green/20 px-5 py-2.5 font-bold text-green text-sm transition-all">
              🤝 المشترون
            </button>
            <button onClick={() => router.push("/dashboard/suppliers")}
              className="rounded-2xl bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 px-5 py-2.5 font-bold text-purple-400 text-sm transition-all">
              🏭 الموردون
            </button>
            <button onClick={() => router.push("/dashboard/item-types")}
              className="rounded-2xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 px-5 py-2.5 font-bold text-blue-400 text-sm transition-all">
              🏷 الأصناف
            </button>
            <Link
              href={`/dashboard/external-sales/print?date=${targetDate}`}
              target="_blank"
              className="rounded-2xl bg-amber/10 border border-amber/30 hover:bg-amber/20 px-5 py-2.5 font-bold text-amber text-sm transition-all flex items-center gap-2">
              🖨️ طباعة التقرير
            </Link>
            <button
              onClick={() => { setRows([emptyRow()]); setAddNotes(""); setShowAdd(true); }}
              className="rounded-2xl bg-green hover:bg-green-dark px-6 py-2.5 font-bold text-white transition-all">
              + إضافة بيع جديد
            </button>
          </div>
        </div>

        {/* ── اليوم ── */}
        <div className="bg-card border border-line rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-muted text-xs mb-1">عرض مبيعات يوم</p>
              <p className="text-cream font-bold text-lg">{fmtDate(targetDate)}</p>
            </div>
            <button onClick={() => setShowDatePicker(v => !v)}
              className="rounded-xl bg-card-hi border border-line px-5 py-2.5 text-sm font-medium text-cream hover:bg-bg transition-all">
              تغيير التاريخ
            </button>
          </div>
          {showDatePicker && (
            <div className="mt-4 pt-4 border-t border-line">
              <input type="date" value={targetDate}
                onChange={e => handleDateChange(e.target.value)}
                className={inputCls + " w-auto"} />
            </div>
          )}
        </div>

        {/* ── الإحصائيات ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "عدد السجلات",  val: stats.count,  unit: "",    cls: "text-green"       },
            { label: "إجمالي العدد", val: stats.qty,    unit: "رأس", cls: "text-sky-400"     },
            { label: "إجمالي الوزن", val: stats.weight, unit: "كجم", cls: "text-blue-400"    },
            { label: "إجمالي القيمة",val: stats.price,  unit: "ر.س", cls: "text-amber"       },
          ].map(s => (
            <div key={s.label} className="bg-card border border-line rounded-2xl p-5 text-center">
              <p className="text-muted text-xs mb-2">{s.label}</p>
              <p className={`font-black text-2xl ltr-num ${s.cls}`} dir="ltr">
                {fmt(s.val)} <span className="text-sm font-normal text-muted">{s.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* ── فلتر المشترٍ ── */}
        {buyers.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-muted text-sm">تصفية:</span>
            <button onClick={() => setFilterBuyer("")}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${!filterBuyer ? "bg-green text-white" : "bg-card border border-line text-muted hover:text-cream"}`}>
              الكل
            </button>
            {buyers.map(b => (
              <button key={b.id} onClick={() => setFilterBuyer(b.id)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${filterBuyer === b.id ? "bg-green text-white" : "bg-card border border-line text-muted hover:text-cream"}`}>
                {b.name}
              </button>
            ))}
          </div>
        )}

        {/* ── قائمة المبيعات ── */}
        <div className="bg-card border border-line rounded-2xl overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-muted">جاري التحميل...</p>
            </div>
          ) : Object.keys(byBuyer).length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-muted mb-4">لا توجد مبيعات خارجية لهذا اليوم</p>
              <button onClick={() => { setRows([emptyRow()]); setAddNotes(""); setShowAdd(true); }}
                className="rounded-2xl bg-green hover:bg-green-dark px-6 py-3 font-bold text-white">
                + إضافة أول بيع
              </button>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {Object.entries(byBuyer).map(([key, bSales]) => {
                const buyer = key === "__none__" ? null : buyers.find(b => b.id === key);
                const total = bSales.reduce((a, s) => a + toN(s.price), 0);
                return (
                  <div key={key}>
                    {/* رأس المشترٍ */}
                    <div className="bg-card-hi px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center text-green font-black text-sm flex-shrink-0">
                          {buyer ? buyer.name[0] : "؟"}
                        </div>
                        <div>
                          <p className="text-cream font-bold text-sm">{buyer?.name || "بدون مشترٍ"}</p>
                          {buyer?.phone && <p className="text-muted text-xs ltr-num" dir="ltr">{buyer.phone}</p>}
                        </div>
                      </div>
                      <p className="text-green font-black ltr-num" dir="ltr">{fmt(total)} ر.س</p>
                    </div>
                    {/* صفوف */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-line/50 text-xs text-muted">
                            <th className="px-4 py-2 text-right">المورد</th>
                            <th className="px-4 py-2 text-right">الصنف</th>
                            <th className="px-4 py-2 text-center">العدد</th>
                            <th className="px-4 py-2 text-center">الوزن (كجم)</th>
                            <th className="px-4 py-2 text-center">السعر (ر.س)</th>
                            <th className="px-4 py-2 text-center">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/30">
                          {bSales.map(s => (
                            <tr key={s.id} className="hover:bg-card-hi/40 transition-colors">
                              <td className="px-4 py-3 text-muted">{s.suppliers?.name || "—"}</td>
                              <td className="px-4 py-3 font-medium text-cream">{s.item_types?.name || "—"}</td>
                              <td className="px-4 py-3 text-center ltr-num font-bold" dir="ltr">{fmt(s.quantity)}</td>
                              <td className="px-4 py-3 text-center ltr-num text-blue-400 font-bold" dir="ltr">{fmt(s.weight)}</td>
                              <td className="px-4 py-3 text-center ltr-num text-amber font-bold" dir="ltr">{fmt(s.price)}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2 justify-center">
                                  <button onClick={() => openEdit(s)}
                                    className="rounded-lg bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1 text-blue-400 text-xs transition-colors">
                                    تعديل
                                  </button>
                                  <button onClick={() => handleDelete(s.id)}
                                    className="rounded-lg bg-red/10 hover:bg-red/20 px-3 py-1 text-red text-xs transition-colors">
                                    حذف
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ Modal الإضافة ══ */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-3xl my-8 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-cream">إضافة بيع جديد</h2>
              <span className="text-muted text-sm">{targetDate}</span>
            </div>

            <div className="space-y-4">
              {rows.map((row, i) => (
                <div key={i} className="bg-bg/60 border border-line rounded-2xl p-4 space-y-3 relative">
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(i)}
                      className="absolute top-3 left-3 text-red hover:bg-red/10 rounded-lg px-2 py-0.5 text-xs transition-colors">
                      حذف
                    </button>
                  )}
                  <p className="text-muted text-xs font-semibold">السجل {i + 1}</p>

                  {/* الصف الأول: المشترٍ + المورد + الصنف */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">المشترٍ</label>
                      <select value={row.buyer_id} onChange={e => updateRow(i, "buyer_id", e.target.value)} className={selectCls}>
                        <option value="">— بدون مشترٍ —</option>
                        {buyers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">المورد</label>
                      <select value={row.supplier_id} onChange={e => updateRow(i, "supplier_id", e.target.value)} className={selectCls}>
                        <option value="">— بدون مورد —</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">النوع *</label>
                      <select value={row.item_type_id} onChange={e => updateRow(i, "item_type_id", e.target.value)} className={selectCls}>
                        <option value="">— اختر النوع —</option>
                        {itemTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* الصف الثاني: العدد + الوزن + السعر */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">العدد *</label>
                      <input type="number" step="0.25" min="0" value={row.quantity}
                        onChange={e => updateRow(i, "quantity", e.target.value)}
                        placeholder="مثال: 0.5"
                        className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">الوزن (كجم) *</label>
                      <input type="number" step="0.01" min="0" value={row.weight}
                        onChange={e => updateRow(i, "weight", e.target.value)}
                        placeholder="مثال: 50.3"
                        className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">السعر (ر.س) *</label>
                      <input type="number" step="0.01" min="0" value={row.price}
                        onChange={e => updateRow(i, "price", e.target.value)}
                        placeholder="مثال: 1250.75"
                        className={inputCls} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* إضافة صف */}
            {rows.length < 15 && (
              <button onClick={addRow}
                className="w-full py-2.5 rounded-xl border border-dashed border-green/30 text-green text-sm hover:bg-green/5 transition-colors">
                + إضافة سجل آخر
              </button>
            )}

            {/* ملاحظات */}
            <div>
              <label className="text-sm text-muted block mb-1">ملاحظات (اختياري)</label>
              <textarea value={addNotes} onChange={e => setAddNotes(e.target.value)}
                placeholder="أي ملاحظات..." rows={2}
                className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50 resize-none text-sm"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowAdd(false); setRows([emptyRow()]); setAddNotes(""); }}
                className="flex-1 rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg">
                إلغاء
              </button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-[2] rounded-2xl bg-green hover:bg-green-dark disabled:opacity-50 px-6 py-3 font-bold text-white">
                {saving ? "جاري الحفظ..." : "💾 حفظ المبيعات"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal التعديل ══ */}
      {editSale && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-xl font-bold text-cream">تعديل سجل البيع</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">المشترٍ</label>
                <select value={editRow.buyer_id} onChange={e => setEditRow({ ...editRow, buyer_id: e.target.value })} className={selectCls}>
                  <option value="">— بدون مشترٍ —</option>
                  {buyers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">المورد</label>
                <select value={editRow.supplier_id} onChange={e => setEditRow({ ...editRow, supplier_id: e.target.value })} className={selectCls}>
                  <option value="">— بدون مورد —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">النوع *</label>
                <select value={editRow.item_type_id} onChange={e => setEditRow({ ...editRow, item_type_id: e.target.value })} className={selectCls}>
                  <option value="">— اختر —</option>
                  {itemTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">العدد *</label>
                <input type="number" step="0.25" min="0" value={editRow.quantity}
                  onChange={e => setEditRow({ ...editRow, quantity: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">الوزن (كجم) *</label>
                <input type="number" step="0.01" min="0" value={editRow.weight}
                  onChange={e => setEditRow({ ...editRow, weight: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">السعر (ر.س) *</label>
                <input type="number" step="0.01" min="0" value={editRow.price}
                  onChange={e => setEditRow({ ...editRow, price: e.target.value })}
                  className={inputCls} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditSale(null)}
                className="flex-1 rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg">
                إلغاء
              </button>
              <button onClick={handleEditSave} disabled={saving}
                className="flex-[2] rounded-2xl bg-green hover:bg-green-dark disabled:opacity-50 px-6 py-3 font-bold text-white">
                {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
