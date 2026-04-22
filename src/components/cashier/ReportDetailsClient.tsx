"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/report-store";

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

export default function ReportDetailsClient({ 
  slug, 
  reportId 
}: { 
  slug: string; 
  reportId: string;
}) {
  const router = useRouter();
  const [session, setSession] = useState<{ branchName: string } | null>(null);
  const [data, setData] = useState<any>(null);
  const [previousBalance, setPreviousBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s || s.branchSlug !== slug) {
      router.replace(`/branch/${slug}`);
      return;
    }
    setSession(s);
    loadReport();
  }, [slug, reportId, router]);

  async function loadReport() {
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`);
      const result = await res.json();
      setData(result);
      setLoading(false);
      
      // تحميل الرصيد السابق
      if (result.report) {
        loadPreviousBalance(result.report.branch_id, result.report.report_date);
      }
    } catch (err) {
      console.error("[ReportDetails] Error:", err);
      setLoading(false);
    }
  }

  async function loadPreviousBalance(branchId: string, date: string) {
    try {
      const res = await fetch(`/api/reports/previous-balance?branchId=${branchId}&date=${date}`);
      const result = await res.json();
      setPreviousBalance(result.data || { hashi: 0, sheep: 0, beef: 0 });
    } catch {
      setPreviousBalance({ hashi: 0, sheep: 0, beef: 0 });
    }
  }

  if (!session || loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-muted">جاري التحميل...</p>
      </div>
    );
  }

  if (!data || !data.report) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red text-xl mb-2">التقرير غير موجود</p>
          <button
            onClick={() => router.back()}
            className="text-green hover:text-green-dark transition-colors"
          >
            ← العودة
          </button>
        </div>
      </div>
    );
  }

  const { report, payments, expenses, stepData } = data;
  const step1 = stepData?.step1 || {};
  const step2 = stepData?.step2 || {};
  const step3 = stepData?.step3 || {};
  const step4 = stepData?.step4 || {};
  const step5 = stepData?.step5 || {};
  const step6 = stepData?.step6 || {};
  const step7 = stepData?.step7 || {};

  // حساب العجوزات
  const prev = previousBalance || { hashi: 0, sheep: 0, beef: 0 };
  
  // حاشي
  const hashiBoneSales = toN(step3.hashi_bone_weight);
  const hashiCleanSales = toN(step3.hashi_clean_weight);
  const hashiTotalSales = hashiBoneSales + hashiCleanSales;
  const hashiOffal = toN(step4.offal_head_weight) + toN(step4.offal_legs_weight);
  
  const hashiData = {
    previous: toN(prev.hashi),
    incoming: toN(step1.hashi_weight),
    salesBone: hashiBoneSales,
    salesClean: hashiCleanSales,
    sales: hashiTotalSales,
    outgoing: toN(step5.outgoing_hashi),
    offal: hashiOffal,
    actual: toN(step5.hashi_remaining),
    expected: 0,
    shortage: 0,
  };
  hashiData.expected = hashiData.previous + hashiData.incoming - hashiData.sales - hashiData.outgoing - hashiData.offal;
  hashiData.shortage = hashiData.actual - hashiData.expected;

  // غنم
  const sheepSales = toN(step3.sheep_weight);
  const sheepOffal = toN(step4.offal_liver_weight) + toN(step4.offal_fat_weight);
  
  const sheepData = {
    previous: toN(prev.sheep),
    incoming: toN(step1.sheep_weight),
    sales: sheepSales,
    outgoing: toN(step5.outgoing_sheep),
    offal: sheepOffal,
    actual: toN(step5.sheep_remaining),
    expected: 0,
    shortage: 0,
  };
  sheepData.expected = sheepData.previous + sheepData.incoming - sheepData.sales - sheepData.outgoing - sheepData.offal;
  sheepData.shortage = sheepData.actual - sheepData.expected;

  // عجل
  const beefBoneSales = toN(step3.beef_bone_weight);
  const beefCleanSales = toN(step3.beef_clean_weight);
  const beefTotalSales = beefBoneSales + beefCleanSales;
  const beefOffal = toN(step4.offal_other_weight);
  
  const beefData = {
    previous: toN(prev.beef),
    incoming: toN(step1.beef_weight),
    salesBone: beefBoneSales,
    salesClean: beefCleanSales,
    sales: beefTotalSales,
    outgoing: toN(step5.outgoing_beef),
    offal: beefOffal,
    actual: toN(step5.beef_remaining),
    expected: 0,
    shortage: 0,
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
  const cashAfterExpenses = toN(cashAmount) - totalExpenses;

  function getShortageColor(shortage: number): string {
    if (Math.abs(shortage) < 0.1) return "text-green";
    if (Math.abs(shortage) <= 5) return "text-amber";
    return "text-red";
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
        <button 
          onClick={() => router.back()}
          className="text-muted hover:text-cream text-sm transition-colors"
        >
          ← العودة
        </button>

        {/* Header */}
        <div className="rounded-3xl border border-line bg-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-cream">{session.branchName}</h1>
              <p className="text-muted text-sm mt-1">{fmtDate(report.report_date)} • رُفع {fmtTime(report.submitted_at)}</p>
            </div>
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
            <ShortageCard title="حاشي" data={hashiData} color={getShortageColor(hashiData.shortage)} hasBoneClean={true} />
            <ShortageCard title="غنم" data={sheepData} color={getShortageColor(sheepData.shortage)} hasBoneClean={false} />
            <ShortageCard title="عجل" data={beefData} color={getShortageColor(beefData.shortage)} hasBoneClean={true} />
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
                    <span className="text-green ltr-num text-xl" dir="ltr">{fmt(cashAfterExpenses)} ر</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* تفاصيل إضافية من الخطوات */}
        <div className="bg-card rounded-2xl border border-line overflow-hidden">
          <div className="bg-card-hi px-4 py-3 border-b border-line">
            <h3 className="text-cream font-bold text-lg">تفاصيل إضافية</h3>
          </div>
          <div className="p-4 space-y-3">
            {/* المخلفات المسلمة للمسلخ */}
            <div className="bg-card-hi p-3 rounded-lg">
              <p className="text-muted text-sm font-medium mb-1">المخلفات المسلمة للمسلخ:</p>
              <p className="text-cream">{step5.offal_notes || "-"}</p>
            </div>

            {/* مخلفات متبقية */}
            <div className="bg-card-hi p-3 rounded-lg">
              <p className="text-muted text-sm font-medium mb-1">مخلفات متبقية:</p>
              <p className="text-cream">{step5.remaining_offal || "-"}</p>
            </div>

            {/* ملاحظات الوارد */}
            {step1.notes && (
              <div className="bg-card-hi p-3 rounded-lg">
                <p className="text-muted text-sm font-medium mb-1">ملاحظات - الوارد:</p>
                <p className="text-cream whitespace-pre-wrap">{step1.notes}</p>
              </div>
            )}

            {/* ملاحظات المبيعات */}
            {step3.notes && (
              <div className="bg-card-hi p-3 rounded-lg">
                <p className="text-muted text-sm font-medium mb-1">ملاحظات - المبيعات:</p>
                <p className="text-cream whitespace-pre-wrap">{step3.notes}</p>
              </div>
            )}

            {/* ملاحظات المخلفات */}
            {step4.notes && (
              <div className="bg-card-hi p-3 rounded-lg">
                <p className="text-muted text-sm font-medium mb-1">ملاحظات - المخلفات:</p>
                <p className="text-cream whitespace-pre-wrap">{step4.notes}</p>
              </div>
            )}

            {/* ملاحظات المتبقي */}
            {step5.notes && (
              <div className="bg-card-hi p-3 rounded-lg">
                <p className="text-muted text-sm font-medium mb-1">ملاحظات - المتبقي:</p>
                <p className="text-cream whitespace-pre-wrap">{step5.notes}</p>
              </div>
            )}

            {/* ملاحظات وسائل الدفع */}
            {step6.notes && (
              <div className="bg-card-hi p-3 rounded-lg">
                <p className="text-muted text-sm font-medium mb-1">ملاحظات - وسائل الدفع:</p>
                <p className="text-cream whitespace-pre-wrap">{step6.notes}</p>
              </div>
            )}

            {/* ملاحظات قبل التسليم */}
            {step7.notes && (
              <div className="bg-card-hi p-3 rounded-lg">
                <p className="text-muted text-sm font-medium mb-1">ملاحظات قبل التسليم:</p>
                <p className="text-cream whitespace-pre-wrap">{step7.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortageCard({ title, data, color, hasBoneClean }: any) {
  return (
    <div className="bg-card rounded-2xl border border-line overflow-hidden">
      <div className="bg-card-hi px-4 py-3 border-b border-line">
        <h3 className="text-cream font-bold text-lg">{title}</h3>
      </div>
      <div className="p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">رصيد أمس:</span>
          <span className="text-cream ltr-num" dir="ltr">{data.previous.toFixed(2)} كجم</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">وارد اليوم:</span>
          <span className="text-cream ltr-num" dir="ltr">{data.incoming.toFixed(2)} كجم</span>
        </div>
        
        {hasBoneClean ? (
          <>
            <div className="flex justify-between text-xs text-muted/80 pr-4">
              <span>↳ بالعظم:</span>
              <span className="ltr-num" dir="ltr">{data.salesBone.toFixed(2)} كجم</span>
            </div>
            <div className="flex justify-between text-xs text-muted/80 pr-4">
              <span>↳ صافي:</span>
              <span className="ltr-num" dir="ltr">{data.salesClean.toFixed(2)} كجم</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-muted">إجمالي المبيعات:</span>
              <span className="text-cream ltr-num" dir="ltr">{data.sales.toFixed(2)} كجم</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between">
            <span className="text-muted">المبيعات:</span>
            <span className="text-cream ltr-num" dir="ltr">{data.sales.toFixed(2)} كجم</span>
          </div>
        )}
        
        <div className="flex justify-between">
          <span className="text-muted">الصادر:</span>
          <span className="text-cream ltr-num" dir="ltr">{data.outgoing.toFixed(2)} كجم</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">المخلفات:</span>
          <span className="text-cream ltr-num" dir="ltr">{data.offal.toFixed(2)} كجم</span>
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
            ? "✓ مطابق" 
            : data.shortage < 0 
              ? `عجز: ${Math.abs(data.shortage).toFixed(2)} كجم` 
              : `زيادة: ${data.shortage.toFixed(2)} كجم`}
        </div>
      </div>
    </div>
  );
}
