"use client";

import { useEffect, useState } from "react";

/* ─────────── Types ─────────── */
interface MeatType { id: string; name: string; category: string; has_count: boolean; sort_order: number; is_active: boolean; }
interface PaymentMethod { id: string; name: string; code: string; sort_order: number; is_active: boolean; }

const TABS = [
  { key: "meat",     label: "أنواع اللحوم",  desc: "الخطوة 3 — مبيعات اللحوم بالتفصيل" },
  { key: "payments", label: "طرق الدفع",     desc: "الخطوة 2 — تحليل طرق الدفع" },
  { key: "fields",   label: "حقول الخطوات",  desc: "تخصيص الأسئلة لكل خطوة", isLink: true, href: "/dashboard/settings/step-fields" },
  { key: "excel",    label: "Excel",          desc: "ربط ملف Excel المركزي" },
  { key: "whatsapp", label: "واتساب",         desc: "إشعارات واتساب للمدير" },
  { key: "pos",      label: "🔄 تحديث الكواشير", desc: "نشر تحديث sync.py لجميع الفروع تلقائياً" },
] as const;
type Tab = typeof TABS[number]["key"];

const CATEGORIES = [
  { value: "hashi",  label: "حاشي",    emoji: "🐪" },
  { value: "beef",   label: "عجل",     emoji: "🐄" },
  { value: "sheep",  label: "غنم",     emoji: "🐑" },
  { value: "minced", label: "مفروم",   emoji: "🥩" },
  { value: "offal",  label: "مخلفات",  emoji: "🫀" },
  { value: "other",  label: "أخرى",   emoji: "📦" },
];

