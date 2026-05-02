"use client";

import { useEffect, useState, useCallback } from "react";

/* ─── قائمة الصلاحيات المطابقة للسايدبار ─── */
const ALL_PERMS = [
  { key: "dashboard",          label: "الرئيسية",               emoji: "🏠", group: "main" },
  { key: "branches",           label: "الفروع",                 emoji: "🏢", group: "main" },
  { key: "reports",            label: "التقارير",               emoji: "📄", group: "main" },
  { key: "request-report",     label: "طلب تقرير",              emoji: "📨", group: "main" },
  { key: "pos-sales",          label: "مبيعات POS",             emoji: "🖥️", group: "main" },
  { key: "products",           label: "تصنيف المنتجات",         emoji: "🏷️", group: "main" },
  { key: "exports",            label: "الصادرات",               emoji: "📤", group: "main" },
  { key: "waste-comparison",   label: "مقارنة المخلفات",        emoji: "⚖️", group: "main" },
  { key: "purchases",          label: "المشتريات",              emoji: "🛒", group: "main" },
  { key: "purchases-log",      label: "سجل المشتريات",          emoji: "📋", group: "main" },
  { key: "external-sales",     label: "المبيعات الخارجية",      emoji: "🔄", group: "main" },
  { key: "external-sales-log", label: "سجل المبيعات الخارجية", emoji: "📄", group: "main" },
  { key: "print",              label: "طباعة التقرير",          emoji: "🖨️", group: "main" },
  { key: "vat-report",         label: "تقرير الضريبة (VAT)",    emoji: "🧾", group: "main" },
  { key: "stats",              label: "الإحصائيات",             emoji: "📊", group: "main" },
  { key: "settings",           label: "الإعدادات",              emoji: "⚙️", group: "main" },
];

interface AdminUser {
  id: string; name: string; phone?: string;
  is_active: boolean;
  permissions: Record<string, boolean>;
  allowed_branches: string[] | null;
  created_at: string;
}
interface Branch { id: string; name: string; slug: string; }

/* ─── مكون تبديل ─── */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} type="button"
      className={`w-11 h-6 rounded-full relative flex-shrink-0 transition-colors ${on ? "bg-green" : "bg-[#2a3830]"}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "right-0.5" : "left-0.5"}`} />
    </button>
  );
}

