"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Supplier { id: string; name: string; }
interface Branch   { id: string; name: string; }
interface Sale {
  id: string;
  branch_id: string;
  supplier_id: string | null;
  item_type_id: string;
  quantity: number;
  weight: number;
  price: number;
  suppliers?:  { name: string };
  item_types?: { id: string; name: string; name_en: string };
}
interface SaleItem {
  supplier_id: string;
  item_type_id: string;
  quantity: string;
  weight: string;
  price: string;
}
interface ItemType { id: string; name: string; }

const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmt = (v: number)  => v.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const emptyItem = (): SaleItem => ({ supplier_id: "", item_type_id: "", quantity: "", weight: "", price: "" });

export default function ExternalSalesPage() {
  const router = useRouter();
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([]);
  const [branches,   setBranches]   = useState<Branch[]>([]);
  const [sales,      setSales]      = useState<Sale[]>([]);
  const [itemTypes,  setItemTypes]  = useState<ItemType[]>([]);
  const [prices,     setPrices]     = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [editSale,      setEditSale]      = useState<Sale | null>(null);
  const [editItem,      setEditItem]      = useState<SaleItem>(emptyItem());
  const [targetDate,    setTargetDate]    = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [items,  setItems]  = useState<SaleItem[]>([emptyItem()]);
  const [notes,  setNotes]  = useState("");

  useEffect(() => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const d = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    setTargetDate(d);
    loadData(d);
  }, []);

  async function loadData(date: string) {
    setLoading(true);
    try {
      const [suppRes, branchRes, salesRes, typesRes, pricesRes] = await Promise.all([
        fetch("/api/suppliers"),
        fetch("/api/admin/branches"),
        fetch(`/api/external-sales?date=${date}`),
        fetch("/api/item-types"),
        fetch("/api/supplier-prices"),
      ]);
      const [suppData, branchData, salesData, typesData, pricesData] = await Promise.all([
        suppRes.json(), branchRes.json(), salesRes.json(), typesRes.json(), pricesRes.json(),
      ]);
      setSuppliers(suppData.suppliers     || []);
      setBranches(branchData.branches     || []);
      setSales(salesData.sales            || []);
      setItemTypes(typesData.itemTypes    || []);
      setPrices(pricesData.prices         || []);
    } finally {
      setLoading(false);
    }
  }

  function addItem()                            { if (items.length < 10) setItems([...items, emptyItem()]); }
  function removeItem(i: number)                { setItems(items.filter((_, idx) => idx !== i)); }

  function updateItem(index: number, field: keyof SaleItem, value: string) {
    const updated = [...items];
    updated[index][field] = value;
    if (["supplier_id", "item_type_id", "quantity", "weight"].includes(field)) {
      const it = updated[index];
      if (it.supplier_id && it.item_type_id) {
        const p = prices.find(p => p.supplier_id === it.supplier_id && p.item_type_id === it.item_type_id);
        if (p) {
          const ppu = toN(p.price_per_unit);
          const m   = p.pricing_method || "quantity";
          if (m === "quantity" && it.quantity) updated[index].price = (ppu * toN(it.quantity)).toFixed(2);
          else if (m === "weight" && it.weight) updated[index].price = (ppu * toN(it.weight)).toFixed(2);
        }
      }
    }
    setItems(updated);
  }

  async function handleSubmit() {
    if (!selectedBranch) { alert("الرجاء اختيار الفرع"); return; }
    const valid = items.filter(it => it.item_type_id && it.quantity && it.weight && it.price);
    if (!valid.length) { alert("الرجاء تعبئة صنف واحد على الأقل"); return; }
    setSaving(true);
    try {
      const results = await Promise.all(valid.map(it =>
        fetch("/api/external-sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branch_id:   selectedBranch,
            supplier_id: it.supplier_id || null,
            sale_date:   targetDate,
            item_type_id: it.item_type_id,
            quantity:    parseInt(it.quantity),
            weight:      parseFloat(it.weight),
            price:       parseFloat(it.price),
            notes:       notes || null,
          }),
        })
      ));
      for (const res of results) {
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل الحفظ"); }
      }
      setShowAddModal(false);
      setSelectedBranch(""); setItems([emptyItem()]); setNotes("");
      loadData(targetDate);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally { setSaving(false); }
  }

  function openEdit(s: Sale) {
    setEditSale(s);
    setEditItem({ supplier_id: s.supplier_id || "", item_type_id: s.item_type_id,
                  quantity: String(s.quantity), weight: String(s.weight), price: String(s.price) });
  }

  async function handleEditSave() {
    if (!editSale) return;
    if (!editItem.item_type_id || !editItem.quantity || !editItem.weight || !editItem.price) {
      alert("الرجاء تعبئة جميع الحقول"); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/external-sales?id=${editSale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id:  editItem.supplier_id || null,
          item_type_id: editItem.item_type_id,
          quantity:  parseInt(editItem.quantity),
          weight:    parseFloat(editItem.weight),
          price:     parseFloat(editItem.price),
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل التعديل"); }
      setEditSale(null);
      loadData(targetDate);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      const res = await fetch(`/api/external-sales?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      loadData(targetDate);
    } catch (err: any) { alert(err.message || "حدث خطأ"); }
  }

  function handleDateChange(d: string) { setTargetDate(d); setShowDatePicker(false); loadData(d); }

  const salesByBranch: Record<string, Sale[]> = {};
  sales.forEach(s => {
    const bid = (s as any).branch_id;
    if (!salesByBranch[bid]) salesByBranch[bid] = [];
    salesByBranch[bid].push(s);
  });

  const stats = {
    total:       sales.length,
    totalWeight: sales.reduce((s, p) => s + toN(p.weight), 0),
    totalPrice:  sales.reduce((s, p) => s + toN(p.price),  0),
  };

  let targetDateFormatted = "...";
  try {
    targetDateFormatted = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh",
    }).format(new Date(targetDate + "T12:00:00"));
  } catch { targetDateFormatted = targetDate; }

  return (
    <div className="min-h-screen bg-bg text-cream p-6">
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-black mb-2">المبيعات الخارجية</h1>
            <p className="text-muted">إدارة المبيعات الخارجية اليومية لكل الفروع</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => router.push("/dashboard/prices")}
              className="rounded-2xl bg-amber-500 hover:bg-amber-600 px-6 py-3 font-bold text-white">
              الأسعار
            </button>
            <button onClick={() => router.push("/dashboard/item-types")}
              className="rounded-2xl bg-blue-500 hover:bg-blue-600 px-6 py-3 font-bold text-white">
              الأصناف
            </button>
            <button onClick={() => router.push("/dashboard/suppliers")}
              className="rounded-2xl bg-purple-500 hover:bg-purple-600 px-6 py-3 font-bold text-white">
              الموردين
            </button>
            <button onClick={() => setShowAddModal(true)}
              className="rounded-2xl bg-green hover:bg-green-dark px-6 py-3 font-bold text-white">
              + إضافة بيع جديد
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* التاريخ */}
        <div className="bg-card rounded-3xl border border-line p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted text-sm mb-1">مبيعات يوم</p>
              <p className="text-cream text-2xl font-bold">{targetDateFormatted}</p>
            </div>
            <button onClick={() => setShowDatePicker(!showDatePicker)}
              className="rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg">
              العودة لتواريخ أقدم
            </button>
          </div>
          {showDatePicker && (
            <div className="mt-4 pt-4 border-t border-line">
              <input type="date" value={targetDate}
                onChange={e => handleDateChange(e.target.value)}
                className="rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50"
              />
            </div>
          )}
        </div>

        {/* الإحصائيات */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="rounded-3xl border border-line bg-card p-6">
            <p className="text-muted text-sm mb-2">إجمالي السجلات</p>
            <p className="text-4xl font-black text-green">{stats.total}</p>
          </div>
          <div className="rounded-3xl border border-line bg-card p-6">
            <p className="text-muted text-sm mb-2">إجمالي الوزن</p>
            <p className="text-4xl font-black text-blue-500 ltr-num" dir="ltr">{fmt(stats.totalWeight)} <span className="text-lg">كجم</span></p>
          </div>
          <div className="rounded-3xl border border-line bg-card p-6">
            <p className="text-muted text-sm mb-2">إجمالي السعر</p>
            <p className="text-4xl font-black text-amber-500 ltr-num" dir="ltr">{fmt(stats.totalPrice)} <span className="text-lg">ر</span></p>
          </div>
        </div>

        {/* قائمة المبيعات */}
        <div className="rounded-[28px] border border-line bg-card p-6">
          <h2 className="text-xl font-bold mb-4">قائمة المبيعات الخارجية</h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-green border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-muted">جاري التحميل...</p>
            </div>
          ) : Object.keys(salesByBranch).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted text-lg mb-4">لا توجد مبيعات خارجية لهذا اليوم</p>
              <button onClick={() => setShowAddModal(true)}
                className="rounded-2xl bg-green hover:bg-green-dark px-6 py-3 font-bold text-white">
                + إضافة أول سجل
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(salesByBranch).map(([branchId, branchSales]) => {
                const branch     = branches.find(b => b.id === branchId);
                const branchTotal = branchSales.reduce((s, p) => s + toN(p.price), 0);
                return (
                  <div key={branchId} className="bg-card-hi rounded-2xl border border-line overflow-hidden">
                    <div className="bg-bg px-4 py-3 border-b border-line flex items-center justify-between">
                      <h3 className="text-cream font-bold text-lg">{branch?.name || "فرع"}</h3>
                      <p className="text-green font-bold">{fmt(branchTotal)} ر</p>
                    </div>
                    <div className="p-4">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-line text-muted text-sm">
                            <th className="p-2 text-right">المورد</th>
                            <th className="p-2 text-right">الصنف</th>
                            <th className="p-2 text-right">العدد</th>
                            <th className="p-2 text-right">الوزن</th>
                            <th className="p-2 text-right">السعر</th>
                            <th className="p-2 text-center">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {branchSales.map(s => (
                            <tr key={s.id} className="border-b border-line/50">
                              <td className="p-2 text-sm">{s.suppliers?.name  || "-"}</td>
                              <td className="p-2 font-medium">{s.item_types?.name || "-"}</td>
                              <td className="p-2 font-bold ltr-num" dir="ltr">{s.quantity}</td>
                              <td className="p-2 font-bold ltr-num" dir="ltr">{fmt(s.weight)} <span className="text-xs text-muted">كجم</span></td>
                              <td className="p-2 font-bold ltr-num" dir="ltr">{fmt(s.price)} <span className="text-xs text-muted">ر</span></td>
                              <td className="p-2">
                                <div className="flex gap-2 justify-center">
                                  <button onClick={() => openEdit(s)}
                                    className="rounded-lg bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1 text-blue-400 text-sm">تعديل</button>
                                  <button onClick={() => handleDelete(s.id)}
                                    className="rounded-lg bg-red/10 hover:bg-red/20 px-3 py-1 text-red text-sm">حذف</button>
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

      {/* Modal التعديل */}
      {editSale && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-5">تعديل سجل البيع</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted block mb-1">المورد</label>
                <select value={editItem.supplier_id}
                  onChange={e => setEditItem({ ...editItem, supplier_id: e.target.value })}
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50">
                  <option value="">بدون مورد</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">الصنف *</label>
                <select value={editItem.item_type_id}
                  onChange={e => setEditItem({ ...editItem, item_type_id: e.target.value })}
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50">
                  <option value="">اختر الصنف</option>
                  {itemTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "العدد *",    field: "quantity" as keyof SaleItem },
                  { label: "الوزن *",    field: "weight"   as keyof SaleItem },
                  { label: "السعر *",    field: "price"    as keyof SaleItem },
                ].map(({ label, field }) => (
                  <div key={field}>
                    <label className="text-sm text-muted block mb-1">{label}</label>
                    <input type="number" step="0.01" value={editItem[field]}
                      onChange={e => setEditItem({ ...editItem, [field]: e.target.value })}
                      className="w-full rounded-xl bg-bg border border-line px-3 py-3 text-cream focus:outline-none focus:border-green/50" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditSale(null)}
                className="flex-1 rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg">إلغاء</button>
              <button onClick={handleEditSave} disabled={saving}
                className="flex-[2] rounded-2xl bg-green hover:bg-green-dark disabled:opacity-50 px-6 py-3 font-bold text-white">
                {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal الإضافة */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-4xl my-8">
            <h2 className="text-2xl font-bold mb-6">إضافة مبيعات خارجية جديدة</h2>
            <div className="mb-6">
              <label className="text-sm text-muted block mb-2">الفرع *</label>
              <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50">
                <option value="">اختر الفرع</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm text-muted">إضافة أصناف (حتى 10)</label>
                {items.length < 10 && (
                  <button onClick={addItem} className="text-green hover:underline text-sm">+ إضافة صنف آخر</button>
                )}
              </div>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="bg-bg/50 rounded-xl p-4 border border-line relative">
                    {items.length > 1 && (
                      <button onClick={() => removeItem(index)}
                        className="absolute top-2 left-2 text-red hover:bg-red/10 rounded-lg px-2 py-1 text-sm">حذف</button>
                    )}
                    <p className="text-xs text-muted mb-3">الصنف {index + 1}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <select value={item.supplier_id}
                        onChange={e => updateItem(index, "supplier_id", e.target.value)}
                        className="rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50">
                        <option value="">المورد</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select value={item.item_type_id}
                        onChange={e => updateItem(index, "item_type_id", e.target.value)}
                        className="rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50">
                        <option value="">الصنف</option>
                        {itemTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <input type="number" value={item.quantity}
                        onChange={e => updateItem(index, "quantity", e.target.value)}
                        placeholder="العدد" min="1"
                        className="rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50"
                      />
                      <input type="number" step="0.01" value={item.weight}
                        onChange={e => updateItem(index, "weight", e.target.value)}
                        placeholder="الوزن (كجم)"
                        className="rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50"
                      />
                      <input type="number" step="0.01" value={item.price}
                        onChange={e => updateItem(index, "price", e.target.value)}
                        placeholder="السعر (ر)"
                        className="rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50 col-span-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-sm text-muted block mb-2">ملاحظات</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="أي ملاحظات إضافية..." rows={3}
                className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setShowAddModal(false); setSelectedBranch(""); setItems([emptyItem()]); setNotes(""); }}
                className="flex-1 rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg">إلغاء</button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-[2] rounded-2xl bg-green hover:bg-green-dark disabled:opacity-50 px-6 py-3 font-bold text-white">
                {saving ? "جاري الحفظ..." : "حفظ المبيعات الخارجية"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