/* ─────────── Excel Export Component ─────────── */
function ExcelExport() {
  const today = new Date().toISOString().substring(0, 10);
  const firstOfMonth = today.substring(0, 8) + "01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to,   setTo]   = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/admin/export-excel?from=${from}&to=${to}`);
      if (!res.ok) { setError("فشل التصدير، حاول مرة أخرى"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `marai-report-${from}-to-${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  const sheets = [
    { name: "المبيعات اليومية", desc: "كل تقرير بصف — التاريخ، الفرع، كاش / شبكة / تحويل / آجل، المصروفات، فرق الكاش" },
    { name: "ملخص الفروع",     desc: "إجماليات كل فرع للفترة المختارة مع صف الإجمالي الكلي" },
    { name: "بيانات اللحوم",   desc: "الوارد والمباع والصادر والهالك والمتبقي تفصيلاً لكل فرع" },
  ];

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-bold text-cream mb-1">تصدير Excel</h2>
      <p className="text-muted text-sm mb-6">اختر الفترة ثم حمّل الملف مباشرة — يحتوي على 3 شيتات</p>

      {/* الشيتات */}
      <div className="space-y-2 mb-6">
        {sheets.map((s, i) => (
          <div key={s.name} className="rounded-2xl border border-line bg-card p-4 flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-green/15 text-green text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
            <div>
              <p className="text-cream font-medium text-sm">{s.name}</p>
              <p className="text-muted text-xs mt-0.5">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* اختيار الفترة */}
      <div className="rounded-2xl border border-line bg-card p-5 space-y-4">
        <p className="text-cream font-medium text-sm">اختر الفترة</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-muted text-xs block mb-1">من</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full bg-bg border border-line rounded-xl px-3 py-2.5 text-cream text-sm focus:outline-none focus:border-green/50" />
          </div>
          <div>
            <label className="text-muted text-xs block mb-1">إلى</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full bg-bg border border-line rounded-xl px-3 py-2.5 text-cream text-sm focus:outline-none focus:border-green/50" />
          </div>
        </div>

        {/* أزرار سريعة */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "اليوم",       f: today,        t: today },
            { label: "هذا الشهر",   f: firstOfMonth, t: today },
            { label: "آخر 7 أيام",  f: (() => { const d = new Date(); d.setDate(d.getDate()-6); return d.toISOString().substring(0,10); })(), t: today },
            { label: "آخر 30 يوم",  f: (() => { const d = new Date(); d.setDate(d.getDate()-29); return d.toISOString().substring(0,10); })(), t: today },
          ].map(q => (
            <button key={q.label} onClick={() => { setFrom(q.f); setTo(q.t); }}
              className="rounded-xl px-3 py-1.5 text-xs font-medium bg-card-hi border border-line text-muted hover:text-cream transition-colors">
              {q.label}
            </button>
          ))}
        </div>

        {error && <p className="text-red text-sm">{error}</p>}

        <button onClick={download} disabled={loading || !from || !to}
          className="w-full bg-green hover:bg-green-dark disabled:opacity-50 text-white rounded-2xl py-3 font-bold text-sm transition-colors">
          {loading ? "جاري التصدير..." : "تحميل ملف Excel"}
        </button>
      </div>
    </div>
  );
}

/* ─────────── Agent Update Panel ─────────── */
function AgentUpdatePanel() {
  const [status, setStatus] = useState<null | "loading" | "done" | "error">(null);
  const [msg, setMsg]       = useState("");
  const [currentVer, setCurrentVer] = useState<string | null>(null);

  // جلب الإصدار الحالي المخزون في Supabase
  useEffect(() => {
    fetch("/api/pos/agent-update?version=0")
      .then(r => r.json())
      .then(d => setCurrentVer(d.version ?? null))
      .catch(() => {});
  }, []);

  async function publishUpdate() {
    if (!confirm("سيُنشر sync.py الحالي لجميع الفروع وستبدأ بالتحديث خلال 30 ثانية. تأكيد؟")) return;
    setStatus("loading");
    setMsg("جاري رفع التحديث...");
    try {
      const res  = await fetch("/api/pos/agent-update", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMsg(json.error || "فشل نشر التحديث");
      } else {
        setStatus("done");
        setMsg(json.message || "تم النشر");
        setCurrentVer(json.version);
      }
    } catch {
      setStatus("error");
      setMsg("خطأ في الاتصال");
    }
  }

  return (
    <div className="max-w-xl space-y-6" dir="rtl">
      <div>
        <h2 className="text-lg font-bold text-cream">تحديث الكواشير تلقائياً</h2>
        <p className="text-muted text-sm mt-1">
          اضغط الزر وسيُنشر آخر إصدار من <code className="text-amber text-xs bg-card-hi px-1 rounded">sync.py</code> لجميع الفروع — بدون ما تمس أي جهاز
        </p>
      </div>

      {/* كيف يعمل */}
      <div className="rounded-2xl border border-line bg-card p-5 space-y-3">
        <p className="text-cream font-semibold text-sm">كيف يعمل؟</p>
        {[
          { n: "1", t: "تضغط «نشر تحديث»", d: "يُرفع sync.py الجديد لقاعدة البيانات" },
          { n: "2", t: "الفروع تكتشفه تلقائياً", d: "كل فرع يفحص التحديثات كل 10 دقائق — أو فوراً إذا أرسلنا trigger" },
          { n: "3", t: "يثبّت نفسه ويعيد التشغيل", d: "يحفظ نسخة احتياطية ثم يُحدّث نفسه دون أي تدخل" },
        ].map(s => (
          <div key={s.n} className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-green/15 text-green text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</span>
            <div>
              <p className="text-cream text-sm font-medium">{s.t}</p>
              <p className="text-muted text-xs">{s.d}</p>
            </div>
          </div>
        ))}
      </div>

      {/* الإصدار الحالي */}
      {currentVer && (
        <div className="rounded-xl border border-line bg-card-hi px-4 py-3 flex items-center gap-3">
          <span className="text-green text-sm">✓</span>
          <p className="text-muted text-sm">
            الإصدار المنشور حالياً: <span className="text-cream font-bold">v{currentVer}</span>
          </p>
        </div>
      )}

      {/* نتيجة العملية */}
      {status && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-3 ${
          status === "done"    ? "bg-green/10 border-green/30 text-green" :
          status === "error"   ? "bg-red/10 border-red/30 text-red" :
          "bg-amber/10 border-amber/30 text-amber"
        }`}>
          {status === "loading" && (
            <span className="w-4 h-4 border-2 border-amber border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          {msg}
        </div>
      )}

      {/* زر النشر */}
      <button
        onClick={publishUpdate}
        disabled={status === "loading"}
        className="w-full py-4 rounded-2xl font-black text-base transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-green hover:bg-green-dark text-white flex items-center justify-center gap-3">
        {status === "loading" ? (
          <>
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            جاري النشر...
          </>
        ) : (
          <>🚀 نشر تحديث لجميع الفروع</>
        )}
      </button>

      <p className="text-muted text-xs text-center">
        الفروع التي تعمل ستتحدث خلال 30 ثانية — الفروع المغلقة ستتحدث عند أول تشغيل
      </p>
    </div>
  );
}

