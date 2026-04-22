"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PricesPage() {
  const router = useRouter();
  const [prices, setPrices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [itemTypes, setItemTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    supplier_id: "",
    item_type_id: "",
    price_per_unit: "",
    pricing_method: "quantity"
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [pricesRes, suppRes, itemsRes] = await Promise.all([
        fetch("/api/supplier-prices"),
        fetch("/api/suppliers"),
        fetch("/api/item-types")
      ]);
      
      const pricesData = await pricesRes.json();
      const suppData = await suppRes.json();
      const itemsData = await itemsRes.json();
      
      setPrices(pricesData.prices || []);
      setSuppliers(suppData.suppliers || []);
      setItemTypes(itemsData.itemTypes || []);
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    setEditingId(null);
    setFormData({ supplier_id: "", item_type_id: "", price_per_unit: "", pricing_method: "quantity" });
    setShowModal(true);
  }

  function handleEdit(price: any) {
    setEditingId(price.id);
    setFormData({
      supplier_id: price.supplier_id,
      item_type_id: price.item_type_id,
      price_per_unit: price.price_per_unit,
      pricing_method: price.pricing_method || "quantity"
    });
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!formData.supplier_id || !formData.item_type_id || !formData.price_per_unit) {
      alert("الرجاء تعبئة كل الحقول");
      return;
    }
    
    setSaving(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId 
        ? { id: editingId, price_per_unit: formData.price_per_unit }
        : formData;
      
      const res = await fetch("/api/supplier-prices", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "فشل الحفظ");
      }
      
      setShowModal(false);
      loadData();
    } catch (err: any) {
      console.error("خطأ في الحفظ:", err);
      alert(err.message || "حدث خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    
    try {
      const res = await fetch(`/api/supplier-prices?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      loadData();
    } catch (err) {
      alert(err.message || "حدث خطأ");
    }
  }

  return (
    <div className="min-h-screen bg-bg text-cream p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black mb-2">إدارة الأسعار</h1>
            <p className="text-muted">تحديد أسعار الموردين لكل صنف</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.back()}
              className="rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg transition-all">
              ← العودة
            </button>
            <button onClick={handleAdd}
              className="rounded-2xl bg-amber-500 hover:bg-amber-600 px-6 py-3 font-bold text-white transition-all">
              + إضافة سعر
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-card overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-green border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-muted">جاري التحميل...</p>
            </div>
          ) : prices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted text-lg mb-4">لا يوجد أسعار محددة</p>
              <button onClick={handleAdd}
                className="rounded-2xl bg-amber-500 hover:bg-amber-600 px-6 py-3 font-bold text-white">
                + إضافة أول سعر
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-card-hi border-b border-line">
                <tr>
                  <th className="p-4 text-right text-sm font-bold">المورد</th>
                  <th className="p-4 text-right text-sm font-bold">الصنف</th>
                  <th className="p-4 text-right text-sm font-bold">السعر (للوحدة)</th>
                  <th className="p-4 text-center text-sm font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {prices.map(p => (
                  <tr key={p.id} className="border-b border-line/50 hover:bg-card-hi/50 transition-colors">
                    <td className="p-4 font-bold">{p.suppliers?.name}</td>
                    <td className="p-4">{p.item_types?.name}</td>
                    <td className="p-4 font-bold text-amber-500">{p.price_per_unit} ر</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(p)}
                          className="rounded-lg bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1 text-blue-500 text-sm font-medium">
                          تعديل
                        </button>
                        <button onClick={() => handleDelete(p.id)}
                          className="rounded-lg bg-red/10 hover:bg-red/20 px-3 py-1 text-red text-sm font-medium">
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">
              {editingId ? "تعديل سعر" : "إضافة سعر جديد"}
            </h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm text-muted block mb-2">المورد *</label>
                <select value={formData.supplier_id}
                  onChange={e => setFormData({...formData, supplier_id: e.target.value})}
                  disabled={editingId}
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-amber-500/50 disabled:opacity-50">
                  <option value="">اختر المورد</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="text-sm text-muted block mb-2">الصنف *</label>
                <select value={formData.item_type_id}
                  onChange={e => setFormData({...formData, item_type_id: e.target.value})}
                  disabled={editingId}
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-amber-500/50 disabled:opacity-50">
                  <option value="">اختر الصنف</option>
                  {itemTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="text-sm text-muted block mb-2">طريقة حساب السعر *</label>
                <select value={formData.pricing_method}
                  onChange={e => setFormData({...formData, pricing_method: e.target.value})}
                  disabled={editingId}
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-amber-500/50 disabled:opacity-50">
                  <option value="quantity">بالكمية (عدد)</option>
                  <option value="weight">بالوزن (كجم)</option>
                </select>
                <p className="text-xs text-muted mt-2">مثلاً: حاشي بالكمية (عدد الرؤوس)، عجل بالوزن (كجم)</p>
              </div>
              
              <div>
                <label className="text-sm text-muted block mb-2">
                  السعر لكل {formData.pricing_method === 'weight' ? 'كجم' : 'وحدة'} *
                </label>
                <input type="number" step="0.01" value={formData.price_per_unit}
                  onChange={e => setFormData({...formData, price_per_unit: e.target.value})}
                  placeholder={formData.pricing_method === 'weight' ? 'مثال: 20' : 'مثال: 4200'}
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-amber-500/50"
                />
                <p className="text-xs text-muted mt-2">
                  {formData.pricing_method === 'weight' 
                    ? 'مثال: عجل 100 كجم × 20 ر = 2000 ر' 
                    : 'مثال: حاشي 2 × 4200 ر = 8400 ر'}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg">
                إلغاء
              </button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-[2] rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 px-6 py-3 font-bold text-white">
                {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة السعر"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
