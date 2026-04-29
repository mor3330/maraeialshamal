"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

interface Branch {
  id: string;
  name: string;
  code: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

interface BranchForm {
  name: string;
  code: string;
  slug: string;
  pin: string;
  is_active: boolean;
}

const emptyForm: BranchForm = { name: "", code: "", slug: "", pin: "", is_active: true };

export default function BranchesPage() {
  const [branches,      setBranches]      = useState<Branch[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showAdd,       setShowAdd]       = useState(false);
  const [editId,        setEditId]        = useState<string | null>(null);
  const [form,          setForm]          = useState<BranchForm>(emptyForm);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [syncOff,       setSyncOff]       = useState<Branch | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/branches", { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
    const json = await res.json();
    setBranches(json.branches ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startAdd() { setForm(emptyForm); setEditId(null); setError(""); setShowAdd(true); }
  function startEdit(branch: Branch) {
    setForm({ name: branch.name, code: branch.code, slug: branch.slug, pin: "", is_active: branch.is_active });
    setEditId(branch.id); setError(""); setShowAdd(true);
  }

  async function save() {
    setSaving(true); setError("");
    try {
      const url    = editId ? `/api/admin/branches/${editId}` : "/api/admin/branches";
      const method = editId ? "PATCH" : "POST";
      const body: Record<string, unknown> = { name: form.name, code: form.code, slug: form.slug, is_active: form.is_active };
      if (form.pin) body.pin = form.pin;
      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "خطأ"); return; }
      await load();
      setShowAdd(false);
    } finally { setSaving(false); }
  }

