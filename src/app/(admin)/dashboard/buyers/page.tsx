"use client";

import { useState, useEffect } from "react";

interface Buyer { id: string; name: string; phone?: string; notes?: string; }

export default function BuyersPage() {
  const [buyers, setBuyers]     = useState<Buyer[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showAdd, setShowAdd]   = useState(false);
  const [editBuyer, setEditBuyer] = useState<Buyer | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", notes: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/buyers");
      const json = await res.json();
      setBuyers(json.buyers || []);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setForm({ name: "", phone: "", notes: "" });
    setEditBuyer(null);
    setShowAdd(true);
  }

  function openEdit(b: Buyer) {
    setEditBuyer(b);
    setForm({ name: b.name, phone: b.phone || "", notes: b.notes || "" });
    setShowAdd(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { alert("اسم المشترٍ مطلوب"); return; }
    setSaving(true);
    try {
      const url    = editBuyer ? `/api/buyers?id=${editBuyer.id}` : "/api/buyers";
      const method = editBuyer ? "PATCH" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل الحفظ"); }
      setShowAdd(false);
      setEditBuyer(null);
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    try {
      const res = await fetch(`/api/buyers?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-cream p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-cream">المشترون</h1>
            <p className="text-muted text-sm mt-1">عملاء المبيعات الخارجية (أشخاص وشركات)</p>
          </div>
          <button
            onClick={openAdd}
            className="rounded-2xl bg-green hover:bg-green-dark px-6 py-3 font-bold text-white transition-all">
            + إضافة مشترٍ جديد
          </button>
        </div>

        {/* القائمة */}
        <div className="bg-card rounded-3xl border border-line overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-muted">جاري التحميل...</p>
            </div>
          ) : buyers.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted text-lg mb-4">لا يوجد مشترون بعد</p>
              <button onClick={openAdd}
                className="rounded-2xl bg-green hover:bg-green-dark px-6 py-3 font-bold text-white">
                + أضف أول مشترٍ
              </button>
            </div>
          ) : (
            <div className="divide-y divide-line">
              <div className="bg-card-hi px-5 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-4 text-xs text-muted font-semibold">
                <span>الاسم</span>
                <span>الجوال</span>
                <span>ملاحظات</span>
                <span className="text-center">إجراءات</span>
              </div>
              {buyers.map(b => (
                <div key={b.id}
                  className="px-5 py-4 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center hover:bg-card-hi/50 transition-colors">
                  <p className="text-cream font-bold">{b.name}</p>
                  <p className="text-muted text-sm ltr-num" dir="ltr">{b.phone || "—"}</p>
                  <p className="text-muted text-sm max-w-[200px] truncate">{b.notes || "—"}</p>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(b)}
                      className="rounded-lg bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 text-blue-400 text-sm transition-colors">
                      تعديل
                    </button>
                    <button onClick={() => handleDelete(b.id, b.name)}
                      className="rounded-lg bg-red/10 hover:bg-red/20 px-3 py-1.5 text-red text-sm transition-colors">
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal الإضافة/التعديل */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-cream mb-5">
              {editBuyer ? "تعديل المشترٍ" : "إضافة مشترٍ جديد"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted block mb-1">الاسم *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="اسم المشترٍ أو الشركة"
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50"
                />
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">رقم الجوال</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50"
                />
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">ملاحظات</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="أي ملاحظات إضافية..."
                  rows={3}
                  className="w-full rounded-xl bg-bg border border-line px-4 py-3 text-cream focus:outline-none focus:border-green/50 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAdd(false); setEditBuyer(null); }}
                className="flex-1 rounded-2xl bg-card-hi border border-line px-6 py-3 font-bold text-cream hover:bg-bg">
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-[2] rounded-2xl bg-green hover:bg-green-dark disabled:opacity-50 px-6 py-3 font-bold text-white">
                {saving ? "جاري الحفظ..." : editBuyer ? "حفظ التعديلات" : "إضافة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
