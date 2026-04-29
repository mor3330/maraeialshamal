"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const SECRET_PIN = "335511";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  submitted: { label: "مرفوع",   cls: "bg-sky-500/10 text-sky-300 border-sky-500/20" },
  approved:  { label: "معتمد",   cls: "bg-green/10 text-green border-green/20" },
  flagged:   { label: "ملاحظات", cls: "bg-amber/10 text-amber border-amber/20" },
  draft:     { label: "مسودة",   cls: "bg-card-hi text-muted border-line" },
};

const fmt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "0";
};
const fmtDate = (v: string) =>
  new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${v}T00:00:00`));
const fmtTime = (v: string) =>
  new Intl.DateTimeFormat("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pf = (s: string) => parseFloat(s) || 0;

// ── Modal رمز سري ──
function PinModal({ title, onConfirm, onCancel, danger = false }: {
  title: string; onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  const [pin, setPin] = useState(""), [err, setErr] = useState("");
  const check = () => { if (pin === SECRET_PIN) { setErr(""); onConfirm(); } else { setErr("الرمز السري غير صحيح"); setPin(""); } };
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-4xl mb-2">{danger ? "⚠️" : "🔑"}</div>
          <h3 className="text-cream font-bold text-lg">{title}</h3>
          <p className="text-muted text-sm mt-1">أدخل الرمز السري للمتابعة</p>
        </div>
        <input type="password" inputMode="numeric" maxLength={8} autoFocus value={pin}
          onChange={e => { setPin(e.target.value); setErr(""); }}
          onKeyDown={e => e.key === "Enter" && check()}
          placeholder="••••••"
          className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream text-center text-xl tracking-widest focus:outline-none focus:border-green/50" />
        {err && <p className="text-red text-sm text-center">{err}</p>}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-2xl bg-card-hi border border-line py-3 text-cream font-bold hover:bg-bg">إلغاء</button>
          <button onClick={check} className={`flex-[2] rounded-2xl py-3 font-bold text-white ${danger ? "bg-red hover:bg-red/80" : "bg-green hover:bg-green-dark"}`}>تأكيد</button>
        </div>
      </div>
    </div>
  );
}

// ── حقل إدخال بسيط ──
function Field({ label, value, onChange, step = "0.01", type = "number" }: {
  label: string; value: string; onChange: (v: string) => void; step?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted block mb-1">{label}</label>
      <input type={type} step={step} value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-bg border border-line rounded-xl px-3 py-2.5 text-cream text-sm focus:outline-none focus:border-green/50" />
    </div>
  );
}

// ── قسم حيوان ──
function AnimalSection({ title, icon, fields, onChange }: {
  title: string; icon: string;
  fields: { key: string; label: string; value: string; type?: string }[];
  onChange: (key: string, val: string) => void;
}) {
  return (
    <div className="bg-card-hi rounded-2xl p-4 space-y-3">
      <h4 className="text-cream font-bold text-sm flex items-center gap-2">{icon} {title}</h4>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(f => (
          <Field key={f.key} label={f.label} value={f.value} type={f.type ?? "number"}
            onChange={v => onChange(f.key, v)} />
        ))}
      </div>
    </div>
  );
}

type EditData = {
  // مبيعات رئيسية
  total_sales: string; invoice_count: string; returns_value: string; discounts_value: string;
  // طرق الدفع
  cash: string; network: string; transfer: string; deferred: string;
  // الوارد step1
  s1_hashi: string; s1_sheep: string; s1_beef: string;
  // المبيعات بالوزن step3
  s3_hashi: string; s3_sheep: string; s3_beef: string;
  // الصادر step4
  s4_hashi_out: string; s4_hashi_to: string;
  s4_sheep_out: string; s4_sheep_to: string;
  s4_beef_out: string;  s4_beef_to: string;
  // المخلفات والمتبقي step5
  s5_hashi_offal: string; s5_hashi_rem: string;
  s5_sheep_offal: string; s5_sheep_rem: string;
  s5_beef_offal: string;  s5_beef_rem: string;
};

const TABS = ["💰 المبيعات", "🥩 الوارد", "📊 مبيعات الوزن", "📤 الصادر", "📦 المتبقي"];

export default function ReportDetailPage() {
  const params = useParams(), router = useRouter();
  const reportId = params?.id as string;

  const [data,       setData]       = useState<any>(null);
  const [prevBal,    setPrevBal]    = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [status,     setStatus]     = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const [showEditPin,      setShowEditPin]      = useState(false);
  const [showEditModal,    setShowEditModal]    = useState(false);
  const [showDelPin,       setShowDelPin]       = useState(false);
  const [showEditHistory,  setShowEditHistory]  = useState(false);
  const [activeTab,        setActiveTab]        = useState(0);
  const [editHistory,      setEditHistory]      = useState<any[]>([]);

  // موازنة الشبكة
  const [netSettlement,    setNetSettlement]    = useState("");
  const [savingNS,         setSavingNS]         = useState(false);

  const [ed, setEd] = useState<EditData>({
    total_sales:"", invoice_count:"", returns_value:"", discounts_value:"",
    cash:"", network:"", transfer:"", deferred:"",
    s1_hashi:"", s1_sheep:"", s1_beef:"",
    s3_hashi:"", s3_sheep:"", s3_beef:"",
    s4_hashi_out:"", s4_hashi_to:"", s4_sheep_out:"", s4_sheep_to:"", s4_beef_out:"", s4_beef_to:"",
    s5_hashi_offal:"", s5_hashi_rem:"", s5_sheep_offal:"", s5_sheep_rem:"", s5_beef_offal:"", s5_beef_rem:"",
  });

  useEffect(() => { if (reportId) loadReport(); }, [reportId]);

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`);
      const d = await res.json();
      if (!d || d.error) { setData({ error: d?.error ?? "خطأ" }); return; }
      setData(d);
      setStatus(d.report?.status ?? "submitted");
      setEditHistory(d.editHistory ?? []);
      // تحميل موازنة الشبكة من notes
      try {
        const nd = JSON.parse(d.report?.notes || "{}");
        setNetSettlement(String(nd._network_settlement ?? ""));
      } catch { setNetSettlement(""); }
      if (d.report) loadPrevBal(d.report.branch_id, d.report.report_date);
    } finally { setLoading(false); }
  }

  async function loadPrevBal(bId: string, date: string) {
    try {
      const r = await fetch(`/api/reports/previous-balance?branchId=${bId}&date=${date}`);
      const j = await r.json();
      setPrevBal(j.data || { hashi:0, sheep:0, beef:0 });
    } catch { setPrevBal({ hashi:0, sheep:0, beef:0 }); }
  }

  function fromNotes(report: any, code: string) {
    try {
      const n = JSON.parse(report.notes || "{}");
      return n.payments?.find((p: any) => p.methodId === code || p.methodCode === code)?.amount || 0;
    } catch { return 0; }
  }

  function openEdit() {
    if (!data?.report) return;
    const r = data.report, p = data.payments ?? [];
    const s1 = data.stepData?.step1 || {}, s3 = data.stepData?.step3 || {};
    const s4 = data.stepData?.step4 || {}, s5 = data.stepData?.step5 || {};
    const gp = (code: string) => String(toN(p.find((x: any) => x.payment_methods?.code === code)?.amount || fromNotes(r, code)));
    setEd({
      total_sales: String(toN(r.total_sales)), invoice_count: String(toN(r.invoice_count)),
      returns_value: String(toN(r.returns_value)), discounts_value: String(toN(r.discounts_value)),
      cash: gp("cash"), network: gp("network"), transfer: gp("transfer"), deferred: gp("deferred"),
      s1_hashi: String(toN(s1.hashi_weight)), s1_sheep: String(toN(s1.sheep_weight)), s1_beef: String(toN(s1.beef_weight)),
      s3_hashi: String(toN(s3.hashi_weight)), s3_sheep: String(toN(s3.sheep_weight)), s3_beef: String(toN(s3.beef_weight)),
      s4_hashi_out: String(toN(s4.hashi_outgoing)), s4_hashi_to: s4.hashi_export_to || "",
      s4_sheep_out: String(toN(s4.sheep_outgoing_weight)), s4_sheep_to: s4.sheep_export_to || "",
      s4_beef_out:  String(toN(s4.beef_outgoing)),  s4_beef_to:  s4.beef_export_to  || "",
      s5_hashi_offal: String(toN(s5.hashi_offal)), s5_hashi_rem: String(toN(s5.hashi_remaining)),
      s5_sheep_offal: String(toN(s5.sheep_offal)), s5_sheep_rem: String(toN(s5.sheep_remaining)),
      s5_beef_offal:  String(toN(s5.beef_offal)),  s5_beef_rem:  String(toN(s5.beef_remaining)),
    });
    setActiveTab(0);
    setShowEditModal(true);
  }

  function upd(key: keyof EditData, val: string) { setEd(prev => ({ ...prev, [key]: val })); }

  async function saveEdit() {
    setSaving(true);
    try {
      const p = data.payments ?? [];
      const paymentsToUpdate = (["cash","network","transfer","deferred"] as const).map(code => {
        const ex = p.find((x: any) => x.payment_methods?.code === code);
        return ex ? { id: ex.id, amount: pf((ed as any)[code]) } : null;
      }).filter(Boolean);

      const body: any = {
        total_sales:     pf(ed.total_sales),
        invoice_count:   parseInt(ed.invoice_count) || 0,
        returns_value:   pf(ed.returns_value),
        discounts_value: pf(ed.discounts_value),
        stepDataUpdate: {
          step1Named: { hashi_weight: pf(ed.s1_hashi), sheep_weight: pf(ed.s1_sheep), beef_weight: pf(ed.s1_beef) },
          step3Named: { hashi_weight: pf(ed.s3_hashi), sheep_weight: pf(ed.s3_sheep), beef_weight: pf(ed.s3_beef) },
          step4Named: {
            hashi_outgoing: pf(ed.s4_hashi_out), hashi_export_to: ed.s4_hashi_to,
            sheep_outgoing_weight: pf(ed.s4_sheep_out), sheep_export_to: ed.s4_sheep_to,
            beef_outgoing: pf(ed.s4_beef_out), beef_export_to: ed.s4_beef_to,
          },
          step5Named: {
            hashi_offal: pf(ed.s5_hashi_offal), hashi_remaining: pf(ed.s5_hashi_rem),
            sheep_offal: pf(ed.s5_sheep_offal), sheep_remaining: pf(ed.s5_sheep_rem),
            beef_offal:  pf(ed.s5_beef_offal),  beef_remaining:  pf(ed.s5_beef_rem),
          },
        },
      };
      if (paymentsToUpdate.length > 0) body.payments = paymentsToUpdate;

      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل الحفظ"); }
      setShowEditModal(false);
      await loadReport();
      alert("✓ تم حفظ التعديلات بنجاح");
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  }

  async function saveStatus() {
    setSaving(true);
    await fetch(`/api/admin/reports/${reportId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes: adminNotes.trim() || null }),
    });
    setSaving(false);
    alert("تم الحفظ بنجاح");
  }

  async function saveNetSettlement() {
    setSavingNS(true);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network_settlement: pf(netSettlement) }),
      });
      if (!res.ok) throw new Error("فشل الحفظ");
      alert("✓ تم حفظ موازنة الشبكة");
    } catch (err: any) { alert(err.message); } finally { setSavingNS(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل الحذف"); }
      router.push("/dashboard/reports");
    } catch (err: any) { alert(err.message); setDeleting(false); }
  }

  if (loading || !data) return <div className="p-8 text-muted text-center">جاري التحميل...</div>;
  if (!data.report) return <div className="p-8 text-red text-center">تعذر تحميل التقرير — {data.error ?? "بيانات غير مكتملة"}</div>;

  const { report, payments, expenses, stepData } = data;
  const step1 = stepData?.step1 || {}, step3 = stepData?.step3 || {};
  const step4 = stepData?.step4 || {}, step5 = stepData?.step5 || {};
  const prev  = prevBal || { hashi:0, sheep:0, beef:0 };

  const mkAnimal = (pre: string, s1k: string, s3k: string, outK: string, ofK: string, remK: string) => {
    const d = {
      previous: toN(prev[pre]), incoming: toN(step1[s1k]), sales: toN(step3[s3k]),
      outgoing: toN(step4[outK]), offal: toN(step5[ofK]), actual: toN(step5[remK]),
      exportTo: (step4[`${pre}_export_to`] as string) || "", expected:0, shortage:0,
    };
    d.expected = d.previous + d.incoming - d.sales - d.outgoing - d.offal;
    d.shortage  = d.actual - d.expected;
    return d;
  };
  const hashiData = mkAnimal("hashi","hashi_weight","hashi_weight","hashi_outgoing","hashi_offal","hashi_remaining");
  const sheepData = mkAnimal("sheep","sheep_weight","sheep_weight","sheep_outgoing_weight","sheep_offal","sheep_remaining");
  const beefData  = mkAnimal("beef", "beef_weight", "beef_weight", "beef_outgoing",  "beef_offal", "beef_remaining");

  const totalSales = toN(report.total_sales);
  let cashAmt=0, netAmt=0, trAmt=0, defAmt=0;
  if (payments?.length > 0) {
    cashAmt = payments.find((p: any) => p.payment_methods?.code === "cash")?.amount     || 0;
    netAmt  = payments.find((p: any) => p.payment_methods?.code === "network")?.amount  || 0;
    trAmt   = payments.find((p: any) => p.payment_methods?.code === "transfer")?.amount || 0;
    defAmt  = payments.find((p: any) => p.payment_methods?.code === "deferred")?.amount || 0;
  } else if (report.notes) {
    try {
      const nd = JSON.parse(report.notes);
      if (nd.payments) {
        cashAmt = nd.payments.find((p: any) => p.methodId==="cash"     || p.methodCode==="cash")?.amount     || 0;
        netAmt  = nd.payments.find((p: any) => p.methodId==="network"  || p.methodCode==="network")?.amount  || 0;
        trAmt   = nd.payments.find((p: any) => p.methodId==="transfer" || p.methodCode==="transfer")?.amount || 0;
        defAmt  = nd.payments.find((p: any) => p.methodId==="deferred" || p.methodCode==="deferred")?.amount || 0;
      }
    } catch {}
  }
  const totalPay = toN(cashAmt)+toN(netAmt)+toN(trAmt)+toN(defAmt);
  const moneyDiff = totalPay - totalSales;
  const totalExp  = expenses.reduce((s: number, e: any) => s+toN(e.amount), 0);
  const statusMeta = STATUS_MAP[status] ?? STATUS_MAP.submitted;

  const sc = (sh: number, t: "hashi"|"sheep"|"beef") =>
    Math.abs(sh)<0.1 ? "text-green" : Math.abs(sh)<=(t==="sheep"?2:3) ? "text-amber" : "text-red";
  const mc = (d: number) => Math.abs(d)<0.01 ? "text-green" : Math.abs(d)<100 ? "text-amber" : "text-red";

  // تبويبات التعديل
  const totalEditPay = pf(ed.cash)+pf(ed.network)+pf(ed.transfer)+pf(ed.deferred);

  return (
    <div className="min-h-screen bg-bg text-cream p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* شريط التنقل */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Link href="/dashboard/reports" className="text-muted hover:text-cream text-sm transition-colors">← العودة للتقارير</Link>
          <div className="flex gap-2">
            <button onClick={() => setShowEditPin(true)}
              className="rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 px-4 py-2 text-blue-400 text-sm font-medium transition-all">
              ✏️ تعديل التقرير
            </button>
            <button onClick={() => setShowDelPin(true)} disabled={deleting}
              className="rounded-xl bg-red/10 border border-red/20 hover:bg-red/20 px-4 py-2 text-red text-sm font-medium transition-all disabled:opacity-50">
              🗑 حذف التقرير
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="rounded-3xl border border-line bg-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black text-cream">{report.branches?.name ?? "فرع غير معروف"}</h1>
                {editHistory.length > 0 && (
                  <button onClick={() => setShowEditHistory(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/10 px-3 py-1 text-xs font-bold text-amber hover:bg-amber/20 transition-all">
                    ✏️ معدّل ({editHistory.length})
                  </button>
                )}
              </div>
              <p className="text-muted text-sm mt-1">{fmtDate(report.report_date)} • رُفع {fmtTime(report.submitted_at)}</p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium ${statusMeta.cls}`}>{statusMeta.label}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label:"إجمالي المبيعات", value:fmt(report.total_sales),    cls:"text-cream" },
              { label:"عدد الفواتير",    value:fmt(report.invoice_count),  cls:"text-cream" },
              { label:"المرتجعات",       value:fmt(report.returns_value),  cls:"text-amber" },
              { label:"الخصومات",        value:fmt(report.discounts_value),cls:"text-amber" },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-line bg-card-hi p-4">
                <p className="text-muted text-xs">{item.label}</p>
                <p className={`font-black text-xl mt-2 ltr-num ${item.cls}`} dir="ltr">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* العجوزات */}
        {prevBal && (
          <>
            <ShortageCard title="حاشي" data={hashiData} color={sc(hashiData.shortage,"hashi")} />
            <ShortageCard title="غنم"  data={sheepData} color={sc(sheepData.shortage,"sheep")} />
            <ShortageCard title="عجل"  data={beefData}  color={sc(beefData.shortage, "beef")}  />
          </>
        )}

        {/* المصروفات */}
        {expenses.length > 0 && (
          <div className="bg-card rounded-2xl border border-line overflow-hidden">
            <div className="bg-card-hi px-4 py-3 border-b border-line"><h3 className="text-cream font-bold text-lg">المصروفات</h3></div>
            <div className="p-4 space-y-2">
              {expenses.map((exp: any) => (
                <div key={exp.id} className="flex items-center gap-3 bg-card-hi p-2 rounded-lg border border-line">
                  {exp.imageUrl && (
                    <button onClick={() => window.open(exp.imageUrl,"_blank")}
                      className="w-16 h-16 rounded-lg overflow-hidden border border-line hover:border-green flex-shrink-0">
                      <img src={exp.imageUrl} alt="expense" className="w-full h-full object-cover"/>
                    </button>
                  )}
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-muted">{exp.description}</span>
                    <span className="text-red ltr-num font-bold" dir="ltr">{fmt(exp.amount)} ر</span>
                  </div>
                </div>
              ))}
              <div className="h-px bg-line my-2"/>
              <div className="flex justify-between font-bold">
                <span className="text-muted">إجمالي المصروفات:</span>
                <span className="text-red ltr-num" dir="ltr">{fmt(totalExp)} ر</span>
              </div>
            </div>
          </div>
        )}

        {/* مراجعة الصندوق */}
        <div className="bg-card rounded-2xl border border-line overflow-hidden">
          <div className="bg-card-hi px-4 py-3 border-b border-line"><h3 className="text-cream font-bold text-lg">مراجعة الصندوق</h3></div>
          <div className="p-4 space-y-2">
            <div className="flex justify-between"><span className="text-muted">إجمالي المبيعات:</span><span className="text-cream font-bold ltr-num" dir="ltr">{fmt(totalSales)} ر</span></div>
            <div className="h-px bg-line my-2"/>
            {[["كاش",cashAmt],["شبكة",netAmt],["تحويل بنكي",trAmt],["آجل",defAmt]].map(([l,v]) => (
              <div key={l as string} className="flex justify-between text-sm">
                <span className="text-muted">{l}:</span><span className="text-cream ltr-num" dir="ltr">{fmt(v)} ر</span>
              </div>
            ))}
            <div className="h-px bg-line my-2"/>
            <div className="flex justify-between font-bold"><span className="text-muted">المجموع:</span><span className="text-cream ltr-num" dir="ltr">{fmt(totalPay)} ر</span></div>
            <div className={`text-center font-bold text-lg mt-3 ${mc(moneyDiff)}`}>
              {Math.abs(moneyDiff)<0.01 ? "✓ الصندوق مطابق" : `فرق: ${moneyDiff>0?"+":""}${fmt(moneyDiff)} ر`}
            </div>
            {totalExp > 0 && (
              <>
                <div className="h-px bg-line my-3"/>
                <div className="bg-card-hi p-3 rounded-xl">
                  <div className="flex justify-between text-sm mb-2"><span className="text-muted">الكاش قبل المصروفات:</span><span className="text-cream ltr-num" dir="ltr">{fmt(cashAmt)} ر</span></div>
                  <div className="flex justify-between text-sm mb-2"><span className="text-muted">المصروفات:</span><span className="text-red ltr-num" dir="ltr">- {fmt(totalExp)} ر</span></div>
                  <div className="h-px bg-line my-2"/>
                  <div className="flex justify-between font-bold"><span className="text-cream">المتبقي من الكاش:</span><span className="text-green ltr-num text-xl" dir="ltr">{fmt(toN(cashAmt)-totalExp)} ر</span></div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 💳 حساب الكاش الفعلي - موازنة الشبكة */}
        <div className="bg-card rounded-2xl border border-line overflow-hidden">
          <div className="bg-card-hi px-4 py-3 border-b border-line flex items-center gap-2">
            <h3 className="text-cream font-bold text-lg">💳 الكاش الفعلي</h3>
            <span className="text-xs text-muted bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">أدخل موازنة جهاز الشبكة</span>
          </div>
          <div className="p-4 space-y-3">
            {/* حقل موازنة الشبكة */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted block mb-1">📟 موازنة جهاز الشبكة (من الجهاز مباشرة)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={netSettlement}
                  onChange={e => setNetSettlement(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-bg border border-blue-500/30 rounded-xl px-4 py-3 text-cream text-lg font-bold focus:outline-none focus:border-blue-400 ltr-num"
                  dir="ltr"
                />
              </div>
              <button
                onClick={saveNetSettlement} disabled={savingNS}
                className="mt-5 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 px-4 py-3 text-blue-400 font-bold text-sm disabled:opacity-50 transition-all whitespace-nowrap">
                {savingNS ? "⏳" : "💾 حفظ"}
              </button>
            </div>

            {/* الحساب التلقائي */}
            {pf(netSettlement) > 0 && (
              <div className="bg-card-hi rounded-xl p-4 space-y-2 border border-green/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">إجمالي المبيعات:</span>
                  <span className="text-cream font-bold ltr-num" dir="ltr">{fmt(totalSales)} ر</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">(-) موازنة الشبكة:</span>
                  <span className="text-amber ltr-num" dir="ltr">- {fmt(pf(netSettlement))} ر</span>
                </div>
                {totalExp > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">(-) المصروفات:</span>
                    <span className="text-red ltr-num" dir="ltr">- {fmt(totalExp)} ر</span>
                  </div>
                )}
                <div className="h-px bg-green/20 my-1"/>
                <div className="flex justify-between items-center">
                  <span className="text-cream font-bold text-sm">الكاش الفعلي المتوفر:</span>
                  <span className="text-green font-black text-2xl ltr-num" dir="ltr">
                    {fmt(totalSales - pf(netSettlement) - totalExp)} ر
                  </span>
                </div>
                {/* مقارنة مع الكاش المدخل */}
                {toN(cashAmt) > 0 && (() => {
                  const actualCash = totalSales - pf(netSettlement) - totalExp;
                  const entered = toN(cashAmt) - totalExp;
                  const diff = actualCash - entered;
                  return Math.abs(diff) > 0.5 ? (
                    <div className={`text-center text-xs font-bold mt-1 py-1.5 rounded-lg ${Math.abs(diff) < 50 ? "text-amber bg-amber/10" : "text-red bg-red/10"}`}>
                      ⚠️ فرق مع الكاش المسجّل في النظام: {diff > 0 ? "+" : ""}{fmt(diff)} ر
                    </div>
                  ) : (
                    <div className="text-center text-xs font-bold mt-1 py-1.5 rounded-lg text-green bg-green/10">
                      ✓ الكاش متطابق مع موازنة الشبكة
                    </div>
                  );
                })()}
              </div>
            )}
            {!pf(netSettlement) && (
              <p className="text-muted text-xs text-center py-2">أدخل قيمة موازنة الشبكة لحساب الكاش الفعلي تلقائياً</p>
            )}
          </div>
        </div>

        {/* تعديل الحالة والملاحظات */}
        <div className="bg-card rounded-2xl border border-line p-5">
          <h3 className="text-cream font-bold text-lg mb-4">تعديل الحالة والملاحظات</h3>
          <div className="space-y-4">
            <div>
              <label className="text-muted text-sm block mb-2">حالة التقرير</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS_MAP).map(([k,m]) => (
                  <button key={k} onClick={() => setStatus(k)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium border transition-all ${status===k?m.cls:"bg-card-hi text-muted border-line hover:text-cream"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-muted text-sm block mb-2">ملاحظات الإدارة</label>
              <textarea rows={3} className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream placeholder-muted/50 focus:outline-none focus:border-green/50 resize-none"
                placeholder="أضف ملاحظة..." value={adminNotes} onChange={e => setAdminNotes(e.target.value)}/>
            </div>
            <button onClick={saveStatus} disabled={saving}
              className="bg-green hover:bg-green-dark disabled:opacity-50 text-white rounded-2xl px-6 py-3 font-bold transition-colors">
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
          </div>
        </div>
      </div>

      {/* Modal رمز التعديل */}
      {showEditPin && (
        <PinModal title="تعديل بيانات التقرير"
          onConfirm={() => { setShowEditPin(false); openEdit(); }}
          onCancel={() => setShowEditPin(false)}/>
      )}

      {/* Modal التعديل الشامل */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
          <div className="min-h-screen flex items-start justify-center p-4 py-8">
            <div className="bg-card border border-line rounded-3xl w-full max-w-2xl">

              {/* رأس النافذة */}
              <div className="flex items-center justify-between p-5 border-b border-line">
                <h2 className="text-xl font-bold text-cream">✏️ تعديل بيانات التقرير</h2>
                <button onClick={() => setShowEditModal(false)} className="text-muted hover:text-cream text-xl w-8 h-8 flex items-center justify-center">✕</button>
              </div>

              {/* التبويبات */}
              <div className="flex overflow-x-auto border-b border-line">
                {TABS.map((t, i) => (
                  <button key={i} onClick={() => setActiveTab(i)}
                    className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeTab===i?"border-green text-green":"border-transparent text-muted hover:text-cream"}`}>
                    {t}
                  </button>
                ))}
              </div>

              {/* محتوى التبويبات */}
              <div className="p-5 space-y-4">

                {/* تبويب 0: المبيعات وطرق الدفع */}
                {activeTab === 0 && (
                  <>
                    <p className="text-muted text-xs font-semibold uppercase tracking-wide">بيانات المبيعات الرئيسية</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="إجمالي المبيعات" value={ed.total_sales}     onChange={v=>upd("total_sales",v)}/>
                      <Field label="عدد الفواتير"    value={ed.invoice_count}   onChange={v=>upd("invoice_count",v)} step="1"/>
                      <Field label="المرتجعات"       value={ed.returns_value}   onChange={v=>upd("returns_value",v)}/>
                      <Field label="الخصومات"        value={ed.discounts_value} onChange={v=>upd("discounts_value",v)}/>
                    </div>
                    <div className="h-px bg-line"/>
                    <p className="text-muted text-xs font-semibold uppercase tracking-wide">طرق الدفع</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="كاش"        value={ed.cash}     onChange={v=>upd("cash",v)}/>
                      <Field label="شبكة"       value={ed.network}  onChange={v=>upd("network",v)}/>
                      <Field label="تحويل بنكي" value={ed.transfer} onChange={v=>upd("transfer",v)}/>
                      <Field label="آجل"         value={ed.deferred} onChange={v=>upd("deferred",v)}/>
                    </div>
                    <div className="bg-card-hi rounded-xl p-3 text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-muted">مجموع طرق الدفع:</span><span className="text-cream font-bold ltr-num" dir="ltr">{fmt(totalEditPay)} ر</span></div>
                      <div className="flex justify-between"><span className="text-muted">إجمالي المبيعات:</span><span className="text-cream font-bold ltr-num" dir="ltr">{fmt(pf(ed.total_sales))} ر</span></div>
                      {Math.abs(totalEditPay - pf(ed.total_sales)) > 0.01 && (
                        <div className="flex justify-between text-red font-bold">
                          <span>فرق:</span><span dir="ltr">{fmt(totalEditPay - pf(ed.total_sales))} ر</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* تبويب 1: الوارد */}
                {activeTab === 1 && (
                  <>
                    <p className="text-muted text-xs font-semibold uppercase tracking-wide mb-2">الوارد اليوم (كجم)</p>
                    <AnimalSection title="حاشي" icon="🐄" onChange={(k,v) => upd(("s1_"+k) as keyof EditData, v)}
                      fields={[
                        {key:"hashi", label:"وزن الحاشي (كجم)", value:ed.s1_hashi},
                      ]}/>
                    <AnimalSection title="غنم" icon="🐑" onChange={(k,v) => upd(("s1_"+k) as keyof EditData, v)}
                      fields={[{key:"sheep", label:"وزن الغنم (كجم)", value:ed.s1_sheep}]}/>
                    <AnimalSection title="عجل" icon="🐂" onChange={(k,v) => upd(("s1_"+k) as keyof EditData, v)}
                      fields={[{key:"beef", label:"وزن العجل (كجم)", value:ed.s1_beef}]}/>
                  </>
                )}

                {/* تبويب 2: مبيعات الوزن */}
                {activeTab === 2 && (
                  <>
                    <p className="text-muted text-xs font-semibold uppercase tracking-wide mb-2">المبيعات بالوزن (كجم)</p>
                    <div className="space-y-3">
                      <div className="bg-card-hi rounded-2xl p-4 grid grid-cols-3 gap-3">
                        <Field label="🐄 حاشي (كجم)" value={ed.s3_hashi} onChange={v=>upd("s3_hashi",v)}/>
                        <Field label="🐑 غنم (كجم)"  value={ed.s3_sheep} onChange={v=>upd("s3_sheep",v)}/>
                        <Field label="🐂 عجل (كجم)"  value={ed.s3_beef}  onChange={v=>upd("s3_beef",v)}/>
                      </div>
                    </div>
                  </>
                )}

                {/* تبويب 3: الصادر */}
                {activeTab === 3 && (
                  <>
                    <p className="text-muted text-xs font-semibold uppercase tracking-wide mb-2">الصادر والوجهات</p>
                    <div className="space-y-3">
                      <div className="bg-card-hi rounded-2xl p-4 space-y-3">
                        <h4 className="text-cream font-bold text-sm">🐄 حاشي</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="وزن الصادر (كجم)" value={ed.s4_hashi_out} onChange={v=>upd("s4_hashi_out",v)}/>
                          <Field label="الوجهة" value={ed.s4_hashi_to} onChange={v=>upd("s4_hashi_to",v)} type="text"/>
                        </div>
                      </div>
                      <div className="bg-card-hi rounded-2xl p-4 space-y-3">
                        <h4 className="text-cream font-bold text-sm">🐑 غنم</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="وزن الصادر (كجم)" value={ed.s4_sheep_out} onChange={v=>upd("s4_sheep_out",v)}/>
                          <Field label="الوجهة" value={ed.s4_sheep_to} onChange={v=>upd("s4_sheep_to",v)} type="text"/>
                        </div>
                      </div>
                      <div className="bg-card-hi rounded-2xl p-4 space-y-3">
                        <h4 className="text-cream font-bold text-sm">🐂 عجل</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="وزن الصادر (كجم)" value={ed.s4_beef_out} onChange={v=>upd("s4_beef_out",v)}/>
                          <Field label="الوجهة" value={ed.s4_beef_to} onChange={v=>upd("s4_beef_to",v)} type="text"/>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* تبويب 4: المخلفات والمتبقي */}
                {activeTab === 4 && (
                  <>
                    <p className="text-muted text-xs font-semibold uppercase tracking-wide mb-2">المخلفات والمتبقي (كجم)</p>
                    <div className="space-y-3">
                      {[
                        { title:"🐄 حاشي", offal:ed.s5_hashi_offal, rem:ed.s5_hashi_rem, ko:"s5_hashi_offal" as keyof EditData, kr:"s5_hashi_rem" as keyof EditData },
                        { title:"🐑 غنم",  offal:ed.s5_sheep_offal, rem:ed.s5_sheep_rem, ko:"s5_sheep_offal" as keyof EditData, kr:"s5_sheep_rem" as keyof EditData },
                        { title:"🐂 عجل",  offal:ed.s5_beef_offal,  rem:ed.s5_beef_rem,  ko:"s5_beef_offal"  as keyof EditData, kr:"s5_beef_rem"  as keyof EditData },
                      ].map(row => (
                        <div key={row.title} className="bg-card-hi rounded-2xl p-4 space-y-3">
                          <h4 className="text-cream font-bold text-sm">{row.title}</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="المخلفات (كجم)"  value={row.offal} onChange={v=>upd(row.ko,v)}/>
                            <Field label="المتبقي (كجم)"   value={row.rem}   onChange={v=>upd(row.kr,v)}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* أزرار الحفظ */}
              <div className="p-5 border-t border-line flex gap-3">
                <button onClick={() => setShowEditModal(false)}
                  className="flex-1 rounded-2xl bg-card-hi border border-line py-3 font-bold text-cream hover:bg-bg">
                  إلغاء
                </button>
                <button onClick={saveEdit} disabled={saving}
                  className="flex-[2] rounded-2xl bg-green hover:bg-green-dark disabled:opacity-50 py-3 font-bold text-white">
                  {saving ? "جاري الحفظ..." : "💾 حفظ جميع التعديلات"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal رمز الحذف */}
      {showDelPin && (
        <PinModal title="⚠️ تأكيد حذف التقرير" danger
          onConfirm={() => { setShowDelPin(false); handleDelete(); }}
          onCancel={() => setShowDelPin(false)}/>
      )}

      {/* Modal سجل التعديلات */}
      {showEditHistory && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
          <div className="min-h-screen flex items-start justify-center p-4 py-8">
            <div className="bg-card border border-line rounded-3xl w-full max-w-2xl">
              <div className="flex items-center justify-between p-5 border-b border-line">
                <h2 className="text-xl font-bold text-cream">📋 سجل التعديلات</h2>
                <button onClick={() => setShowEditHistory(false)} className="text-muted hover:text-cream text-xl w-8 h-8 flex items-center justify-center">✕</button>
              </div>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {editHistory.length === 0 ? (
                  <p className="text-muted text-center py-8">لا توجد تعديلات مسجّلة</p>
                ) : [...editHistory].reverse().map((entry, i) => (
                  <div key={i} className="bg-card-hi border border-line rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber flex-shrink-0"/>
                      <span className="text-muted text-xs">
                        {new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
                          dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh"
                        }).format(new Date(entry.timestamp))}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(entry.changes).map(([field, val]: [string, any]) => {
                        const sectionLabels: Record<string, string> = {
                          total_sales:     "💰 إجمالي المبيعات",
                          invoice_count:   "🧾 عدد الفواتير",
                          returns_value:   "↩️ المرتجعات",
                          discounts_value: "🏷️ الخصومات",
                          step1_incoming:  "📥 الوارد اليوم",
                          step3_sales:     "⚖️ مبيعات الوزن",
                          step4_outgoing:  "📤 الصادر",
                          step5_remaining: "📦 المخلفات والمتبقي",
                        };
                        const fieldLabels: Record<string, string> = {
                          hashi_weight: "حاشي (كجم)", sheep_weight: "غنم (كجم)", beef_weight: "عجل (كجم)",
                          hashi_offal: "مخلفات حاشي", hashi_remaining: "متبقي حاشي",
                          sheep_offal: "مخلفات غنم",  sheep_remaining: "متبقي غنم",
                          beef_offal:  "مخلفات عجل",  beef_remaining:  "متبقي عجل",
                          hashi_outgoing: "صادر حاشي", sheep_outgoing_weight: "صادر غنم", beef_outgoing: "صادر عجل",
                          hashi_export_to: "وجهة حاشي", sheep_export_to: "وجهة غنم", beef_export_to: "وجهة عجل",
                        };
                        const isSimple = typeof val.old !== "object" || val.old === null;
                        return (
                          <div key={field} className="rounded-xl border border-line bg-bg p-3">
                            <p className="text-amber text-xs font-bold mb-2">{sectionLabels[field] ?? field}</p>
                            {isSimple ? (
                              <div className="flex items-center gap-3">
                                <span className="text-red/80 ltr-num line-through text-sm" dir="ltr">{fmt(val.old)}</span>
                                <span className="text-muted text-lg">→</span>
                                <span className="text-green font-bold ltr-num text-sm" dir="ltr">{fmt(val.new)}</span>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {Object.entries(val.new || {}).map(([k2, newV]: [string, any]) => {
                                  const oldV = (val.old || {})[k2];
                                  const numChanged = typeof newV === "number" && Math.abs(toN(oldV) - toN(newV)) > 0.001;
                                  const txtChanged = typeof newV === "string" && (oldV || "").trim() !== (newV || "").trim();
                                  if (!numChanged && !txtChanged) return null;
                                  return (
                                    <div key={k2} className="flex items-center justify-between text-xs">
                                      <span className="text-muted">{fieldLabels[k2] ?? k2}:</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-red/70 line-through ltr-num" dir="ltr">
                                          {typeof oldV === "number" ? oldV.toFixed(2) : (oldV || "—")}
                                        </span>
                                        <span className="text-muted">→</span>
                                        <span className="text-green font-bold ltr-num" dir="ltr">
                                          {typeof newV === "number" ? newV.toFixed(2) : (newV || "—")}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-line">
                <button onClick={() => setShowEditHistory(false)}
                  className="w-full rounded-2xl bg-card-hi border border-line py-3 font-bold text-cream hover:bg-bg">
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShortageCard({ title, data, color }: any) {
  return (
    <div className="bg-card rounded-2xl border border-line overflow-hidden">
      <div className="bg-card-hi px-4 py-3 border-b border-line"><h3 className="text-cream font-bold text-lg">{title}</h3></div>
      <div className="p-4 space-y-2 text-sm">
        {[["رصيد أمس",data.previous],["وارد اليوم",data.incoming],["المبيعات",data.sales],["المخلفات",data.offal]].map(([l,v]) => (
          <div key={l as string} className="flex justify-between">
            <span className="text-muted">{l}:</span>
            <span className="text-cream ltr-num" dir="ltr">{(v as number).toFixed(2)} كجم</span>
          </div>
        ))}
        <div className="flex justify-between">
          <span className="text-muted">الصادر:</span>
          <div className="flex items-center gap-2">
            {data.exportTo && <span className="text-amber text-xs border border-amber/30 bg-amber/10 rounded-lg px-2 py-0.5">{data.exportTo}</span>}
            <span className="text-cream ltr-num" dir="ltr">{data.outgoing.toFixed(2)} كجم</span>
          </div>
        </div>
        <div className="h-px bg-line my-2"/>
        <div className="flex justify-between font-bold"><span className="text-muted">المفروض يتبقى:</span><span className="text-cream ltr-num" dir="ltr">{data.expected.toFixed(2)} كجم</span></div>
        <div className="flex justify-between font-bold"><span className="text-muted">المتبقي الفعلي:</span><span className="text-cream ltr-num" dir="ltr">{data.actual.toFixed(2)} كجم</span></div>
        <div className="h-px bg-line my-2"/>
        <div className={`text-center font-bold text-lg ${color}`}>
          {Math.abs(data.shortage)<0.1 ? "مطابق" : data.shortage<0 ? `⚠️ عجز: ${Math.abs(data.shortage).toFixed(2)} كجم` : `⚠️ زيادة: ${data.shortage.toFixed(2)} كجم`}
        </div>
      </div>
    </div>
  );
}
