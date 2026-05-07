"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Supplier { id: string; name: string; }
interface Branch { id: string; name: string; }
interface Purchase {
  id: string;
  branch_id: string;
  supplier_id: string | null;
  item_type_id: string;
  quantity: number;
  weight: number;
  price: number;
  suppliers?: { name: string };
  item_types?: { id: string; name: string; name_en: string };
}

interface PurchaseItem {
  supplier_id: string;
  item_type_id: string;
  quantity: string;
  weight: string;
  price: string;
}

interface ItemType {
  id: string;
  name: string;
}

const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmt = (v: number) => v.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const emptyItem = (): PurchaseItem => ({ supplier_id: "", item_type_id: "", quantity: "", weight: "", price: "" });

export default function PurchasesPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [editItem, setEditItem] = useState<PurchaseItem>({ supplier_id: "", item_type_id: "", quantity: "", weight: "", price: "" });

  const [targetDate, setTargetDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [selectedBranch, setSelectedBranch] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");

  // ── تعديل أسعار جماعية ──
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDateFrom, setBulkDateFrom] = useState("");
  const [bulkDateTo, setBulkDateTo] = useState("");
  const [bulkSupplierId, setBulkSupplierId] = useState("");
  const [bulkItemTypeId, setBulkItemTypeId] = useState("");
  const [bulkPricePerUnit, setBulkPricePerUnit] = useState("");
  const [bulkPricingMethod, setBulkPricingMethod] = useState<"quantity" | "weight">("quantity");
  const [bulkPreview, setBulkPreview] = useState<{ count: number; rows: any[] } | null>(null);
  const [bulkPreviewing, setBulkPreviewing] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ updated: number } | null>(null);

  useEffect(() => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    setTargetDate(dateStr);
    loadData(dateStr);
  }, []);

  async function loadData(date: string) {
    setLoading(true);
    try {
      const [suppRes, branchRes, purchRes, itemTypesRes, pricesRes] = await Promise.all([
        fetch("/api/suppliers"),
        fetch("/api/admin/branches"),
        fetch(`/api/purchases?date=${date}`),
        fetch("/api/item-types"),
        fetch("/api/supplier-prices"),
      ]);

      const suppData = await suppRes.json();
      const branchData = await branchRes.json();
      const purchData = await purchRes.json();
      const itemTypesData = await itemTypesRes.json();
      const pricesData = await pricesRes.json();

      setSuppliers(suppData.suppliers || []);
      setBranches(branchData.branches || []);
      setPurchases(purchData.purchases || []);
      setItemTypes(itemTypesData.itemTypes || []);
      setPrices(pricesData.prices || []);
    } finally {
      setLoading(false);
    }
  }

  function addItem() {
    if (items.length < 10) setItems([...items, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof PurchaseItem, value: string) {
    const updated = [...items];
    updated[index][field] = value;

    // حساب السعر تلقائياً عند اختيار المورد أو الصنف أو تغيير الكمية/الوزن
    if (field === 'supplier_id' || field === 'item_type_id' || field === 'quantity' || field === 'weight') {
      const item = updated[index];
      if (item.supplier_id && item.item_type_id) {
        const priceInfo = prices.find(p =>
          p.supplier_id === item.supplier_id && p.item_type_id === item.item_type_id
        );
        if (priceInfo) {
          const pricePerUnit = toN(priceInfo.price_per_unit);
          const method = priceInfo.pricing_method || 'quantity';
          if (method === 'quantity' && item.quantity) {
            updated[index].price = (pricePerUnit * toN(item.quantity)).toFixed(2);
          } else if (method === 'weight' && item.weight) {
            updated[index].price = (pricePerUnit * toN(item.weight)).toFixed(2);
          }
        }
      }
    }

    setItems(updated);
  }

  async function handleSubmit() {
    if (!selectedBranch) { alert("الرجاء اختيار الفرع"); return; }

    const validItems = items.filter(item =>
      item.item_type_id && item.quantity && item.weight && item.price
    );

    if (validItems.length === 0) { alert("الرجاء تعبئة بيانات صنف واحد على الأقل"); return; }

    setSaving(true);
    try {
      const results = await Promise.all(
        validItems.map(item =>
          fetch("/api/purchases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              branch_id: selectedBranch,
              supplier_id: item.supplier_id,
              purchase_date: targetDate,
              item_type_id: item.item_type_id,
              quantity: parseFloat(item.quantity),
              weight: parseFloat(item.weight),
              price: parseFloat(item.price),
              notes: notes || null,
            }),
          })
        )
      );

      // التحقق من أخطاء الحفظ
      for (const res of results) {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "فشل الحفظ");
        }
      }

      setShowAddModal(false);
      setSelectedBranch("");
      setItems([emptyItem()]);
      setNotes("");
      loadData(targetDate);
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(p: Purchase) {
    setEditPurchase(p);
    setEditItem({
      supplier_id: p.supplier_id || "",
      item_type_id: p.item_type_id,
      quantity: String(p.quantity),
      weight: String(p.weight),
      price: String(p.price),
    });
  }

  async function handleEditSave() {
    if (!editPurchase) return;
    if (!editItem.item_type_id || !editItem.quantity || !editItem.weight || !editItem.price) {
      alert("الرجاء تعبئة جميع الحقول المطلوبة"); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/purchases?id=${editPurchase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: editItem.supplier_id || null,
          item_type_id: editItem.item_type_id,
          quantity: parseFloat(editItem.quantity),
          weight: parseFloat(editItem.weight),
          price: parseFloat(editItem.price),
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل التعديل"); }
      setEditPurchase(null);
      loadData(targetDate);
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء التعديل");
    } finally {
      setSaving(false);
    }
  }

  // معاينة السجلات المتأثرة
  async function handleBulkPreview() {
    if (!bulkDateFrom || !bulkDateTo || !bulkItemTypeId) return;
    setBulkPreviewing(true);
    setBulkPreview(null);
    try {
      const params = new URLSearchParams({ dateFrom: bulkDateFrom, dateTo: bulkDateTo, item_type_id: bulkItemTypeId });
      if (bulkSupplierId) params.set("supplier_id", bulkSupplierId);
      const res = await fetch(`/api/purchases/bulk-update-price?${params}`);
      const json = await res.json();
      setBulkPreview({ count: json.count ?? 0, rows: json.rows ?? [] });
    } finally {
      setBulkPreviewing(false);
    }
  }

  // تنفيذ التحديث الجماعي
  async function handleBulkSubmit() {
    if (!bulkDateFrom || !bulkDateTo || !bulkItemTypeId || !bulkPricePerUnit) {
      alert("الرجاء تعبئة جميع الحقول المطلوبة"); return;
    }
    if (!bulkPreview || bulkPreview.count === 0) {
      alert("لا توجد سجلات لتحديثها"); return;
    }
    if (!confirm(`سيتم تحديث ${bulkPreview.count} سجل. هل أنت متأكد؟`)) return;
    setBulkSaving(true);
    try {
      const res = await fetch("/api/purchases/bulk-update-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom: bulkDateFrom,
          dateTo: bulkDateTo,
          supplier_id: bulkSupplierId || null,
          item_type_id: bulkItemTypeId,
          price_per_unit: parseFloat(bulkPricePerUnit),
          pricing_method: bulkPricingMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || "فشل التحديث"); return; }
      setBulkResult({ updated: json.updated });
      setBulkPreview(null);
      loadData(targetDate);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setBulkSaving(false);
    }
  }

  function resetBulkModal() {
    setShowBulkModal(false);
    setBulkDateFrom(""); setBulkDateTo(""); setBulkSupplierId("");
    setBulkItemTypeId(""); setBulkPricePerUnit(""); setBulkPricingMethod("quantity");
    setBulkPreview(null); setBulkResult(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      const res = await fetch(`/api/purchases?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      loadData(targetDate);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    }
  }

  function handleDateChange(newDate: string) {
    setTargetDate(newDate);
    setShowDatePicker(false);
    loadData(newDate);
  }

  const purchasesByBranch: Record<string, Purchase[]> = {};
  purchases.forEach(p => {
    const bid = (p as any).branch_id;
    if (!purchasesByBranch[bid]) purchasesByBranch[bid] = [];
    purchasesByBranch[bid].push(p);
  });

  const stats = {
    total: purchases.length,
    totalWeight: purchases.reduce((s, p) => s + toN(p.weight), 0),
    totalPrice: purchases.reduce((s, p) => s + toN(p.price), 0),
  };

  let targetDateFormatted = "...";
  try {
    targetDateFormatted = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: "Asia/Riyadh",
    }).format(new Date(targetDate + "T12:00:00"));
  } catch {
    targetDateFormatted = targetDate;
  }

  return (
    <div className="min-h-screen bg-bg text-cream p-6">
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-black mb-2">نظام المشتريات</h1>
            <p className="text-muted">إدارة المشتريات اليومية لكل الفروع</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/dashboard/prices')}
              className="rounded-2xl bg-amber-500 hover:bg-amber-600 px-6 py-3 font-bold text-white transition-all">
              الأسعار
            </button>
            <button onClick={() => { setBulkResult(null); setBulkPreview(null); setShowBulkModal(true); }}
              className="rounded-2xl bg-orange-500 hover:bg-orange-600 px-6 py-3 font-bold text-white transition-all">
              تعديل أسعار جماعي
            </button>
            <button onClick={() => router.push('/dashboard/item-types')}
              className="rounded-2xl bg-blue-500 hover:bg-blue-600 px-6 py-3 font-bold text-white transition-all">
              الأصناف
            </button>
            <button onClick={() => router.push('/dashboard/suppliers')}
              className="rounded-2xl bg-purple-500 hover:bg-purple-600 px-6 py-3 font-bold text-white transition-all">
              الموردين
            </button>
            <button onClick={() => setShowAddModal(true)}
              className="rounded-2xl bg-green hover:bg-green-dark px-6 py-3 font-bold text-white transition-all">
              + إضافة مشترى جديد
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="bg-card rounded-3xl border border-line p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted text-sm mb-1">مشتريات يوم</p>
              <p className="text-cream text-2xl font-bold">{targetDateFormatted}</p>
            </div>
            <button onClick={() => setShowDatePicker(!showDatePicker)}
              className="rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg transition-all">
              العودة لتواريخ أقدم
            </button>
          </div>
          {showDatePicker && (
            <div className="mt-4 pt-4 border-t border-line">
              <input type="date" value={targetDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50"
              />
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="rounded-3xl border border-line bg-card p-6">
            <p className="text-muted text-sm mb-2">إجمالي المشتريات</p>
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

        <div className="rounded-[28px] border border-line bg-card p-6">
          <h2 className="text-xl font-bold mb-4">قائمة المشتريات</h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-green border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-muted">جاري التحميل...</p>
            </div>
          ) : Object.keys(purchasesByBranch).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted text-lg mb-4">لا توجد مشتريات لهذا اليوم</p>
              <button onClick={() => setShowAddModal(true)}
                className="rounded-2xl bg-green hover:bg-green-dark px-6 py-3 font-bold text-white">
                + إضافة أول مشترى
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(purchasesByBranch).map(([branchId, branchPurchases]) => {
                const branch = branches.find(b => b.id === branchId);
                const branchTotal = branchPurchases.reduce((s, p) => s + toN(p.price), 0);
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
                          {branchPurchases.map(p => (
                            <tr key={p.id} className="border-b border-line/50">
                              <td className="p-2 text-sm">{p.suppliers?.name || "-"}</td>
                              <td className="p-2 font-medium">{p.item_types?.name || "-"}</td>
                              <td className="p-2 font-bold ltr-num" dir="ltr">{p.quantity}</td>
                              <td className="p-2 font-bold ltr-num" dir="ltr">{fmt(p.weight)} <span className="text-xs text-muted">كجم</span></td>
                              <td className="p-2 font-bold ltr-num" dir="ltr">{fmt(p.price)} <span className="text-xs text-muted">ر</span></td>
                              <td className="p-2">
                                 <div className="flex gap-2 justify-center">
                                   <button onClick={() => openEdit(p)}
                                     className="rounded-lg bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1 text-blue-400 text-sm">
                                     تعديل
                                   </button>
                                   <button onClick={() => handleDelete(p.id)}
                                     className="rounded-lg bg-red/10 hover:bg-red/20 px-3 py-1 text-red text-sm">
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

      {/* Modal التعديل */}
      {editPurchase && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-5">تعديل المشترى</h2>
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
                <div>
                  <label className="text-sm text-muted block mb-1">العدد *</label>
                  <input type="number" value={editItem.quantity}
                    onChange={e => setEditItem({ ...editItem, quantity: e.target.value })}
                    className="w-full rounded-xl bg-bg border border-line px-3 py-3 text-cream focus:outline-none focus:border-green/50" />
                </div>
                <div>
                  <label className="text-sm text-muted block mb-1">الوزن *</label>
                  <input type="number" step="0.01" value={editItem.weight}
                    onChange={e => setEditItem({ ...editItem, weight: e.target.value })}
                    className="w-full rounded-xl bg-bg border border-line px-3 py-3 text-cream focus:outline-none focus:border-green/50" />
                </div>
                <div>
                  <label className="text-sm text-muted block mb-1">السعر *</label>
                  <input type="number" step="0.01" value={editItem.price}
                    onChange={e => setEditItem({ ...editItem, price: e.target.value })}
                    className="w-full rounded-xl bg-bg border border-line px-3 py-3 text-cream focus:outline-none focus:border-green/50" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditPurchase(null)}
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

      {/* ── Modal تعديل أسعار جماعي ── */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-2xl my-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">تعديل أسعار جماعي</h2>
                <p className="text-muted text-sm mt-1">حدد الفترة والمورد والصنف والسعر الجديد</p>
              </div>
              <button onClick={resetBulkModal} className="text-muted hover:text-cream text-2xl leading-none">×</button>
            </div>

            {bulkResult ? (
              /* ── نتيجة التحديث ── */
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✓</span>
                </div>
                <p className="text-cream text-2xl font-black mb-2">تم التحديث بنجاح!</p>
                <p className="text-muted">تم تحديث <span className="text-green font-bold text-xl">{bulkResult.updated}</span> سجل</p>
                <button onClick={resetBulkModal}
                  className="mt-6 rounded-2xl bg-green hover:bg-green-dark px-8 py-3 font-bold text-white">
                  إغلاق
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* الفترة الزمنية */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted block mb-1">من تاريخ *</label>
                    <input type="date" value={bulkDateFrom} onChange={e => { setBulkDateFrom(e.target.value); setBulkPreview(null); }}
                      className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50" />
                  </div>
                  <div>
                    <label className="text-sm text-muted block mb-1">إلى تاريخ *</label>
                    <input type="date" value={bulkDateTo} onChange={e => { setBulkDateTo(e.target.value); setBulkPreview(null); }}
                      className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50" />
                  </div>
                </div>

                {/* المورد */}
                <div>
                  <label className="text-sm text-muted block mb-1">المورد <span className="text-muted/60">(اتركه فارغاً لكل الموردين)</span></label>
                  <select value={bulkSupplierId} onChange={e => { setBulkSupplierId(e.target.value); setBulkPreview(null); }}
                    className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50">
                    <option value="">كل الموردين</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* الصنف */}
                <div>
                  <label className="text-sm text-muted block mb-1">الصنف *</label>
                  <select value={bulkItemTypeId} onChange={e => { setBulkItemTypeId(e.target.value); setBulkPreview(null); }}
                    className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50">
                    <option value="">اختر الصنف</option>
                    {itemTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                {/* طريقة التسعير والسعر */}
                <div>
                  <label className="text-sm text-muted block mb-2">طريقة التسعير *</label>
                  <div className="flex gap-3 mb-3">
                    <button onClick={() => setBulkPricingMethod("quantity")}
                      className={`flex-1 rounded-xl py-2.5 font-bold text-sm border transition-all ${bulkPricingMethod === "quantity" ? "bg-orange-500 border-orange-500 text-white" : "bg-card-hi border-line text-muted hover:text-cream"}`}>
                      بالعدد (سعر / رأس)
                    </button>
                    <button onClick={() => setBulkPricingMethod("weight")}
                      className={`flex-1 rounded-xl py-2.5 font-bold text-sm border transition-all ${bulkPricingMethod === "weight" ? "bg-blue-500 border-blue-500 text-white" : "bg-card-hi border-line text-muted hover:text-cream"}`}>
                      بالكيلو (سعر / كجم)
                    </button>
                  </div>
                  <input type="number" step="0.01" min="0.01" value={bulkPricePerUnit}
                    onChange={e => setBulkPricePerUnit(e.target.value)}
                    placeholder={bulkPricingMethod === "weight" ? "السعر لكل كيلوجرام (ر.س)" : "السعر لكل رأس (ر.س)"}
                    className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-orange-500/50 text-lg font-bold" />
                  {bulkPricePerUnit && Number(bulkPricePerUnit) > 0 && (
                    <p className="text-orange-400 text-xs mt-1">
                      كل {bulkPricingMethod === "weight" ? "كيلوجرام" : "رأس"} = {Number(bulkPricePerUnit).toLocaleString("ar-SA-u-nu-latn")} ر.س
                    </p>
                  )}
                </div>

                {/* زر المعاينة */}
                <button
                  onClick={handleBulkPreview}
                  disabled={!bulkDateFrom || !bulkDateTo || !bulkItemTypeId || bulkPreviewing}
                  className="w-full rounded-2xl border border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 disabled:opacity-40 py-3 font-bold text-orange-400 transition-all">
                  {bulkPreviewing ? "⏳ جاري المعاينة..." : "🔍 معاينة السجلات المتأثرة"}
                </button>

                {/* نتيجة المعاينة */}
                {bulkPreview !== null && (
                  <div className={`rounded-2xl border p-4 ${bulkPreview.count > 0 ? "border-orange-500/30 bg-orange-500/5" : "border-line bg-card-hi"}`}>
                    {bulkPreview.count === 0 ? (
                      <p className="text-muted text-center text-sm">لا توجد سجلات تطابق المعايير المحددة</p>
                    ) : (
                      <>
                        <p className="text-orange-400 font-bold mb-3">
                          سيتم تحديث <span className="text-xl">{bulkPreview.count}</span> سجل
                          {bulkPricePerUnit && Number(bulkPricePerUnit) > 0 && (
                            <span className="text-muted font-normal text-sm mr-2">
                              (الإجمالي المتوقع:{" "}
                              {bulkPreview.rows.reduce((s, r) => {
                                const v = bulkPricingMethod === "weight"
                                  ? Number(bulkPricePerUnit) * (Number(r.weight) || 0)
                                  : Number(bulkPricePerUnit) * (Number(r.quantity) || 0);
                                return s + v;
                              }, 0).toLocaleString("ar-SA-u-nu-latn")} ر.س)
                            </span>
                          )}
                        </p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {bulkPreview.rows.slice(0, 20).map((r: any) => (
                            <div key={r.id} className="flex items-center justify-between text-xs bg-bg/50 rounded-lg px-3 py-1.5">
                              <span className="text-muted">{r.purchase_date}</span>
                              <span className="text-cream">{(r.branches as any)?.name ?? "—"}</span>
                              <span className="text-muted">{(r.suppliers as any)?.name ?? "كل الموردين"}</span>
                              <span className="text-amber-400 font-bold">
                                {r.price} → {
                                  bulkPricePerUnit && Number(bulkPricePerUnit) > 0
                                    ? (bulkPricingMethod === "weight"
                                      ? (Number(bulkPricePerUnit) * (Number(r.weight) || 0)).toFixed(2)
                                      : (Number(bulkPricePerUnit) * (Number(r.quantity) || 0)).toFixed(2))
                                    : "?"
                                } ر
                              </span>
                            </div>
                          ))}
                          {bulkPreview.count > 20 && (
                            <p className="text-muted text-xs text-center pt-1">و {bulkPreview.count - 20} سجل آخر...</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* أزرار التنفيذ */}
                <div className="flex gap-3 pt-2">
                  <button onClick={resetBulkModal}
                    className="flex-1 rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg">
                    إلغاء
                  </button>
                  <button
                    onClick={handleBulkSubmit}
                    disabled={bulkSaving || !bulkPreview || bulkPreview.count === 0 || !bulkPricePerUnit || Number(bulkPricePerUnit) <= 0}
                    className="flex-[2] rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 px-6 py-3 font-bold text-white transition-all">
                    {bulkSaving ? "⏳ جاري التحديث..." : `✏️ تحديث ${bulkPreview?.count ?? 0} سجل`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-4xl my-8">
            <h2 className="text-2xl font-bold mb-6">إضافة مشتريات جديدة</h2>

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
                  <button onClick={addItem} className="text-green hover:underline text-sm">
                    + إضافة صنف آخر
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="bg-bg/50 rounded-xl p-4 border border-line relative">
                    {items.length > 1 && (
                      <button onClick={() => removeItem(index)}
                        className="absolute top-2 left-2 text-red hover:bg-red/10 rounded-lg px-2 py-1 text-sm">
                        حذف
                      </button>
                    )}
                    <p className="text-xs text-muted mb-3">الصنف {index + 1}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <select value={item.supplier_id}
                        onChange={e => updateItem(index, 'supplier_id', e.target.value)}
                        className="rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50">
                        <option value="">المورد</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select value={item.item_type_id}
                        onChange={e => updateItem(index, 'item_type_id', e.target.value)}
                        className="rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50">
                        <option value="">الصنف</option>
                        {itemTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <input type="number" value={item.quantity}
                        onChange={e => updateItem(index, 'quantity', e.target.value)}
                        placeholder="العدد" min="1"
                        className="rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50"
                      />
                      <input type="number" step="0.01" value={item.weight}
                        onChange={e => updateItem(index, 'weight', e.target.value)}
                        placeholder="الوزن (كجم)"
                        className="rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50"
                      />
                      <input type="number" step="0.01" value={item.price}
                        onChange={e => updateItem(index, 'price', e.target.value)}
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
                className="flex-1 rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg">
                إلغاء
              </button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-[2] rounded-2xl bg-green hover:bg-green-dark disabled:opacity-50 px-6 py-3 font-bold text-white">
                {saving ? "جاري الحفظ..." : "حفظ المشتريات"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
