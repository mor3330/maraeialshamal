"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CashierHeader from "./CashierHeader";
import { getDraft, clearDraft, getSession } from "@/lib/report-store";

export default function ReviewWithShortage({ slug }: { slug: string }) {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [previousBalance, setPreviousBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s || s.branchSlug !== slug) {
      router.replace(`/branch/${slug}`);
      return;
    }
    setSession(s);

    const d = getDraft();
    if (!d) {
      router.replace(`/branch/${slug}/home`);
      return;
    }
    
    // تسجيل المسودة الكاملة للتشخيص
    console.log("[ReviewWithShortage] Draft keys:", Object.keys(d));
    console.log("[ReviewWithShortage] step2Named:", (d as any).step2Named);
    console.log("[ReviewWithShortage] step3Named:", (d as any).step3Named);
    console.log("[ReviewWithShortage] step6Named:", (d as any).step6Named);
    console.log("[ReviewWithShortage] totalSales:", d.totalSales);
    console.log("[ReviewWithShortage] payments:", d.payments);
    
    setDraft(d);
    loadPreviousBalance(s.branchId, d.reportDate);
  }, [slug, router]);

  async function loadPreviousBalance(branchId: string, date: string) {
    try {
      const res = await fetch(`/api/reports/previous-balance?branchId=${branchId}&date=${date}`);
      const data = await res.json();
      setPreviousBalance(data.data || { hashi: 0, sheep: 0, beef: 0 });
    } catch {
      setPreviousBalance({ hashi: 0, sheep: 0, beef: 0 });
    }
    setLoading(false);
  }

  function getVal(fieldName: string, step: number): number {
    if (!draft) return 0;
    const named = draft[`step${step}Named`] || {};
    return parseFloat(named[fieldName] || 0);
  }

  function calculateShortage() {
    if (!previousBalance || !draft) return null;
    const prev = previousBalance;

    // حاشي - دعم النسخة القديمة (bone+clean) والجديدة (weight مباشر)
    const hashiSalesNew = getVal('hashi_weight', 3);
    const hashiSalesOld = getVal('hashi_bone_weight', 3) + getVal('hashi_clean_weight', 3);
    const hashiSales = hashiSalesNew > 0 ? hashiSalesNew : hashiSalesOld;
    
    const hashi = {
      previous: prev.hashi || 0,
      incoming: getVal('hashi_weight', 1),
      salesBone: 0,
      salesClean: hashiSales,
      sales: hashiSales,
      outgoing: getVal('hashi_outgoing', 4),
      offal: getVal('hashi_offal', 5),
      actual: getVal('hashi_remaining', 5),
      expected: 0, shortage: 0,
    };
    hashi.expected = hashi.previous + hashi.incoming - hashi.sales - hashi.outgoing - hashi.offal;
    hashi.shortage = hashi.actual - hashi.expected;

    // غنم
    const sheep = {
      previous: prev.sheep || 0,
      incoming: getVal('sheep_weight', 1),
      salesBone: 0,
      salesClean: getVal('sheep_weight', 3),
      sales: getVal('sheep_weight', 3),
      outgoing: getVal('sheep_outgoing_weight', 4),
      offal: getVal('sheep_offal', 5),
      actual: getVal('sheep_remaining', 5),
      expected: 0, shortage: 0,
    };
    sheep.expected = sheep.previous + sheep.incoming - sheep.sales - sheep.outgoing - sheep.offal;
    sheep.shortage = sheep.actual - sheep.expected;

    // عجل - دعم النسخة القديمة (bone+clean) والجديدة (weight مباشر)
    const beefSalesNew = getVal('beef_weight', 3);
    const beefSalesOld = getVal('beef_bone_weight', 3) + getVal('beef_clean_weight', 3);
    const beefSales = beefSalesNew > 0 ? beefSalesNew : beefSalesOld;
    
    const beef = {
      previous: prev.beef || 0,
      incoming: getVal('beef_weight', 1),
      salesBone: 0,
      salesClean: beefSales,
      sales: beefSales,
      outgoing: getVal('beef_outgoing', 4),
      offal: getVal('beef_offal', 5),
      actual: getVal('beef_remaining', 5),
      expected: 0, shortage: 0,
    };
    beef.expected = beef.previous + beef.incoming - beef.sales - beef.outgoing - beef.offal;
    beef.shortage = beef.actual - beef.expected;

    return { hashi, sheep, beef };
  }

  function calculateMoneyMatch() {
    const toN = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    // القراءة من الحقول المباشرة أولاً (المحفوظة بـ DynamicStepClient)، ثم step named كـ fallback
    const totalSales = toN(draft?.totalSales) || getVal('total_sales', 2);
    const payments = draft?.payments ?? [];
    const cash     = toN(payments.find((p: any) => p.methodCode === "cash")?.amount)     || getVal('cash_amount', 2);
    const network  = toN(payments.find((p: any) => p.methodCode === "network")?.amount)  || getVal('network_amount', 2);
    const transfer = toN(payments.find((p: any) => p.methodCode === "transfer")?.amount) || getVal('transfer_amount', 2);
    const deferred = toN(payments.find((p: any) => p.methodCode === "deferred")?.amount) || getVal('deferred_amount', 2);
    const total = cash + network + transfer + deferred;
    const difference = total - totalSales;

    return { totalSales, cash, network, transfer, deferred, total, difference, isMatch: Math.abs(difference) < 0.01 };
  }

  /** مقارنة مبيعات النظام (الخطوة 3) بالمبيعات الحقيقية (الخطوة 2) */
  function calculateSalesComparison() {
    const toN = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const step3 = draft?.step3Named || {};

    // كلمات تدل على المبلغ/السعر (أولوية عالية)
    const AMT_HINTS = ["amount", "sales", "total", "price", "value", "مبلغ", "إجمالي", "سعر", "قيمة", "مبيعات"];
    // كلمات تدل على الكمية/الوزن فقط (بدون offal - لأنه اسم فئة وليس وزن)
    const QTY_ONLY = ["_weight", "_qty", "_quantity", "_count", "_remaining", "_bone", "_clean"];

    function isQtyField(key: string): boolean {
      return QTY_ONLY.some(q => key.toLowerCase().includes(q));
    }

    /** ابحث في حقول الفئة واستخرج المبلغ */
    function getCategoryAmt(prefix: string): number {
      const keys = Object.keys(step3).filter(k => k.startsWith(prefix));
      if (keys.length === 0) return 0;

      // المحاولة 1: حقل اسمه يحتوي مؤشر مبلغ
      for (const k of keys) {
        if (AMT_HINTS.some(h => k.toLowerCase().includes(h))) {
          const v = toN(step3[k]);
          if (v > 0) return v;
        }
      }

      // المحاولة 2: الحقل الأكبر قيمةً بين الحقول غير الكمية (يُرجَّح أنه المبلغ)
      const nonQtyKeys = keys.filter(k => !isQtyField(k));
      if (nonQtyKeys.length > 0) {
        return Math.max(0, ...nonQtyKeys.map(k => toN(step3[k])));
      }

      return 0;
    }

    const hashiAmt  = getCategoryAmt('hashi_');
    const sheepAmt  = getCategoryAmt('sheep_');
    const beefAmt   = getCategoryAmt('beef_');
    const offalAmt  = getCategoryAmt('offal_');
    let systemTotal = hashiAmt + sheepAmt + beefAmt + offalAmt;

    // إذا لم تُعثر على بيانات بالفئات، اجمع كل الحقول الكبيرة من الخطوة 3
    const step3Entries = Object.entries(step3);
    const hasAnyCategoryField = step3Entries.some(([k]) =>
      k.startsWith('hashi_') || k.startsWith('sheep_') || k.startsWith('beef_') || k.startsWith('offal_')
    );
    
    // إذا لم تكن هناك حقول بالبادئة المعروفة، اجمع كل الحقول الرقمية > 0
    let genericMode = false;
    if (systemTotal === 0 && step3Entries.length > 0 && !hasAnyCategoryField) {
      systemTotal = step3Entries.reduce((s, [k, v]) => {
        const n = toN(v);
        return !isQtyField(k) && n > 0 ? s + n : s;
      }, 0);
      genericMode = true;
    }

    // المبيعات الحقيقية من الخطوة 2
    const actualSales = toN(draft?.totalSales) || getVal('total_sales', 2);
    const diff = systemTotal - actualSales;

    return { hashiAmt, sheepAmt, beefAmt, offalAmt, systemTotal, actualSales, diff,
             hasData: systemTotal > 0, genericMode };
  }

  function getShortageColor(shortage: number, type: "hashi"|"beef"|"sheep"): string {
    if (Math.abs(shortage) < 0.1) return "text-green";
    const threshold = type === "sheep" ? 2 : 3;
    return Math.abs(shortage) <= threshold ? "text-amber" : "text-red";
  }

  function getMoneyColor(difference: number): string {
    if (Math.abs(difference) < 0.01) return "text-green-500";
    if (Math.abs(difference) < 100) return "text-yellow-500";
    return "text-red-500";
  }

  async function handleSubmit() {
    const money = calculateMoneyMatch();
    if (!money.isMatch) {
      if (!confirm(`هناك فرق في الصندوق: ${money.difference.toFixed(2)} ريال. هل تريد المتابعة؟`)) return;
    }

    setSubmitting(true);
    try {
      const branchId = draft.branchId || session.branchId;
      if (!branchId) {
        throw new Error("لم يتم العثور على معرف الفرع");
      }

      const toN = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

      // قراءة القيم المباشرة من draft (المحفوظة بـ DynamicStepClient) مع fallback لـ step named
      const totalSales   = toN(draft.totalSales)   || getVal('total_sales',   2);
      const invoiceCount = toN(draft.invoiceCount)  || getVal('invoice_count', 2);
      const returnsValue = toN(draft.returnsValue)  || getVal('returns_value', 2);
      
      // حساب الأموال من الخطوة 6
      const cashAmount     = toN(draft.payments?.find((p: any) => p.methodCode === "cash")?.amount)     || getVal('cash_amount',     6);
      const networkAmount  = toN(draft.payments?.find((p: any) => p.methodCode === "network")?.amount)  || getVal('network_amount',  6);
      const transferAmount = toN(draft.payments?.find((p: any) => p.methodCode === "transfer")?.amount) || getVal('transfer_amount', 6);
      const deferredAmount = toN(draft.payments?.find((p: any) => p.methodCode === "deferred")?.amount) || getVal('deferred_amount', 6);
      
      const expenseTotal = (draft.expenses || []).reduce((s: number, e: any) => s + toN(e.amount), 0);
      
      // cashExpected = الكاش المتوقع في الصندوق (كاش - مصروفات)
      const cashExpected = cashAmount - expenseTotal;
      // cashActual = الكاش الفعلي = مبلغ الكاش المدخل
      const cashActual   = cashAmount;
      
      const payments = [
        { methodId: "cash",     methodCode: "cash",     methodName: "كاش",        amount: cashAmount     },
        { methodId: "network",  methodCode: "network",  methodName: "شبكة",        amount: networkAmount  },
        { methodId: "transfer", methodCode: "transfer", methodName: "تحويل بنكي", amount: transferAmount },
        { methodId: "deferred", methodCode: "deferred", methodName: "آجل",         amount: deferredAmount },
      ].filter(p => p.amount > 0);

      // تاريخ التقرير بتوقيت الرياض (أمس)
      const nowRiyadh = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
      nowRiyadh.setDate(nowRiyadh.getDate() - 1);
      const yy = nowRiyadh.getFullYear();
      const mm = String(nowRiyadh.getMonth() + 1).padStart(2, "0");
      const dd = String(nowRiyadh.getDate()).padStart(2, "0");
      const reportDate = draft.reportDate || `${yy}-${mm}-${dd}`;

      // جمع كل بيانات الخطوات من الـ draft
      const stepData: Record<string, any> = {};
      for (let i = 1; i <= 7; i++) {
        // step named values (e.g. step2Named: { total_sales: "500" })
        if (draft[`step${i}Named`] && Object.keys(draft[`step${i}Named`]).length > 0) {
          stepData[`step${i}Named`] = draft[`step${i}Named`];
        }
        // step raw values (e.g. step2Values: { "uuid": "500" })
        if (draft[`step${i}Values`] && Object.keys(draft[`step${i}Values`]).length > 0) {
          stepData[`step${i}Values`] = draft[`step${i}Values`];
        }
      }

      const submitData = {
        branchId,
        branchSlug: draft.branchSlug || session.branchSlug,
        reportDate,
        totalSales,
        invoiceCount: invoiceCount || null,
        returnsValue,
        cashExpected,
        cashActual,
        payments,
        expenses: draft.expenses || [],
        notes: draft.notes || null,
        requestId: draft.requestId || null,
        // بيانات الخطوات الكاملة - مهم جداً
        ...stepData,
      };

      console.log("[ReviewWithShortage] submitData:", JSON.stringify(submitData));
      console.log("[ReviewWithShortage] totalSales:", totalSales, "cashExpected:", cashExpected, "cashActual:", cashActual);
      console.log("[ReviewWithShortage] stepData keys:", Object.keys(stepData));

      const res = await fetch("/api/reports/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        clearDraft();
        alert("✅ " + result.message);
        router.push(`/branch/${slug}/home`);
      } else {
        throw new Error(result.error || "فشل الإرسال");
      }
    } catch (err: any) {
      alert("❌ حدث خطأ: " + (err.message || "خطأ غير معروف"));
      setSubmitting(false);
    }
  }

  if (!session || !draft || loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-muted">جاري التحميل...</p>
      </div>
    );
  }

  const shortage = calculateShortage();
  const money = calculateMoneyMatch();
  const salesComp = calculateSalesComparison();

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <CashierHeader branchName={session.branchName} step={6} totalSteps={6} stepLabel="المراجعة النهائية" />

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-4">
        <div className="bg-card-hi rounded-xl p-4 border border-line text-center">
          <h2 className="text-cream text-xl font-bold">المراجعة النهائية</h2>
          <p className="text-muted text-sm mt-1">تأكد من صحة جميع البيانات قبل الإرسال</p>
        </div>

        {shortage && (
          <>
            <ShortageCard title="حاشي" data={shortage.hashi} color={getShortageColor(shortage.hashi.shortage, "hashi")} hasBoneClean={true} />
            <ShortageCard title="غنم"  data={shortage.sheep} color={getShortageColor(shortage.sheep.shortage, "sheep")} hasBoneClean={false} />
            <ShortageCard title="عجل"  data={shortage.beef}  color={getShortageColor(shortage.beef.shortage,  "beef")}  hasBoneClean={true} />
          </>
        )}

        {/* ═══ مقارنة المبيعات: الحقيقية vs النظام ═══ */}
        <div className="bg-card rounded-2xl border border-line overflow-hidden">
          <div className="bg-card-hi px-4 py-3 border-b border-line">
            <h3 className="text-cream font-bold text-lg">المبيعات</h3>
          </div>
          <div className="p-4 space-y-3">

            {/* المبيعات الحقيقية (الخطوة 2) */}
            <div>
              <p className="text-xs text-amber font-semibold mb-2">المبيعات الفعلية (من الكاشير)</p>
              <div className="flex justify-between items-center bg-card-hi rounded-xl px-4 py-3">
                <span className="text-muted">إجمالي المبيعات</span>
                <span className="text-cream font-black text-lg">{salesComp.actualSales.toFixed(2)} ر</span>
              </div>
            </div>

            <div className="h-px bg-line" />

            {/* مبيعات النظام (الخطوة 3 - تفاصيل المنتجات) */}
            <div>
              <p className="text-xs text-green font-semibold mb-2 flex items-center gap-1">
                <span>📊</span> مبيعات النظام (تفاصيل المنتجات)
              </p>
              {salesComp.hasData ? (
                <div className="space-y-1.5">
                  {salesComp.hashiAmt > 0 && (
                    <div className="flex justify-between text-sm px-1">
                      <span className="text-amber">🐪 حاشي</span>
                      <span className="text-cream font-bold">{salesComp.hashiAmt.toFixed(2)} ر</span>
                    </div>
                  )}
                  {salesComp.sheepAmt > 0 && (
                    <div className="flex justify-between text-sm px-1">
                      <span className="text-blue-400">🐑 غنم</span>
                      <span className="text-cream font-bold">{salesComp.sheepAmt.toFixed(2)} ر</span>
                    </div>
                  )}
                  {salesComp.beefAmt > 0 && (
                    <div className="flex justify-between text-sm px-1">
                      <span className="text-red-400">🐄 عجل</span>
                      <span className="text-cream font-bold">{salesComp.beefAmt.toFixed(2)} ر</span>
                    </div>
                  )}
                  {salesComp.offalAmt > 0 && (
                    <div className="flex justify-between text-sm px-1">
                      <span className="text-purple-400">🥩 مخلفات</span>
                      <span className="text-cream font-bold">{salesComp.offalAmt.toFixed(2)} ر</span>
                    </div>
                  )}
                  {/* genericMode: أسماء حقول غير معروفة - عرض الإجمالي فقط */}
                  {salesComp.genericMode && (salesComp.hashiAmt + salesComp.sheepAmt + salesComp.beefAmt + salesComp.offalAmt) === 0 && (
                    <div className="flex justify-between text-sm px-1">
                      <span className="text-muted">تفاصيل المبيعات</span>
                      <span className="text-cream font-bold">{salesComp.systemTotal.toFixed(2)} ر</span>
                    </div>
                  )}
                  <div className="h-px bg-line my-1" />
                  <div className="flex justify-between items-center bg-card-hi rounded-xl px-4 py-3">
                    <span className="text-muted">إجمالي مبيعات النظام</span>
                    <span className="text-cream font-black text-lg">{salesComp.systemTotal.toFixed(2)} ر</span>
                  </div>

                  {/* الفرق */}
                  <div className={`text-center rounded-xl py-3 font-bold ${
                    Math.abs(salesComp.diff) < 1 
                      ? "bg-green/10 text-green border border-green/30" 
                      : Math.abs(salesComp.diff) < 100
                      ? "bg-amber/10 text-amber border border-amber/30"
                      : "bg-red/10 text-red-400 border border-red/30"
                  }`}>
                    {Math.abs(salesComp.diff) < 1
                      ? "✅ المبيعات مطابقة"
                      : salesComp.diff > 0
                      ? `📊 النظام أعلى بـ ${salesComp.diff.toFixed(2)} ر`
                      : `⚠️ فرق: ${Math.abs(salesComp.diff).toFixed(2)} ر`}
                  </div>
                </div>
              ) : (
                /* بيانات الخطوة 3 الخام - عرض ما تم إدخاله حتى لو لم تُعرف الفئة */
                (() => {
                  const step3Raw = draft?.step3Named || {};
                  const step3Entries = Object.entries(step3Raw).filter(([, v]) => {
                    const n = Number(v); return Number.isFinite(n) && n > 0;
                  });
                  return step3Entries.length > 0 ? (
                    <div className="space-y-1.5">
                      {step3Entries.map(([key, val]) => (
                        <div key={key} className="flex justify-between text-sm px-1">
                          <span className="text-muted">{key}</span>
                          <span className="text-cream font-bold">{Number(val).toFixed(2)} ر</span>
                        </div>
                      ))}
                      <div className="h-px bg-line my-1" />
                      <div className="flex justify-between items-center bg-card-hi rounded-xl px-4 py-3">
                        <span className="text-muted">المجموع</span>
                        <span className="text-cream font-black">
                          {step3Entries.reduce((s, [, v]) => s + Number(v), 0).toFixed(2)} ر
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-card-hi rounded-xl px-4 py-3 text-center">
                      <p className="text-muted text-sm">لم يتم إدخال تفاصيل المنتجات في الخطوة 3</p>
                      <p className="text-muted text-xs mt-1">({Object.keys(step3Raw).length} حقل في المسودة)</p>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>

        {/* المصروفات */}
        {draft.expenses && draft.expenses.length > 0 && (
          <div className="bg-card rounded-2xl border border-line overflow-hidden">
            <div className="bg-card-hi px-4 py-3 border-b border-line">
              <h3 className="text-cream font-bold text-lg">المصروفات</h3>
            </div>
            <div className="p-4 space-y-2">
              {draft.expenses.map((exp: any) => (
                <div key={exp.id} className="flex justify-between text-sm">
                  <span className="text-muted">{exp.description}</span>
                  <span className="text-cream font-bold">{exp.amount.toFixed(2)} ر</span>
                </div>
              ))}
              <div className="h-px bg-line my-2" />
              <div className="flex justify-between font-bold">
                <span className="text-muted">إجمالي المصروفات:</span>
                <span className="text-red-400">{draft.expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0).toFixed(2)} ر</span>
              </div>
            </div>
          </div>
        )}

        {/* الأموال */}
        <div className="bg-card rounded-2xl border border-line overflow-hidden">
          <div className="bg-card-hi px-4 py-3 border-b border-line">
            <h3 className="text-cream font-bold text-lg">مراجعة الصندوق</h3>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted">إجمالي المبيعات:</span>
              <span className="text-cream font-bold">{money.totalSales.toFixed(2)} ر</span>
            </div>
            <div className="h-px bg-line my-2" />
            <div className="flex justify-between text-sm">
              <span className="text-muted">كاش:</span>
              <span className="text-cream">{money.cash.toFixed(2)} ر</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">شبكة:</span>
              <span className="text-cream">{money.network.toFixed(2)} ر</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">تحويل بنكي:</span>
              <span className="text-cream">{money.transfer.toFixed(2)} ر</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">آجل:</span>
              <span className="text-cream">{money.deferred.toFixed(2)} ر</span>
            </div>
            <div className="h-px bg-line my-2" />
            <div className="flex justify-between font-bold">
              <span className="text-muted">المجموع:</span>
              <span className="text-cream">{money.total.toFixed(2)} ر</span>
            </div>
            <div className={`text-center font-bold text-lg mt-3 ${getMoneyColor(money.difference)}`}>
              {money.isMatch ? "✅ الصندوق مطابق" : `⚠️ فرق: ${money.difference.toFixed(2)} ر`}
            </div>
          </div>
        </div>

        {/* ═══ ملاحظات الخطوات ═══ */}
        {(() => {
          const step4 = draft?.step4Named || {};
          const step5 = draft?.step5Named || {};

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

          const TEXT_FIELDS: { stepObj: Record<string,any>; stepLabel: string; keys: string[] }[] = [
            {
              stepObj: step4, stepLabel: "الصادر",
              keys: ["outgoing_items","offal_to_slaughterhouse","offal to slaughterhouse",
                     "hashi_export_to","sheep_export_to","beef_export_to","notes","additional_notes"],
            },
            {
              stepObj: step5, stepLabel: "المتبقي",
              keys: ["offal_remaining","notes","additional_notes"],
            },
          ];

          const allNotes: { key: string; label: string; step: string; value: string }[] = [];
          TEXT_FIELDS.forEach(({ stepObj, stepLabel, keys }) => {
            keys.forEach(k => {
              const v = stepObj[k];
              if (v && typeof v === "string" && v.trim()) {
                allNotes.push({ key: k, label: FIELD_LABELS[k] ?? k.replace(/_/g," "), step: stepLabel, value: v.trim() });
              }
            });
          });

          // ملاحظات الخطوة 6 محفوظة في draft.notes مباشرة
          if (draft?.notes && typeof draft.notes === "string" && draft.notes.trim()) {
            allNotes.push({ key: "draft_notes", label: "ملاحظات إضافية", step: "المصروفات والملاحظات", value: draft.notes.trim() });
          }

          if (!allNotes.length) return null;
          return (
            <div className="bg-card rounded-2xl border border-line overflow-hidden">
              <div className="bg-card-hi px-4 py-3 border-b border-line">
                <h3 className="text-cream font-bold text-lg">ملاحظات</h3>
              </div>
              <div className="p-4 space-y-3">
                {allNotes.map(n => (
                  <div key={n.key} className="rounded-xl border border-line bg-card-hi p-3">
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

        <div className="flex gap-3 pt-4">
          <button onClick={() => router.push(`/branch/${slug}/report/step-6`)} className="flex-1 bg-card-hi border border-line text-muted rounded-2xl py-4 text-lg font-bold" disabled={submitting}>← السابق</button>
          <button onClick={handleSubmit} disabled={submitting} className="flex-[2] bg-green hover:bg-green-dark text-white rounded-2xl py-4 text-lg font-bold disabled:opacity-50">
            {submitting ? "جاري الإرسال..." : "إرسال التقرير ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortageCard({ title, data, color, hasBoneClean }: any) {
  return (
    <div className="bg-card rounded-2xl border border-line overflow-hidden">
      <div className="bg-card-hi px-4 py-3 border-b border-line"><h3 className="text-cream font-bold text-lg">{title}</h3></div>
      <div className="p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted">رصيد أمس:</span><span className="text-cream">{data.previous.toFixed(2)} كجم</span></div>
        <div className="flex justify-between"><span className="text-muted">وارد اليوم:</span><span className="text-cream">{data.incoming.toFixed(2)} كجم</span></div>
        <div className="flex justify-between"><span className="text-muted">المبيعات:</span><span className="text-cream">{data.sales.toFixed(2)} كجم</span></div>
        <div className="flex justify-between"><span className="text-muted">الصادر:</span><span className="text-cream">{data.outgoing.toFixed(2)} كجم</span></div>
        <div className="flex justify-between"><span className="text-muted">المخلفات:</span><span className="text-cream">{data.offal.toFixed(2)} كجم</span></div>
        <div className="h-px bg-line my-2" />
        <div className="flex justify-between font-bold"><span className="text-muted">المفروض يتبقى:</span><span className="text-cream">{data.expected.toFixed(2)} كجم</span></div>
        <div className="flex justify-between font-bold"><span className="text-muted">المتبقي الفعلي:</span><span className="text-cream">{data.actual.toFixed(2)} كجم</span></div>
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