  async function disableSync(branch: Branch) {
    await fetch(`/api/admin/branches/${branch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    setSyncOff(null);
    await load();
  }

  async function enableSync(branch: Branch) {
    await fetch(`/api/admin/branches/${branch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: true }),
    });
    await load();
  }

  async function deleteBranch(id: string) {
    await fetch(`/api/admin/branches/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    await load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-cream">إدارة الفروع</h1>
          <p className="text-muted text-sm mt-1">إضافة وتعديل وحذف فروع السلسلة</p>
        </div>
        <button onClick={startAdd}
          className="bg-green hover:bg-green-dark text-white rounded-2xl px-5 py-3 font-bold transition-colors">
          + إضافة فرع
        </button>
      </div>

      {/* ── Add/Edit Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-cream mb-5">{editId ? "تعديل الفرع" : "إضافة فرع جديد"}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-muted text-sm block mb-1">اسم الفرع</label>
                <input className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream placeholder-muted/50 focus:outline-none focus:border-green/50"
                  placeholder="فرع العليا" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted text-sm block mb-1">الكود (OLAYA)</label>
                  <input className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream placeholder-muted/50 focus:outline-none focus:border-green/50 uppercase"
                    placeholder="OLAYA" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="text-muted text-sm block mb-1">الرابط (olaya)</label>
                  <input className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream placeholder-muted/50 focus:outline-none focus:border-green/50"
                    placeholder="olaya" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase() }))} />
                </div>
              </div>
              <div>
                <label className="text-muted text-sm block mb-1">
                  رمز الكاشير (PIN) {editId && <span className="text-xs">(اتركه فارغاً للإبقاء على الرمز الحالي)</span>}
                </label>
                <input type="password" inputMode="numeric" maxLength={8}
                  className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream placeholder-muted/50 focus:outline-none focus:border-green/50"
                  placeholder={editId ? "••••" : "1234"} value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`w-12 h-6 rounded-full transition-colors ${form.is_active ? "bg-green" : "bg-card-hi border border-line"}`}>
                  <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${form.is_active ? "translate-x-6" : ""}`} />
                </button>
                <span className="text-sm text-cream">{form.is_active ? "فرع نشط" : "فرع غير نشط"}</span>
              </div>
            </div>
            {error && <p className="text-red text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 bg-card-hi border border-line text-cream rounded-2xl py-3 font-medium">إلغاء</button>
              <button onClick={save} disabled={saving || !form.name || !form.code || !form.slug || (!editId && !form.pin)}
                className="flex-[2] bg-green hover:bg-green-dark disabled:opacity-50 text-white rounded-2xl py-3 font-bold transition-colors">
                {saving ? "جاري الحفظ..." : editId ? "حفظ التعديلات" : "إضافة الفرع"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── تأكيد إلغاء المزامنة ── */}
      {syncOff && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-red/20 rounded-3xl p-6 w-full max-w-sm text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red/10 border border-red/20 flex items-center justify-center mx-auto">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-7 h-7 text-red">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-cream">إلغاء مزامنة الفرع</h2>
              <p className="text-muted text-sm mt-2">
                سيتوقف فرع <span className="text-cream font-bold">"{syncOff.name}"</span> عن رفع التقارير والبيانات فوراً.
              </p>
              <p className="text-amber text-xs mt-2 border border-amber/20 bg-amber/10 rounded-xl px-3 py-2">
                يمكنك إعادة تفعيل المزامنة في أي وقت بالضغط على "تفعيل المزامنة"
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setSyncOff(null)}
                className="flex-1 bg-card-hi border border-line text-cream rounded-2xl py-3 font-medium">
                تراجع
              </button>
              <button onClick={() => disableSync(syncOff)}
                className="flex-[2] bg-red hover:bg-red/80 text-white rounded-2xl py-3 font-bold transition-colors">
                إلغاء المزامنة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── تأكيد حذف الفرع ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-sm text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-cream mb-2">حذف الفرع</h2>
            <p className="text-muted text-sm mb-6">هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الفرع نهائياً.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 bg-card-hi border border-line text-cream rounded-2xl py-3">إلغاء</button>
              <button onClick={() => deleteBranch(deleteConfirm)} className="flex-1 bg-red/20 border border-red/30 text-red rounded-2xl py-3 font-bold">حذف</button>
            </div>
          </div>
        </div>
      )}

      {/* ── قائمة الفروع ── */}
      {loading ? (
        <div className="text-muted text-center py-12">جاري التحميل...</div>
      ) : branches.length === 0 ? (
        <div className="rounded-3xl border border-line bg-card p-12 text-center">
          <p className="text-muted">لا توجد فروع. أضف أول فرع!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {branches.map(branch => (
            <div key={branch.id}
              className={`rounded-3xl border p-5 transition-all ${
                branch.is_active
                  ? "border-line bg-card"
                  : "border-red/20 bg-red/5"
              }`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">

                {/* معلومات الفرع */}
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    branch.is_active
                      ? "bg-green shadow-[0_0_8px_rgba(63,166,106,0.5)]"
                      : "bg-red shadow-[0_0_8px_rgba(255,80,80,0.3)]"
                  }`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-cream">{branch.name}</p>
                      {!branch.is_active && (
                        <span className="text-xs font-medium bg-red/10 text-red border border-red/20 rounded-full px-2 py-0.5">
                          المزامنة متوقفة
                        </span>
                      )}
                    </div>
                    <p className="text-muted text-sm mt-0.5">
                      <span dir="ltr">{branch.code}</span>
                      <span className="mx-2">·</span>
                      <span dir="ltr">/branch/{branch.slug}</span>
                    </p>
                  </div>
                </div>

                {/* أزرار الإجراءات */}
                <div className="flex items-center gap-2 flex-wrap">
                  {branch.is_active ? (
                    <button onClick={() => setSyncOff(branch)}
                      className="rounded-xl px-3 py-1.5 text-xs font-medium bg-red/10 text-red border border-red/20 hover:bg-red/20 transition-colors flex items-center gap-1.5">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd"/>
                      </svg>
                      إلغاء المزامنة
                    </button>
                  ) : (
                    <button onClick={() => enableSync(branch)}
                      className="rounded-xl px-3 py-1.5 text-xs font-medium bg-green/10 text-green border border-green/20 hover:bg-green/20 transition-colors flex items-center gap-1.5">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                      تفعيل المزامنة
                    </button>
                  )}
                  <button onClick={() => startEdit(branch)}
                    className="rounded-xl px-3 py-1.5 text-xs font-medium bg-card-hi text-muted border border-line hover:text-cream transition-colors">
                    تعديل
                  </button>
                  <button onClick={() => setDeleteConfirm(branch.id)}
                    className="rounded-xl px-3 py-1.5 text-xs font-medium bg-card-hi text-muted border border-line hover:bg-red/10 hover:text-red hover:border-red/20 transition-colors">
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
