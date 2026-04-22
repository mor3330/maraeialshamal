"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  submitted: { label: "مرفوع", cls: "bg-sky-500/10 text-sky-300 border-sky-500/20" },
  approved:  { label: "معتمد",  cls: "bg-green/10 text-green border-green/20" },
  flagged:   { label: "ملاحظات", cls: "bg-amber/10 text-amber border-amber/20" },
  draft:     { label: "مسودة",  cls: "bg-card-hi text-muted border-line" },
};

function fmt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "0";
}

function fmtDate(v: string) {
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${v}T00:00:00`));
}

function fmtTime(v: string) {
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
}

const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export default function ReportDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [previousBalance, setPreviousBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    fetch(`/api/admin/reports/${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (!d || d.error) {
          setData({ error: d?.error ?? "خطأ غير معروف" });
          setLoading(false);
          return;
        }
        setData(d);
        setStatus(d.report?.status ?? "submitted");
        setLoading(false);
        if (d.report) {
          loadPreviousBalance(d.report.branch_id, d.report.report_date);
        }
      })
      .catch(() => {
        setData({ error: "تعذر الاتصال بالخادم" });
        setLoading(false);
      });
  }, [params.id]);

  async function loadPreviousBalance(branchId: string, date: string) {
    try {
      const res = await fetch(`/api/reports/previous-balance?branchId=${branchId}&date=${date}`);
      const result = await res.json();
      setPreviousBalance(result.data || { hashi: 0, sheep: 0, beef: 0 });
    } catch {
      setPreviousBalance({ hashi: 0, sheep: 0, beef: 0 });
    }
  }

  async function saveChanges() {
    setSaving(true);
    await fetch(`/api/admin/reports/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes: adminNotes.trim() || null }),
    });
    setSaving(false);
    alert("تم الحفظ بنجاح");
  }

  if (loading || !data) {
    return <div className="p-8 text-muted text-center">جاري التحميل...</div>;
  }

  if (!data.report) {
    return <div className="p-8 text-red text-center">تعذر تحميل التقرير — {data.error ?? "بيانات غير مكتملة"}</div>;
  }

  const { report, payments, expenses, stepData } = data;
  const step1 = stepData?.step1 || {};
  const step3 = stepData?.step3 || {};
  const step4 = stepData?.step4 || {};
  const step5 = stepData?.step5 || {};

  // حساب العجوزات — الأسماء مطابقة للـ DB الفعلي (step1Named, step3Named, step4Named, step5Named)
  const prev = previousBalance || { hashi: 0, sheep: 0, beef: 0 };

  // حاشي
  const hashiData = {
    previous:  toN(prev.hashi),
    incoming:  toN(step1.hashi_weight),
    sales:     toN(step3.hashi_weight),
    outgoing:  toN(step4.hashi_outgoing),
    offal:     toN(step5.hashi_offal),
    actual:    toN(step5.hashi_remaining),
    exportTo:  (step4.hashi_export_to as string) || "",
    expected:  0,
    shortage:  0,
  };
  hashiData.expected = hashiData.previous + hashiData.incoming - hashiData.sales - hashiData.outgoing - hashiData.offal;
  hashiData.shortage = hashiData.actual - hashiData.expected;

  // غنم
  const sheepData = {
    previous:  toN(prev.sheep),
    incoming:  toN(step1.sheep_weight),
    sales:     toN(step3.sheep_weight),
    outgoing:  toN(step4.sheep_outgoing_weight),
    offal:     toN(step5.sheep_offal),
    actual:    toN(step5.sheep_remaining),
    exportTo:  (step4.sheep_export_to as string) || "",
    expected:  0,
    shortage:  0,
  };
  sheepData.expected = sheepData.previous + sheepData.incoming - sheepData.sales - sheepData.outgoing - sheepData.offal;
  sheepData.shortage = sheepData.actual - sheepData.expected;

  // عجل
  const beefData = {
    previous:  toN(prev.beef),
    incoming:  toN(step1.beef_weight),
    sales:     toN(step3.beef_weight),
    outgoing:  toN(step4.beef_outgoing),
    offal:     toN(step5.beef_offal),
    actual:    toN(step5.beef_remaining),
    exportTo:  (step4.beef_export_to as string) || "",
    expected:  0,
    shortage:  0,
  };
  beefData.expected = beefData.previous + beefData.incoming - beefData.sales - beefData.outgoing - beefData.offal;
  beefData.shortage = beefData.actual - beefData.expected;

  // حساب الأموال - استخراج من notes إذا payments فاضي
  const totalSales = toN(report.total_sales);
  
  let cashAmount = 0;
  let networkAmount = 0;
  let transferAmount = 0;
  let deferredAmount = 0;
  
  // محاولة القراءة من payments أولاً
  if (payments && payments.length > 0) {
    cashAmount = payments.find((p: any) => p.payment_methods?.code === "cash")?.amount || 0;
    networkAmount = payments.find((p: any) => p.payment_methods?.code === "network")?.amount || 0;
    transferAmount = payments.find((p: any) => p.payment_methods?.code === "transfer")?.amount || 0;
    deferredAmount = payments.find((p: any) => p.payment_methods?.code === "deferred")?.amount || 0;
  } else if (report.notes) {
    // القراءة من notes
    try {
      const notesData = JSON.parse(report.notes);
      if (notesData.payments && Array.isArray(notesData.payments)) {
        cashAmount = notesData.payments.find((p: any) => p.methodId === "cash" || p.methodCode === "cash")?.amount || 0;
        networkAmount = notesData.payments.find((p: any) => p.methodId === "network" || p.methodCode === "network")?.amount || 0;
        transferAmount = notesData.payments.find((p: any) => p.methodId === "transfer" || p.methodCode === "transfer")?.amount || 0;
        deferredAmount = notesData.payments.find((p: any) => p.methodId === "deferred" || p.methodCode === "deferred")?.amount || 0;
      }
    } catch {}
  }
  
  const totalPayments = toN(cashAmount) + toN(networkAmount) + toN(transferAmount) + toN(deferredAmount);
  const moneyDifference = totalPayments - totalSales;

  const totalExpenses = expenses.reduce((s: number, e: any) => s + toN(e.amount), 0);
  const statusMeta = STATUS_MAP[status] ?? STATUS_MAP.submitted;

  function getShortageColor(shortage: number, type: "hashi"|"beef"|"sheep"): string {
    if (Math.abs(shortage) < 0.1) return "text-green";
    const threshold = type === "sheep" ? 2 : 3;
    return Math.abs(shortage) <= threshold ? "text-amber" : "text-red";
  }

  function getMoneyColor(diff: number): string {
    if (Math.abs(diff) < 0.01) return "text-green";
    if (Math.abs(diff) < 100) return "text-amber";
    return "text-red";
  }

  return (
    <div className="min-h-screen bg-bg text-cream p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back */}
        <Link href="/dashboard/reports" className="text-muted hover:text-cream text-sm transition-colors">
          ← العودة للتقارير
        </Link>

        {/* Header */}
        <div className="rounded-3xl border border-line bg-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-cream">{report.branches?.name ?? "فرع غير معروف"}</h1>
              <p className="text-muted text-sm mt-1">{fmtDate(report.report_date)} • رُفع {fmtTime(report.submitted_at)}</p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium ${statusMeta.cls}`}>
              {statusMeta.label}
            </span>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: "إجمالي المبيعات", value: fmt(report.total_sales), cls: "text-cream" },
              { label: "عدد الفواتير", value: fmt(report.invoice_count), cls: "text-cream" },
              { label: "المرتجعات", value: fmt(report.returns_value), cls: "text-amber" },
              { label: "الخصومات", value: fmt(report.discounts_value), cls: "text-amber" },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-line bg-card-hi p-4">
                <p className="text-muted text-xs">{item.label}</p>
                <p className={`font-black text-xl mt-2 ltr-num ${item.cls}`} dir="ltr">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* العجوزات */}
        {previousBalance && (
          <>
            <ShortageCard title="حاشي" data={hashiData} color={getShortageColor(hashiData.shortage, "hashi")} />
            <ShortageCard title="غنم"  data={sheepData} color={getShortageColor(sheepData.shortage, "sheep")} />
            <ShortageCard title="عجل"  data={beefData}  color={getShortageColor(beefData.shortage,  "beef")}  />
          </>
        )}

        {/* المصروفات */}
        {expenses.length > 0 && (
          <div className="bg-card rounded-2xl border border-line overflow-hidden">
            <div className="bg-card-hi px-4 py-3 border-b border-line">
              <h3 className="text-cream font-bold text-lg">المصروفات</h3>
            </div>
            <div className="p-4 space-y-2">
              {expenses.map((exp: any) => (
                <div key={exp.id} className="flex items-center gap-3 bg-card-hi p-2 rounded-lg border border-line">
                  {exp.imageUrl && (
                    <button
                      onClick={() => window.open(exp.imageUrl, '_blank')}
                      className="w-16 h-16 rounded-lg overflow-hidden border border-line hover:border-green transition-colors flex-shrink-0"
                    >
                      <img src={exp.imageUrl} alt="expense" className="w-full h-full object-cover" />
                    </button>
                  )}
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-muted">{exp.description}</span>
                    <span className="text-red ltr-num font-bold" dir="ltr">{fmt(exp.amount)} ر</span>
                  </div>
                </div>
              ))}
              <div className="h-px bg-line my-2" />
              <div className="flex justify-between font-bold">
                <span className="text-muted">إجمالي المصروفات:</span>
                <span className="text-red ltr-num" dir="ltr">{fmt(totalExpenses)} ر</span>
              </div>
            </div>
          </div>
        )}

        {/* مراجعة الصندوق */}
        <div className="bg-card rounded-2xl border border-line overflow-hidden">
          <div className="bg-card-hi px-4 py-3 border-b border-line">
            <h3 className="text-cream font-bold text-lg">مراجعة الصندوق</h3>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted">إجمالي المبيعات:</span>
              <span className="text-cream font-bold ltr-num" dir="ltr">{fmt(totalSales)} ر</span>
            </div>
            <div className="h-px bg-line my-2" />
            <div className="flex justify-between text-sm">
              <span className="text-muted">كاش:</span>
              <span className="text-cream ltr-num" dir="ltr">{fmt(cashAmount)} ر</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">شبكة:</span>
              <span className="text-cream ltr-num" dir="ltr">{fmt(networkAmount)} ر</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">تحويل بنكي:</span>
              <span className="text-cream ltr-num" dir="ltr">{fmt(transferAmount)} ر</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">آجل:</span>
              <span className="text-cream ltr-num" dir="ltr">{fmt(deferredAmount)} ر</span>
            </div>
            <div className="h-px bg-line my-2" />
            <div className="flex justify-between font-bold">
              <span className="text-muted">المجموع:</span>
              <span className="text-cream ltr-num" dir="ltr">{fmt(totalPayments)} ر</span>
            </div>
            <div className={`text-center font-bold text-lg mt-3 ${getMoneyColor(moneyDifference)}`}>
              {Math.abs(moneyDifference) < 0.01 ? "✓ الصندوق مطابق" : `فرق: ${moneyDifference > 0 ? "+" : ""}${fmt(moneyDifference)} ر`}
            </div>
            
            {totalExpenses > 0 && (
              <>
                <div className="h-px bg-line my-3" />
                <div className="bg-card-hi p-3 rounded-xl">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted">الكاش قبل المصروفات:</span>
                    <span className="text-cream ltr-num" dir="ltr">{fmt(cashAmount)} ر</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted">المصروفات:</span>
                    <span className="text-red ltr-num" dir="ltr">- {fmt(totalExpenses)} ر</span>
                  </div>
                  <div className="h-px bg-line my-2" />
                  <div className="flex justify-between font-bold">
                    <span className="text-cream">المتبقي من الكاش:</span>
                    <span className="text-green ltr-num text-xl" dir="ltr">{fmt(toN(cashAmount) - totalExpenses)} ر</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* تفاصيل إضافية من الخطوات */}
        {(() => {
          // استخراج cashier_notes من report.notes JSON
          const cashierNotes = (() => {
            try {
              if (report.notes && typeof report.notes === "string") {
                return JSON.parse(report.notes).cashier_notes || "";
              }
            } catch {}
            return "";
          })();

          const TEXT_FIELDS: { stepObj: any; label: string; keys: string[] }[] = [
            {
              stepObj: step4,
              label: "الصادر",
              keys: ["outgoing_items","offal_to_slaughterhouse","offal to slaughterhouse",
                     "hashi_export_to","sheep_export_to","beef_export_to",
                     "notes","additional_notes"],
            },
            {
              stepObj: step5,
              label: "المتبقي",
              keys: ["offal_remaining","notes","additional_notes"],
            },
          ];

          const FIELD_LABELS: Record<string,string> = {
            outgoing_items:            "المخلفات المسلّمة للمسلخ",
            offal_to_slaughterhouse:   "المخلفات المسلّمة للمسلخ",
            "offal to slaughterhouse": "المخلفات المسلّمة للمسلخ",
            offal_remaining:           "مخلفات متبقية",
            hashi_export_to:           "وجهة صادر الحاشي",
            sheep_export_to:           "وجهة صادر الغنم",
            beef_export_to:            "وجهة صادر العجل",
            notes:                     "ملاحظات إضافية",
            additional_notes:          "ملاحظات إضافية",
          };

          const textEntries: { label: string; step: string; value: string }[] = [];
          TEXT_FIELDS.forEach(({ stepObj, label, keys }) => {
            if (!stepObj) return;
            keys.forEach(k => {
              const v = stepObj[k];
              if (v && typeof v === "string" && v.trim()) {
                textEntries.push({
                  label: FIELD_LABELS[k] ?? k.replace(/_/g, " "),
                  step: label,
                  value: v.trim(),
                });
              }
            });
          });

          if (cashierNotes.trim()) {
            textEntries.push({ label: "ملاحظات إضافية", step: "المصروفات والملاحظات", value: cashierNotes.trim() });
          }

          if (!textEntries.length) return null;
          return (
            <div className="bg-card rounded-2xl border border-line overflow-hidden">
              <div className="bg-card-hi px-4 py-3 border-b border-line">
                <h3 className="text-cream font-bold text-lg">ملاحظات</h3>
              </div>
              <div className="p-4 space-y-3">
                {textEntries.map((n, i) => (
                  <div key={i} className="bg-card-hi p-3 rounded-xl border border-line">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-muted text-xs font-semibold">{n.label}</p>
                      <span className="text-muted/40 text-xs">· {n.step}</span>
                    </div>
                    <p className="text-cream text-sm whitespace-pre-wrap">{n.value}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* تعديل الحالة والملاحظات */}
        <div className="bg-card rounded-2xl border border-line p-5">
          <h3 className="text-cream font-bold text-lg mb-4">تعديل الحالة والملاحظات</h3>
          <div className="space-y-4">
            <div>
              <label className="text-muted text-sm block mb-2">حالة التقرير</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS_MAP).map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => setStatus(key)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium border transition-all ${status === key ? meta.cls : "bg-card-hi text-muted border-line hover:text-cream"}`}
                  >
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-muted text-sm block mb-2">ملاحظات الإدارة</label>
              <textarea
                rows={3}
                className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream placeholder-muted/50 focus:outline-none focus:border-green/50 resize-none"
                placeholder="أضف ملاحظة..."
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
              />
            </div>
            <button
              onClick={saveChanges}
              disabled={saving}
              className="bg-green hover:bg-green-dark disabled:opacity-50 text-white rounded-2xl px-6 py-3 font-bold transition-colors"
            >
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortageCard({ title, data, color }: any) {
  const rows = [
    { label: "رصيد أمس",   val: data.previous },
    { label: "وارد اليوم", val: data.incoming },
    { label: "المبيعات",   val: data.sales    },
    { label: "المخلفات",   val: data.offal    },
  ];
  return (
    <div className="bg-card rounded-2xl border border-line overflow-hidden">
      <div className="bg-card-hi px-4 py-3 border-b border-line">
        <h3 className="text-cream font-bold text-lg">{title}</h3>
      </div>
      <div className="p-4 space-y-2 text-sm">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between">
            <span className="text-muted">{r.label}:</span>
            <span className="text-cream ltr-num" dir="ltr">{r.val.toFixed(2)} كجم</span>
          </div>
        ))}

        {/* الصادر مع وجهته */}
        <div className="flex justify-between">
          <span className="text-muted">الصادر:</span>
          <div className="text-left flex items-center gap-2">
            {data.exportTo && (
              <span className="text-amber text-xs border border-amber/30 bg-amber/10 rounded-lg px-2 py-0.5">
                {data.exportTo}
              </span>
            )}
            <span className="text-cream ltr-num" dir="ltr">{data.outgoing.toFixed(2)} كجم</span>
          </div>
        </div>

        <div className="h-px bg-line my-2" />
        <div className="flex justify-between font-bold">
          <span className="text-muted">المفروض يتبقى:</span>
          <span className="text-cream ltr-num" dir="ltr">{data.expected.toFixed(2)} كجم</span>
        </div>
        <div className="flex justify-between font-bold">
          <span className="text-muted">المتبقي الفعلي:</span>
          <span className="text-cream ltr-num" dir="ltr">{data.actual.toFixed(2)} كجم</span>
        </div>
        <div className="h-px bg-line my-2" />
        <div className={`text-center font-bold text-lg ${color}`}>
          {Math.abs(data.shortage) < 0.1
            ? "مطابق"
            : data.shortage < 0
              ? `⚠️ عجز: ${Math.abs(data.shortage).toFixed(2)} كجم`
              : `⚠️ زيادة: ${data.shortage.toFixed(2)} كجم`}
        </div>
      </div>
    </div>
  );
}
