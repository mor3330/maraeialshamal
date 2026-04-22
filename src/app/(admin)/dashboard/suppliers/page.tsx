"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
}

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    notes: ""
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers");
      const data = await res.json();
      setSuppliers(data.suppliers || []);
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    setEditingId(null);
    setFormData({ name: "", phone: "", notes: "" });
    setShowModal(true);
  }

  function handleEdit(supplier: Supplier) {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.name,
      phone: supplier.phone || "",
      notes: supplier.notes || ""
    });
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!formData.name.trim()) {
      alert("الرجاء إدخال اسم المورد");
      return;
    }
    
    setSaving(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId 
        ? { id: editingId, ...formData }
        : formData;
      
      const res = await fetch("/api/suppliers", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) throw new Error("فشل الحفظ");
      
      setShowModal(false);
      loadSuppliers();
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    
    try {
      const res = await fetch(`/api/suppliers?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      loadSuppliers();
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    }
  }

  return (
    <div className="min-h-screen bg-bg text-cream p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black mb-2">إدارة الموردين</h1>
            <p className="text-muted">إضافة وتعديل وحذف الموردين</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg transition-all">
              ← العودة
            </button>
            <button
              onClick={handleAdd}
              className="rounded-2xl bg-purple-500 hover:bg-purple-600 px-6 py-3 font-bold text-white transition-all">
              + إضافة مورد
            </button>
          </div>
        </div>

        {/* Suppliers List */}
        <div className="rounded-3xl border border-line bg-card overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-green border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-muted">جاري التحميل...</p>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted text-lg mb-4">لا يوجد موردين</p>
              <button onClick={handleAdd}
                className="rounded-2xl bg-purple-500 hover:bg-purple-600 px-6 py-3 font-bold text-white">
                + إضافة أول مورد
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-card-hi border-b border-line">
                <tr>
                  <th className="p-4 text-right text-sm font-bold">الاسم</th>
                  <th className="p-4 text-right text-sm font-bold">الهاتف</th>
                  <th className="p-4 text-right text-sm font-bold">ملاحظات</th>
                  <th className="p-4 text-center text-sm font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id} className="border-b border-line/50 hover:bg-card-hi/50 transition-colors">
                    <td className="p-4 font-bold">{s.name}</td>
                    <td className="p-4 text-muted">{s.phone || "-"}</td>
                    <td className="p-4 text-muted text-sm">{s.notes || "-"}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(s)}
                          className="rounded-lg bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1 text-blue-500 text-sm font-medium">
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">
              {editingId ? "تعديل مورد" : "إضافة مورد جديد"}
            </h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm text-muted block mb-2">اسم المورد *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="مثال: مورد الشمال"
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50"
                />
              </div>
              
              <div>
                <label className="text-sm text-muted block mb-2">الهاتف</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  placeholder="مثال: 0501234567"
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50"
                />
              </div>
              
              <div>
                <label className="text-sm text-muted block mb-2">ملاحظات</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  placeholder="ملاحظات إضافية..."
                  rows={3}
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50 resize-none"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg">
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-[2] rounded-2xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 px-6 py-3 font-bold text-white">
                {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة المورد"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