/* ─────────── Component ─────────── */
export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("meat");
  const [meats, setMeats] = useState<MeatType[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<MeatType | PaymentMethod | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function loadMeats() {
    const r = await fetch("/api/admin/settings?type=meat_types");
    setMeats((await r.json()).data ?? []);
  }
  async function loadPayments() {
    const r = await fetch("/api/admin/settings?type=payment_methods");
    setPayments((await r.json()).data ?? []);
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([loadMeats(), loadPayments()]).finally(() => setLoading(false));
  }, []);

  function startAdd() {
    setEditItem(null);
    setForm(tab === "meat"
      ? { name: "", category: "hashi", has_count: true, sort_order: 99, is_active: true }
      : { name: "", code: "", sort_order: 99, is_active: true });
    setError(""); setShowForm(true);
  }
  function startEdit(item: MeatType | PaymentMethod) {
    setEditItem(item); setForm({ ...item }); setError(""); setShowForm(true);
  }

  async function save() {
    setSaving(true); setError("");
    try {
      const type = tab === "meat" ? "meat_types" : "payment_methods";
      const url = editItem ? `/api/admin/settings?type=${type}&id=${editItem.id}` : `/api/admin/settings?type=${type}`;
      const res = await fetch(url, { method: editItem ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "خطأ"); return; }
      await (tab === "meat" ? loadMeats() : loadPayments());
      setShowForm(false);
    } finally { setSaving(false); }
  }

  async function del(id: string) {
    const type = tab === "meat" ? "meat_types" : "payment_methods";
    await fetch(`/api/admin/settings?type=${type}&id=${id}`, { method: "DELETE" });
    setDeleteId(null);
    await (tab === "meat" ? loadMeats() : loadPayments());
  }

  async function toggle(item: MeatType | PaymentMethod) {
    const type = tab === "meat" ? "meat_types" : "payment_methods";
    await fetch(`/api/admin/settings?type=${type}&id=${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !item.is_active }),
    });
    await (tab === "meat" ? loadMeats() : loadPayments());
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-cream">الإعدادات</h1>
        <p className="text-muted text-sm mt-1">تحكم كامل بمراحل إدخال الكاشير والتكاملات</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map(t => {
          if ('isLink' in t && t.isLink) {
            return (
              <a key={t.key} href={t.href}
                className="rounded-2xl px-5 py-3 text-sm font-medium transition-all bg-blue-600 text-white border border-blue-500 hover:bg-blue-700">
                {t.label} →
              </a>
            );
          }
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-2xl px-5 py-3 text-sm font-medium transition-all ${tab === t.key ? "bg-green/15 text-green border border-green/30" : "bg-card border border-line text-muted hover:text-cream"}`}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Meat Types ── */}
      {tab === "meat" && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-cream">أنواع اللحوم</h2>
              <p className="text-muted text-xs mt-1">تُعرض في الخطوة 3 (مبيعات) والخطوة 4 (مخزون)</p>
            </div>
            <button onClick={startAdd} className="bg-green hover:bg-green-dark text-white rounded-xl px-4 py-2 text-sm font-bold">+ إضافة</button>
          </div>
          {loading ? <p className="text-muted text-center py-8">جاري التحميل...</p> : (
            <div className="space-y-2">
              {meats.map(item => {
                const cat = CATEGORIES.find(c => c.value === item.category);
                return (
                  <div key={item.id} className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${item.is_active ? "border-line bg-card" : "border-line/40 bg-card/40 opacity-60"}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{cat?.emoji ?? "📦"}</span>
                      <div>
                        <p className="font-medium text-cream">{item.name}</p>
                        <p className="text-muted text-xs mt-0.5">{cat?.label ?? item.category} · {item.has_count ? "يُسجَّل عدد الرؤوس" : "وزن فقط"} · ترتيب {item.sort_order}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggle(item)} className={`rounded-xl px-3 py-1.5 text-xs font-medium border transition-colors ${item.is_active ? "bg-green/10 text-green border-green/20 hover:bg-red/10 hover:text-red hover:border-red/20" : "bg-card-hi text-muted border-line hover:bg-green/10 hover:text-green hover:border-green/20"}`}>{item.is_active ? "تعطيل" : "تفعيل"}</button>
                      <button onClick={() => startEdit(item)} className="rounded-xl px-3 py-1.5 text-xs font-medium bg-card-hi text-muted border border-line hover:text-cream">تعديل</button>
                      <button onClick={() => setDeleteId(item.id)} className="rounded-xl px-3 py-1.5 text-xs font-medium bg-red/10 text-red border border-red/20 hover:bg-red/20">حذف</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Payment Methods ── */}
      {tab === "payments" && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-cream">طرق الدفع</h2>
              <p className="text-muted text-xs mt-1">تُعرض في الخطوة 2 — مجموعها يجب يساوي إجمالي المبيعات</p>
            </div>
            <button onClick={startAdd} className="bg-green hover:bg-green-dark text-white rounded-xl px-4 py-2 text-sm font-bold">+ إضافة</button>
          </div>
          {loading ? <p className="text-muted text-center py-8">جاري التحميل...</p> : (
            <div className="space-y-2">
              {payments.map(item => (
                <div key={item.id} className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${item.is_active ? "border-line bg-card" : "border-line/40 bg-card/40 opacity-60"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${item.is_active ? "bg-green" : "bg-muted/30"}`} />
                    <div>
                      <p className="font-medium text-cream">{item.name}</p>
                      <p className="text-muted text-xs mt-0.5" dir="ltr">code: {item.code} · ترتيب {item.sort_order}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggle(item)} className={`rounded-xl px-3 py-1.5 text-xs font-medium border transition-colors ${item.is_active ? "bg-green/10 text-green border-green/20 hover:bg-red/10 hover:text-red hover:border-red/20" : "bg-card-hi text-muted border-line hover:bg-green/10 hover:text-green hover:border-green/20"}`}>{item.is_active ? "تعطيل" : "تفعيل"}</button>
                    <button onClick={() => startEdit(item)} className="rounded-xl px-3 py-1.5 text-xs font-medium bg-card-hi text-muted border border-line hover:text-cream">تعديل</button>
                    <button onClick={() => setDeleteId(item.id)} className="rounded-xl px-3 py-1.5 text-xs font-medium bg-red/10 text-red border border-red/20 hover:bg-red/20">حذف</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Excel ── */}
      {tab === "excel" && <ExcelExport />}

      {/* ── WhatsApp ── */}
      {tab === "whatsapp" && (
        <div className="rounded-3xl border border-line bg-card p-8 text-center">
          <div className="text-5xl mb-4">💬</div>
          <h2 className="text-xl font-bold text-cream mb-2">إشعارات واتساب</h2>
          <p className="text-muted text-sm mb-6 max-w-md mx-auto">
            تنبيهات فورية للمدير عبر واتساب: تأخر الفروع، عجز الكاش، عجز المخزون.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-4 py-2 text-amber text-sm">
            قيد التطوير — سيتوفر قريباً
          </div>
          <div className="mt-8 grid gap-3 max-w-sm mx-auto text-right">
            {[
              { label: "تنبيه تأخر التقرير", note: "الساعة 11 مساءً إذا لم يُرسَل التقرير", done: false },
              { label: "تنبيه عجز الكاش", note: "فوري عند إرسال تقرير بعجز", done: false },
              { label: "تنبيه عجز المخزون", note: "فوري عند اكتشاف نقص في اللحوم", done: false },
              { label: "ملخص يومي", note: "تقرير صباحي بأداء الفروع", done: false },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-line bg-card-hi p-4 flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${item.done ? "bg-green border-green" : "border-muted/40"}`} />
                <div>
                  <p className="text-cream font-medium text-sm">{item.label}</p>
                  <p className="text-muted text-xs">{item.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── POS Agent Update ── */}
      {tab === "pos" && <AgentUpdatePanel />}

      {/* ── Add/Edit Modal ── */}
      {showForm && (tab === "meat" || tab === "payments") && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-cream mb-5">
              {editItem ? "تعديل" : "إضافة"} {tab === "meat" ? "نوع لحم" : "طريقة دفع"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-muted text-sm block mb-1">الاسم</label>
                <input className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream focus:outline-none focus:border-green/50"
                  value={(form.name as string) ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              {tab === "meat" && (
                <>
                  <div>
                    <label className="text-muted text-sm block mb-2">التصنيف</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CATEGORIES.map(c => (
                        <button key={c.value} onClick={() => setForm(f => ({ ...f, category: c.value }))}
                          className={`rounded-xl py-2.5 text-sm font-medium border transition-all ${form.category === c.value ? "bg-green/15 text-green border-green/30" : "bg-card-hi text-muted border-line hover:text-cream"}`}>
                          {c.emoji} {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setForm(f => ({ ...f, has_count: !f.has_count }))}
                      className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${form.has_count ? "bg-green" : "bg-card-hi border border-line"}`}>
                      <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${form.has_count ? "translate-x-6" : ""}`} />
                    </button>
                    <span className="text-sm text-cream">يُسجَّل عدد الرؤوس</span>
                  </div>

                  
                </>
              )}
              {tab === "payments" && (
                <div>
                  <label className="text-muted text-sm block mb-1">الكود (code)</label>
                  <input className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream focus:outline-none focus:border-green/50"
                    placeholder="cash" value={(form.code as string) ?? ""}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="text-muted text-sm block mb-1">ترتيب العرض</label>
                <input type="number" className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream focus:outline-none focus:border-green/50"
                  value={(form.sort_order as number) ?? 99}
                  onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${form.is_active ? "bg-green" : "bg-card-hi border border-line"}`}>
                  <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${form.is_active ? "translate-x-6" : ""}`} />
                </button>
                <span className="text-sm text-cream">{form.is_active ? "نشط ويظهر للكاشير" : "معطّل لا يظهر"}</span>
              </div>
            </div>
            {error && <p className="text-red text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 bg-card-hi border border-line text-cream rounded-2xl py-3">إلغاء</button>
              <button onClick={save} disabled={saving || !form.name} className="flex-[2] bg-green hover:bg-green-dark disabled:opacity-50 text-white rounded-2xl py-3 font-bold">
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-sm text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-cream mb-2">حذف العنصر</h2>
            <p className="text-muted text-sm mb-6">لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-card-hi border border-line text-cream rounded-2xl py-3">إلغاء</button>
              <button onClick={() => del(deleteId)} className="flex-1 bg-red/20 border border-red/30 text-red rounded-2xl py-3 font-bold">حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