/* ─── نافذة الإضافة / التعديل ─── */
function UserModal({
  user, branches, onClose, onSave,
}: {
  user: AdminUser | null;
  branches: Branch[];
  onClose: () => void;
  onSave: () => void;
}) {
  const isEdit = !!user;
  const [name,  setName]  = useState(user?.name  ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [pin,   setPin]   = useState("");
  const [pin2,  setPin2]  = useState("");
  const [perms, setPerms] = useState<Record<string, boolean>>(
    user?.permissions ?? Object.fromEntries(ALL_PERMS.map(p => [p.key, false]))
  );
  const [selBranches, setSelBranches] = useState<string[] | null>(user?.allowed_branches ?? null);
  const [allBranches,  setAllBranches] = useState(user?.allowed_branches === null);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const togglePerm = (k: string) => setPerms(p => ({ ...p, [k]: !p[k] }));
  const toggleAllPerms = (v: boolean) => setPerms(Object.fromEntries(ALL_PERMS.map(p => [p.key, v])));

  const toggleBranch = (id: string) => {
    setSelBranches(prev => {
      const cur = prev ?? [];
      return cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    });
  };

  async function save() {
    setError("");
    if (!name.trim()) { setError("الاسم مطلوب"); return; }
    if (!isEdit && (!pin || pin.length < 4)) { setError("رمز الدخول يجب 4 أرقام فأكثر"); return; }
    if (pin && pin !== pin2) { setError("رمزا الدخول غير متطابقين"); return; }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        name, phone: phone || null,
        permissions: perms,
        allowed_branches: allBranches ? null : (selBranches ?? null),
      };
      if (pin) body.pin = pin;

      const url  = isEdit ? `/api/admin/users/${user!.id}` : "/api/admin/users";
      const meth = isEdit ? "PATCH" : "POST";
      const res  = await fetch(url, { method: meth, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "خطأ في الحفظ"); return; }
      onSave();
    } finally { setSaving(false); }
  }

  const iCls = "w-full rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3fa66a]/60 placeholder:text-[#4a5550]";

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-start justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-[#0f1511] border border-[#2a3830] rounded-[24px] w-full max-w-2xl my-6 shadow-2xl">

        {/* Header */}
        <div className="p-6 border-b border-[#2a3830] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">{isEdit ? "تعديل مستخدم" : "إضافة مستخدم جديد"}</h2>
            <p className="text-xs text-[#6a7870] mt-0.5">حدد الصلاحيات والفروع المسموح بها</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-[#1a2420] text-[#6a7870] hover:text-white flex items-center justify-center">✕</button>
        </div>

        <div className="p-6 space-y-6">

          {/* البيانات الأساسية */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#8a9890] block mb-1.5">الاسم *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم المستخدم" className={iCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#8a9890] block mb-1.5">رقم الجوال</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="05xxxxxxxx" className={iCls} dir="ltr" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#8a9890] block mb-1.5">{isEdit ? "رمز دخول جديد (اتركه فارغاً للإبقاء)" : "رمز الدخول *"}</label>
              <input type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" className={iCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#8a9890] block mb-1.5">تأكيد رمز الدخول</label>
              <input type="password" inputMode="numeric" value={pin2} onChange={e => setPin2(e.target.value)} placeholder="••••" className={iCls} />
            </div>
          </div>

          {/* ── الصلاحيات ── */}
          <div className="rounded-2xl border border-[#2a3830] bg-[#0d1410] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-black text-white">الصلاحيات</p>
              <div className="flex gap-2">
                <button onClick={() => toggleAllPerms(true)} className="text-xs text-[#3fa66a] border border-[#3fa66a]/30 px-3 py-1 rounded-lg">تحديد الكل</button>
                <button onClick={() => toggleAllPerms(false)} className="text-xs text-[#6a7870] border border-[#2a3830] px-3 py-1 rounded-lg">إلغاء الكل</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_PERMS.map(p => (
                <label key={p.key} className="flex items-center gap-2 rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-2 cursor-pointer hover:border-[#3fa66a]/30 transition-colors">
                  <input type="checkbox" checked={!!perms[p.key]} onChange={() => togglePerm(p.key)}
                    className="w-4 h-4 accent-[#3fa66a] flex-shrink-0" />
                  <span className="text-sm">{p.emoji}</span>
                  <span className="text-xs text-white flex-1">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── الفروع المسموح بها (خاصة بالرئيسية) ── */}
          <div className="rounded-2xl border border-[#2a3830] bg-[#0d1410] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-black text-white">الفروع في الرئيسية</p>
                <p className="text-[11px] text-[#6a7870] mt-0.5">الفروع التي تظهر للمستخدم عند فتح الرئيسية</p>
              </div>
              <Toggle on={allBranches} onChange={v => { setAllBranches(v); if (v) setSelBranches(null); }} />
            </div>
            {allBranches ? (
              <p className="text-xs text-[#3fa66a] rounded-xl border border-[#3fa66a]/20 bg-[#3fa66a]/5 px-3 py-2">كل الفروع مرئية</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {branches.map(b => (
                  <label key={b.id} className="flex items-center gap-2 rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-2 cursor-pointer hover:border-[#3fa66a]/30 transition-colors">
                    <input type="checkbox"
                      checked={(selBranches ?? []).includes(b.id)}
                      onChange={() => toggleBranch(b.id)}
                      className="w-4 h-4 accent-[#3fa66a] flex-shrink-0" />
                    <span className="text-xs text-white flex-1">{b.name}</span>
                  </label>
                ))}
                {branches.length === 0 && <p className="text-xs text-[#6a7870] col-span-2">لا توجد فروع</p>}
              </div>
            )}
          </div>

          {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-400 text-sm">{error}</div>}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-2xl bg-[#1a2420] border border-[#2a3830] py-3 text-sm font-bold text-[#6a7870] hover:text-white">إلغاء</button>
            <button onClick={save} disabled={saving}
              className="flex-[3] rounded-2xl bg-[#3fa66a] hover:bg-[#2d7a4e] disabled:opacity-40 py-3 text-sm font-black text-white">
              {saving ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة المستخدم"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════ الصفحة الرئيسية ══════════════════ */
export default function UsersPage() {
  const [users,    setUsers]    = useState<AdminUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState<AdminUser | null | "new">(null);
  const [delId,    setDelId]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ur, br] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/branches"),
      ]);
      const uj = await ur.json(); setUsers(uj.users ?? []);
      const bj = await br.json(); setBranches(bj.branches ?? bj ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(u: AdminUser) {
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !u.is_active }),
    });
    load();
  }

  async function del(id: string) {
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    setDelId(null); load();
  }

  const permCount = (u: AdminUser) =>
    Object.values(u.permissions).filter(Boolean).length;

  return (
    <div className="p-6 max-w-4xl mx-auto min-h-screen bg-[#080d0a] text-white" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black">إدارة المستخدمين</h1>
          <p className="text-[#6a7870] text-sm mt-1">أضف مستخدمين بصلاحيات مخصصة وتحكم في الفروع التي يرونها</p>
        </div>
        <button onClick={() => setModal("new")}
          className="rounded-2xl bg-[#3fa66a] hover:bg-[#2d7a4e] text-white px-5 py-2.5 text-sm font-black">
          + إضافة مستخدم
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-[#3fa66a] border-t-transparent animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-3xl border border-[#2a3830] bg-[#0f1511] p-12 text-center">
          <div className="text-5xl mb-4">👥</div>
          <h2 className="text-xl font-bold mb-2">لا يوجد مستخدمون بعد</h2>
          <p className="text-[#6a7870] text-sm mb-6">أضف مستخدمين لتحديد صلاحياتهم والفروع التي يرونها</p>
          <button onClick={() => setModal("new")}
            className="rounded-2xl bg-[#3fa66a] hover:bg-[#2d7a4e] text-white px-6 py-3 text-sm font-black">
            إضافة أول مستخدم
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className={`rounded-2xl border p-5 flex items-center justify-between gap-4 transition-all ${u.is_active ? "border-[#2a3830] bg-[#0f1511]" : "border-[#2a3830]/40 bg-[#0f1511]/40 opacity-60"}`}>
              {/* بيانات */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#3fa66a]/20 flex items-center justify-center text-[#3fa66a] font-black text-lg flex-shrink-0">
                  {u.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white">{u.name}</p>
                  <p className="text-xs text-[#6a7870] mt-0.5">
                    {u.phone ? `📱 ${u.phone} · ` : ""}
                    {permCount(u)} صلاحية
                    {u.allowed_branches === null
                      ? " · كل الفروع"
                      : ` · ${u.allowed_branches?.length ?? 0} فرع`}
                  </p>
                </div>
              </div>

              {/* الصلاحيات - عرض مختصر */}
              <div className="hidden md:flex flex-wrap gap-1 max-w-xs">
                {ALL_PERMS.filter(p => u.permissions[p.key]).slice(0, 5).map(p => (
                  <span key={p.key} className="text-[10px] bg-[#3fa66a]/10 text-[#3fa66a] border border-[#3fa66a]/20 rounded-lg px-2 py-0.5">{p.label}</span>
                ))}
                {permCount(u) > 5 && (
                  <span className="text-[10px] bg-[#2a3830] text-[#6a7870] rounded-lg px-2 py-0.5">+{permCount(u) - 5}</span>
                )}
              </div>

              {/* الأزرار */}
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => toggleActive(u)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors ${u.is_active ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20" : "bg-[#1a2420] text-[#6a7870] border-[#2a3830] hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20"}`}>
                  {u.is_active ? "تعطيل" : "تفعيل"}
                </button>
                <button onClick={() => setModal(u)}
                  className="rounded-xl px-3 py-1.5 text-xs font-bold bg-[#1a2420] text-[#8a9890] border border-[#2a3830] hover:text-white">
                  تعديل
                </button>
                <button onClick={() => setDelId(u.id)}
                  className="rounded-xl px-3 py-1.5 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20">
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* نافذة إضافة / تعديل */}
      {modal !== null && (
        <UserModal
          user={modal === "new" ? null : modal}
          branches={branches}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}

      {/* تأكيد الحذف */}
      {delId && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1511] border border-[#2a3830] rounded-3xl p-6 w-full max-w-sm text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-2">حذف المستخدم</h2>
            <p className="text-[#6a7870] text-sm mb-6">هذا الإجراء لا يمكن التراجع عنه.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelId(null)} className="flex-1 bg-[#1a2420] border border-[#2a3830] text-white rounded-2xl py-3">إلغاء</button>
              <button onClick={() => del(delId)} className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 rounded-2xl py-3 font-bold">حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
