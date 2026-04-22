"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ItemType {
  id: string;
  name: string;
  display_order: number;
  pricing_method?: string;
}

export default function ItemTypesPage() {
  const router = useRouter();
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    display_order: 0,
    pricing_method: "quantity"
  });

  useEffect(() => {
    loadItemTypes();
  }, []);

  async function loadItemTypes() {
    setLoading(true);
    try {
      const res = await fetch("/api/item-types");
      const data = await res.json();
      setItemTypes(data.itemTypes || []);
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    setEditingId(null);
    setFormData({ name: "", display_order: itemTypes.length + 1, pricing_method: "quantity" });
    setShowModal(true);
  }

  function handleEdit(item: ItemType) {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      display_order: item.display_order,
      pricing_method: item.pricing_method || "quantity"
    });
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!formData.name.trim()) {
      alert("الرجاء إدخال اسم الصنف");
      return;
    }
    
    setSaving(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId 
        ? { id: editingId, ...formData }
        : formData;
      
      const res = await fetch("/api/item-types", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) throw new Error("فشل الحفظ");
      
      setShowModal(false);
      loadItemTypes();
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    
    try {
      const res = await fetch(`/api/item-types?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      loadItemTypes();
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    }
  }

  return (
    <div className="min-h-screen bg-bg text-cream p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black mb-2">إدارة الأصناف</h1>
            <p className="text-muted">إضافة وتعديل وحذف أصناف المشتريات</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.back()}
              className="rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg transition-all">
              ← العودة
            </button>
            <button onClick={handleAdd}
              className="rounded-2xl bg-green hover:bg-green-dark px-6 py-3 font-bold text-white transition-all">
              + إضافة صنف
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-card overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-green border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-muted">جاري التحميل...</p>
            </div>
          ) : itemTypes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted text-lg mb-4">لا يوجد أصناف</p>
              <button onClick={handleAdd}
                className="rounded-2xl bg-green hover:bg-green-dark px-6 py-3 font-bold text-white">
                + إضافة أول صنف
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-card-hi border-b border-line">
                <tr>
                  <th className="p-4 text-right text-sm font-bold">الاسم</th>
                  <th className="p-4 text-right text-sm font-bold">الترتيب</th>
                  <th className="p-4 text-center text-sm font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {itemTypes.map(it => (
                  <tr key={it.id} className="border-b border-line/50 hover:bg-card-hi/50 transition-colors">
                    <td className="p-4 font-bold">{it.name}</td>
                    <td className="p-4 text-muted">{it.display_order}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(it)}
                          className="rounded-lg bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1 text-blue-500 text-sm font-medium">
                          تعديل
                        </button>
                        <button onClick={() => handleDelete(it.id)}
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
              {editingId ? "تعديل صنف" : "إضافة صنف جديد"}
            </h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm text-muted block mb-2">اسم الصنف *</label>
                <input type="text" value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="مثال: حاشي سواكني"
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50"
                />
              </div>
              
              <div>
                <label className="text-sm text-muted block mb-2">طريقة حساب السعر *</label>
                <select value={formData.pricing_method}
                  onChange={e => setFormData({...formData, pricing_method: e.target.value})}
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50">
                  <option value="quantity">بالكمية (عدد الرؤوس/الذبائح)</option>
                  <option value="weight">بالوزن (كجم)</option>
                </select>
                <p className="text-xs text-muted mt-2">يحدد كيفية حساب السعر في المشتريات</p>
              </div>
              
              <div>
                <label className="text-sm text-muted block mb-2">ترتيب العرض *</label>
                <input type="number" value={formData.display_order}
                  onChange={e => setFormData({...formData, display_order: parseInt(e.target.value) || 0})}
                  min="1"
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50"
                />
                <p className="text-xs text-muted mt-2">سيتم دفع الأصناف الأخرى تلقائياً</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg">
                إلغاء
              </button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-[2] rounded-2xl bg-green hover:bg-green-dark disabled:opacity-50 px-6 py-3 font-bold text-white">
                {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة الصنف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
