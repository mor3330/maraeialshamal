"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type MeatCategory = "hashi" | "sheep" | "beef" | "offal" | "";

interface ItemType {
  id: string;
  name: string;
  display_order: number;
  pricing_method?: string;
  meat_category?: MeatCategory;
}

const MEAT_CATEGORIES: { value: MeatCategory; label: string; color: string }[] = [
  { value: "",      label: "غير محدد",  color: "bg-card-hi text-muted border-line"           },
  { value: "hashi", label: "حاشي",      color: "bg-amber/10 text-amber border-amber/30"      },
  { value: "sheep", label: "غنم",       color: "bg-green/10 text-green border-green/30"      },
  { value: "beef",  label: "عجل",       color: "bg-sky-400/10 text-sky-400 border-sky-400/30"},
  { value: "offal", label: "مخلفات",    color: "bg-purple-400/10 text-purple-400 border-purple-400/30" },
];

function categoryBadge(cat?: MeatCategory) {
  const found = MEAT_CATEGORIES.find(c => c.value === (cat || ""));
  if (!found || !found.value) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${found.color}`}>
      {found.label}
    </span>
  );
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
    pricing_method: "quantity",
    meat_category: "" as MeatCategory,
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
    setFormData({ name: "", display_order: itemTypes.length + 1, pricing_method: "quantity", meat_category: "" });
    setShowModal(true);
  }

  function handleEdit(item: ItemType) {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      display_order: item.display_order,
      pricing_method: item.pricing_method || "quantity",
      meat_category: (item.meat_category || "") as MeatCategory,
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

        {/* بطاقات التصنيفات */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {MEAT_CATEGORIES.filter(c => c.value).map(cat => {
            const count = itemTypes.filter(it => it.meat_category === cat.value).length;
            return (
              <div key={cat.value} className={`rounded-2xl border px-4 py-3 text-center ${cat.color}`}>
                <p className="text-lg font-black">{count}</p>
                <p className="text-xs font-bold">{cat.label}</p>
              </div>
            );
          })}
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
                  <th className="p-4 text-right text-sm font-bold">الفئة</th>
                  <th className="p-4 text-right text-sm font-bold hidden md:table-cell">طريقة الحساب</th>
                  <th className="p-4 text-right text-sm font-bold">الترتيب</th>
                  <th className="p-4 text-center text-sm font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {itemTypes.map(it => (
                  <tr key={it.id} className="border-b border-line/50 hover:bg-card-hi/50 transition-colors">
                    <td className="p-4 font-bold">{it.name}</td>
                    <td className="p-4">
                      {categoryBadge(it.meat_category) || (
                        <span className="text-xs text-red px-2 py-0.5 rounded-full border border-red/20 bg-red/5">
                          ⚠ بدون تصنيف
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-muted text-sm hidden md:table-cell">
                      {it.pricing_method === "weight" ? "بالوزن (كجم)" : "بالكمية"}
                    </td>
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

              {/* ── تصنيف الفئة ── */}
              <div>
                <label className="text-sm text-muted block mb-2">تصنيف الفئة *</label>
                <div className="grid grid-cols-2 gap-2">
                  {MEAT_CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormData({...formData, meat_category: cat.value})}
                      className={`rounded-xl px-4 py-2.5 text-sm font-bold border transition-all ${
                        formData.meat_category === cat.value
                          ? cat.value
                            ? cat.color + " ring-2 ring-current ring-offset-1 ring-offset-card"
                            : "bg-card-hi text-muted border-line ring-2 ring-current"
                          : "bg-bg border-line text-muted hover:border-current hover:text-cream"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                {!formData.meat_category && (
                  <p className="text-xs text-amber mt-2">⚠ يفضل تحديد الفئة لتظهر في تقارير المشتريات بشكل صحيح</p>
                )}
              </div>
              
              <div>
                <label className="text-sm text-muted block mb-2">طريقة حساب السعر *</label>
                <select value={formData.pricing_method}
                  onChange={e => setFormData({...formData, pricing_method: e.target.value})}
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50">
                  <option value="quantity">بالكمية (عدد الرؤوس/الذبائح)</option>
                  <option value="weight">بالوزن (كجم)</option>
                </select>
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
