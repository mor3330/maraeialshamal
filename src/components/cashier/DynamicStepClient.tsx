"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CashierHeader from "./CashierHeader";
import DynamicField from "./DynamicField";
import InvoiceScanner, { ScannedInvoiceData } from "./InvoiceScanner";
import SalesProductScanner from "./SalesProductScanner";
import { getDraft, saveDraft, getSession } from "@/lib/report-store";
import { StepField } from "@/types/database";

interface DynamicStepClientProps {
  slug: string;
  step: number;
  stepLabel: string;
  nextStep?: number;
}

export default function DynamicStepClient({ 
  slug, 
  step, 
  stepLabel,
  nextStep 
}: DynamicStepClientProps) {
  const router = useRouter();
  const [session, setSession] = useState<{ branchName: string } | null>(null);
  const [fields, setFields] = useState<StepField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // ─── حالة بيانات Aronium ───
  const [aroniumData, setAroniumData] = useState<null | {
    found: boolean;
    totalSales: number;
    invoiceCount: number;
    returnsValue: number;
    cashAmount: number;
    networkAmount: number;
    transferAmount: number;
    deferredAmount: number;
    lastSync: string | null;
    syncedInvoices: number;
    hasCategoryData?: boolean;
    byCategory?: Record<string, { qty: number; amount: number }>;
    unclassifiedAmount?: number;
    unclassifiedQty?: number;
  }>(null);
  const [aroniumLoading, setAroniumLoading] = useState(false);
  const [aroniumApplied, setAroniumApplied] = useState(false);
  const [categoryApplied, setCategoryApplied] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s || s.branchSlug !== slug) {
      router.replace(`/branch/${slug}`);
      return;
    }
    setSession(s);

    // Load step fields
    loadFields();

    // ─── تحميل بيانات Aronium تلقائياً للخطوة 2 و 3 ───
    if (step === 2 || step === 3) {
      const reportDate = sessionStorage.getItem("requested_report_date") ?? (() => {
        const riyadh = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
        riyadh.setDate(riyadh.getDate() - 1);
        return `${riyadh.getFullYear()}-${String(riyadh.getMonth() + 1).padStart(2, "0")}-${String(riyadh.getDate()).padStart(2, "0")}`;
      })();
      fetchAroniumData(s.branchId, reportDate);
    }
  }, [slug, step, router]);

  async function fetchAroniumData(branchId: string, date: string) {
    setAroniumLoading(true);
    try {
      const res = await fetch(`/api/pos/branch-sales?branchId=${branchId}&date=${date}`);
      const json = await res.json();
      if (json.found) {
        setAroniumData(json);
      } else {
        setAroniumData(null);
      }
    } catch {
      setAroniumData(null);
    } finally {
      setAroniumLoading(false);
    }
  }

  function applyAroniumData() {
    if (!aroniumData) return;
    handleScannerApply({
      total_sales:     aroniumData.totalSales,
      invoice_count:   aroniumData.invoiceCount,
      returns_value:   aroniumData.returnsValue,
      cash_amount:     aroniumData.cashAmount,
      network_amount:  aroniumData.networkAmount,
      transfer_amount: aroniumData.transferAmount,
      deferred_amount: aroniumData.deferredAmount,
    });
    setAroniumApplied(true);
  }

  /** تطبيق بيانات الفئات على حقول الخطوة 3 - يدعم أسماء حقول متنوعة */
  function applyCategoryData() {
    if (!aroniumData?.byCategory) return;
    const cat = aroniumData.byCategory;

    // كلمات تدل على الكمية/الوزن
    const QTY_KEYWORDS  = ["qty","quantity","weight","kg","kilo","count","num","units","amount_kg"];
    // كلمات تدل على المبلغ/السعر (أو أي شيء آخر افتراضي)
    // const AMT_KEYWORDS  = ["amount","price","total","sales","value","revenue","sum","cost","ريال","sr"];

    setValues(prev => {
      const next = { ...prev };
      fields.forEach(field => {
        const fn = field.field_name.toLowerCase();

        // تحديد الفئة
        let catData: { qty: number; amount: number } | undefined;
        if      (fn.startsWith("hashi_") || fn === "hashi") catData = cat.hashi;
        else if (fn.startsWith("sheep_") || fn === "sheep") catData = cat.sheep;
        else if (fn.startsWith("beef_")  || fn === "beef")  catData = cat.beef;
        else if (fn.startsWith("offal_") || fn === "offal") catData = cat.offal;
        else return; // حقل لا ينتمي لأي فئة

        // تحديد هل هو كمية أم مبلغ
        const isQty = QTY_KEYWORDS.some(k => fn.includes(k));
        next[field.id] = String(isQty ? (catData.qty ?? 0) : (catData.amount ?? 0));
      });
      return next;
    });

    setErrors(prev => {
      const next = { ...prev };
      fields.forEach(field => {
        const fn = field.field_name.toLowerCase();
        if (fn.startsWith("hashi_") || fn.startsWith("sheep_") || fn.startsWith("beef_") || fn.startsWith("offal_")) {
          delete next[field.id];
        }
      });
      return next;
    });
    setCategoryApplied(true);
  }

  async function loadFields() {
    try {
      const res = await fetch(`/api/admin/step-fields?step=${step}`);
      const data = await res.json();
      
      if (data.data) {
        setFields(data.data);
        // Restore draft values
        const draft = getDraft();
        if (draft && (draft as any)[`step${step}Values`]) {
          setValues((draft as any)[`step${step}Values`]);
        }
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  function validate() {
    const errs: Record<string, string> = {};
    fields.forEach(field => {
      const v = values[field.id];
      const isEmpty = v === undefined || v === null || v === "";
      if (field.is_required && isEmpty) {
        errs[field.id] = `${field.field_label} مطلوب`;
      }

      // Number validation
      if (field.field_type === "number" && values[field.id]) {
        if (isNaN(Number(values[field.id])) || Number(values[field.id]) < 0) {
          errs[field.id] = `أدخل قيمة صحيحة`;
        }
      }

      // Checkbox validation
      if (field.field_type === "checkbox" && field.is_required && !values[field.id]) {
        errs[field.id] = `يجب التأكيد`;
      }
    });
    return errs;
  }

  function handleNext() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Save values to draft
    // استخدام التاريخ المطلوب من sessionStorage أو حساب أمس
    let reportDate: string;
    const requestedDate = typeof window !== 'undefined' ? sessionStorage.getItem('requested_report_date') : null;
    const requestId = typeof window !== 'undefined' ? sessionStorage.getItem('requested_report_id') : null;
    
    if (requestedDate) {
      reportDate = requestedDate;
    } else {
      const riyadhYest = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
      riyadhYest.setDate(riyadhYest.getDate() - 1);
      const ry = riyadhYest.getFullYear();
      const rm = String(riyadhYest.getMonth() + 1).padStart(2, "0");
      const rd = String(riyadhYest.getDate()).padStart(2, "0");
      reportDate = `${ry}-${rm}-${rd}`;
    }
    
    const draft = getDraft() || {
      branchId: getSession()!.branchId,
      branchName: getSession()!.branchName,
      branchSlug: slug,
      reportDate,
      requestId: requestId || undefined,
    };

    // بناء mapping من field_name إلى القيمة
    const namedValues: Record<string, any> = {};
    fields.forEach(field => {
      // حفظ كل القيم حتى لو كانت 0 أو فارغة (ما عدا undefined)
      if (values[field.id] !== undefined) {
        namedValues[field.field_name] = values[field.id];
      }
    });

    // استخراج الحقول المعروفة مباشرة إلى ReportDraft
    const toN = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const knownFields: Record<string, any> = {};
    if (namedValues.total_sales !== undefined)   knownFields.totalSales    = toN(namedValues.total_sales);
    if (namedValues.invoice_count !== undefined) knownFields.invoiceCount  = toN(namedValues.invoice_count);
    if (namedValues.returns_value !== undefined) knownFields.returnsValue  = toN(namedValues.returns_value);
    if (namedValues.cash_amount !== undefined) {
      const cash     = toN(namedValues.cash_amount);
      const network  = toN(namedValues.network_amount);
      const transfer = toN(namedValues.transfer_amount);
      const deferred = toN(namedValues.deferred_amount);
      knownFields.cashActual   = cash;
      knownFields.cashExpected = cash;
      knownFields.payments = [
        { methodId: "cash",     methodName: "كاش",        methodCode: "cash",     amount: cash     },
        { methodId: "network",  methodName: "شبكة",        methodCode: "network",  amount: network  },
        { methodId: "transfer", methodName: "تحويل بنكي", methodCode: "transfer", amount: transfer },
        { methodId: "deferred", methodName: "آجل",         methodCode: "deferred", amount: deferred },
      ].filter(p => p.amount > 0);
    }

    // تسجيل للتشخيص
    console.log(`[DynamicStepClient] Step ${step} saving:`, {
      namedValues,
      knownFields,
      fieldsCount: fields.length,
      valuesCount: Object.keys(values).length,
    });

    const saved = saveDraft({
      ...draft,
      ...knownFields,
      [`step${step}Values`]: values,
      [`step${step}Named`]: namedValues,
    } as any);

    // التحقق من أن الحفظ تم بنجاح
    const verify = getDraft();
    console.log(`[DynamicStepClient] Step ${step} saved. Verify draft keys:`, verify ? Object.keys(verify) : "NULL");
    console.log(`[DynamicStepClient] step${step}Named in draft:`, verify ? (verify as any)[`step${step}Named`] : "missing");

    // Navigate to next step or review
    if (nextStep) {
      router.push(`/branch/${slug}/report/step-${nextStep}`);
    } else {
      router.push(`/branch/${slug}/report/review`);
    }
  }

  /** عند تطبيق بيانات الفاتورة المقروءة - يربط القيم بمعرّفات الحقول */
  function handleScannerApply(data: ScannedInvoiceData) {
    const mapping: Record<string, number> = {
      total_sales: data.total_sales,
      cash_amount: data.cash_amount,
      network_amount: data.network_amount,
      transfer_amount: data.transfer_amount,
      deferred_amount: data.deferred_amount,
      invoice_count: data.invoice_count,
      returns_value: data.returns_value,
    };

    setValues(prev => {
      const next = { ...prev };
      fields.forEach(field => {
        const scannedVal = mapping[field.field_name];
        // نضع القيمة حتى لو كانت 0 (التحويل والآجل يساوي 0 أحياناً)
        if (scannedVal !== undefined && scannedVal >= 0) {
          next[field.id] = String(scannedVal);
        }
      });
      return next;
    });

    // امسح أخطاء الحقول التي تم تعبئتها
    setErrors(prev => {
      const next = { ...prev };
      fields.forEach(field => {
        if (mapping[field.field_name] !== undefined) {
          delete next[field.id];
        }
      });
      return next;
    });
  }

  /** عند تطبيق بيانات تقرير المبيعات حسب المنتج - مباشرة من Record<fieldId, value> */
  function handleSalesProductApply(fieldValues: Record<string, string>) {
    setValues(prev => {
      const next = { ...prev };
      for (const [fieldId, val] of Object.entries(fieldValues)) {
        next[fieldId] = val;
      }
      return next;
    });
    // امسح الأخطاء للحقول المُعبّاة
    setErrors(prev => {
      const next = { ...prev };
      for (const fieldId of Object.keys(fieldValues)) {
        delete next[fieldId];
      }
      return next;
    });
  }

  function handleBack() {
    if (step > 1) {
      router.push(`/branch/${slug}/report/step-${step - 1}`);
    } else {
      router.push(`/branch/${slug}/home`);
    }
  }

  function getStepDescription(stepNum: number): string {
    const descriptions: Record<number, string> = {
      1: "📦 الوارد اليومي",
      2: "💰 المبيعات",
      3: "📊 تفاصيل المبيعات",
      4: "📤 الصادر",
      5: "❄️ المتبقي في الثلاجة",
      6: "💵 الأموال",
      7: "✅ المراجعة النهائية",
    };
    return descriptions[stepNum] || stepLabel;
  }

  /** حقول الخزينة (طرق الدفع) */
  const TREASURY_FIELD_NAMES = [
    "cash_amount",
    "network_amount",
    "transfer_amount",
    "deferred_amount",
  ];

  function renderGroupedFields() {
    // تصنيف الحقول
    const grouped: Record<string, typeof fields> = {};
    const treasury: typeof fields = [];
    const ungrouped: typeof fields = [];

    fields.forEach(field => {
      if (field.field_name.startsWith('hashi_')) {
        if (!grouped['hashi']) grouped['hashi'] = [];
        grouped['hashi'].push(field);
      } else if (field.field_name.startsWith('sheep_')) {
        if (!grouped['sheep']) grouped['sheep'] = [];
        grouped['sheep'].push(field);
      } else if (field.field_name.startsWith('beef_')) {
        if (!grouped['beef']) grouped['beef'] = [];
        grouped['beef'].push(field);
      } else if (field.field_name.startsWith('offal_')) {
        if (!grouped['offal']) grouped['offal'] = [];
        grouped['offal'].push(field);
      } else if (TREASURY_FIELD_NAMES.includes(field.field_name)) {
        // حقول الخزينة → مربع منفصل
        treasury.push(field);
      } else {
        ungrouped.push(field);
      }
    });

    const groupTitles: Record<string, string> = {
      hashi: '🐪 حاشي',
      sheep: '🐑 غنم',
      beef: '🐄 عجل',
      offal: '🥩 مخلفات',
    };

    const treasuryLabels: Record<string, string> = {
      cash_amount:     "💵 كاش",
      network_amount:  "💳 شبكة",
      transfer_amount: "🏦 تحويل بنكي",
      deferred_amount: "📋 آجل",
    };

    return (
      <>
        {/* Ungrouped fields (إجمالي المبيعات، عدد الفواتير، إلخ) */}
        {ungrouped.map(field => (
          <DynamicField
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(val) => {
              setValues(v => ({ ...v, [field.id]: val }));
              setErrors(e => ({ ...e, [field.id]: "" }));
            }}
            error={errors[field.id]}
          />
        ))}

        {/* ═══ مربع الخزينة ═══ */}
        {treasury.length > 0 && (
          <div className="bg-card rounded-2xl border border-amber/30 overflow-hidden">
            <div className="bg-amber/10 px-4 py-3 border-b border-amber/20 flex items-center gap-2">
              <span className="text-xl">🏦</span>
              <h3 className="text-amber font-bold text-lg">الخزينة</h3>
              <span className="text-muted text-xs mr-auto">طرق الدفع</span>
            </div>
            <div className="p-4 space-y-3">
              {treasury
                .sort((a, b) => {
                  // رتّبها: كاش → شبكة → تحويل → آجل
                  const order = TREASURY_FIELD_NAMES;
                  return order.indexOf(a.field_name) - order.indexOf(b.field_name);
                })
                .map(field => (
                  <div key={field.id}>
                    {/* عنوان مخصص للخزينة */}
                    {treasuryLabels[field.field_name] && (
                      <p className="text-xs text-amber font-semibold mb-1 mr-1">
                        {treasuryLabels[field.field_name]}
                      </p>
                    )}
                    <DynamicField
                      field={field}
                      value={values[field.id]}
                      onChange={(val) => {
                        setValues(v => ({ ...v, [field.id]: val }));
                        setErrors(e => ({ ...e, [field.id]: "" }));
                      }}
                      error={errors[field.id]}
                    />
                  </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ مربعات فئات اللحوم ═══ */}
        {Object.entries(grouped).map(([group, groupFields]) => {
          const exportToField = groupFields.find(f => f.field_name === `${group}_export_to`);
          const regularFields = groupFields.filter(f => f.field_name !== `${group}_export_to`);
          return (
            <div key={group} className="bg-card rounded-2xl border border-line overflow-hidden">
              <div className="bg-card-hi px-4 py-3 border-b border-line">
                <h3 className="text-cream font-bold text-lg">{groupTitles[group]}</h3>
              </div>
              <div className="p-4 space-y-3">
                {regularFields.map(field => (
                  <DynamicField
                    key={field.id}
                    field={field}
                    value={values[field.id]}
                    onChange={(val) => {
                      setValues(v => ({ ...v, [field.id]: val }));
                      setErrors(e => ({ ...e, [field.id]: "" }));
                    }}
                    error={errors[field.id]}
                  />
                ))}
                {exportToField && (
                  <div className="mt-2 rounded-xl border border-amber/30 bg-amber/5 p-3">
                    <p className="text-amber text-xs font-semibold mb-2">وجهة الصادر</p>
                    <input
                      type="text"
                      placeholder={exportToField.placeholder ?? "مثال: فرع النخيل، مستودع الرياض..."}
                      value={(values[exportToField.id] as string) ?? ""}
                      onChange={e => {
                        setValues(v => ({ ...v, [exportToField.id]: e.target.value }));
                        setErrors(er => ({ ...er, [exportToField.id]: "" }));
                      }}
                      className="w-full bg-bg border border-amber/30 rounded-xl px-4 py-3 text-cream text-sm placeholder:text-muted/50 focus:outline-none focus:border-amber/60"
                    />
                    {errors[exportToField.id] && (
                      <p className="text-red text-xs mt-1">{errors[exportToField.id]}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </>
    );
  }

  if (!session || loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-muted">جاري التحميل...</p>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted mb-4">لا توجد حقول محددة لهذه الخطوة</p>
          <button
            onClick={handleBack}
            className="text-green hover:text-green-dark transition-colors"
          >
            ← العودة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <CashierHeader
        branchName={session.branchName}
        step={step}
        totalSteps={5}
        stepLabel={stepLabel}
      />

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6">
        {/* Step Description */}
        <div className="bg-card-hi rounded-xl p-4 border border-line">
          <h2 className="text-cream text-lg font-bold text-center">
            {getStepDescription(step)}
          </h2>
        </div>

        {/* ═══ بانر Aronium POS - تعبئة تلقائية ═══ */}
        {step === 2 && (
          <>
            {aroniumLoading && (
              <div className="rounded-2xl border border-green/20 bg-green/5 px-4 py-3 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-green border-t-transparent animate-spin flex-shrink-0" />
                <p className="text-green text-sm">جاري جلب بيانات Aronium...</p>
              </div>
            )}

            {!aroniumLoading && aroniumData && !aroniumApplied && (
              <div className="rounded-2xl border border-green/30 bg-green/5 overflow-hidden">
                <div className="bg-green/10 px-4 py-3 border-b border-green/20 flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <h3 className="text-green font-bold text-sm">بيانات Aronium متاحة</h3>
                  <span className="text-muted text-xs mr-auto">تعبئة تلقائية</span>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="rounded-xl bg-bg border border-line p-3 text-center">
                      <p className="text-muted text-xs mb-1">إجمالي المبيعات</p>
                      <p className="text-cream font-bold ltr-num" dir="ltr">
                        {aroniumData.totalSales.toLocaleString("ar-SA-u-nu-latn")}
                      </p>
                      <p className="text-muted text-xs">ريال</p>
                    </div>
                    <div className="rounded-xl bg-bg border border-line p-3 text-center">
                      <p className="text-muted text-xs mb-1">عدد الفواتير</p>
                      <p className="text-cream font-bold ltr-num" dir="ltr">
                        {aroniumData.invoiceCount}
                      </p>
                      <p className="text-muted text-xs">فاتورة</p>
                    </div>
                    <div className="rounded-xl bg-green/5 border border-green/10 p-3 text-center">
                      <p className="text-muted text-xs mb-1">💵 كاش</p>
                      <p className="text-green font-bold text-sm ltr-num" dir="ltr">
                        {aroniumData.cashAmount.toLocaleString("ar-SA-u-nu-latn")}
                      </p>
                    </div>
                    <div className="rounded-xl bg-sky-500/5 border border-sky-500/10 p-3 text-center">
                      <p className="text-muted text-xs mb-1">💳 شبكة</p>
                      <p className="text-sky-300 font-bold text-sm ltr-num" dir="ltr">
                        {aroniumData.networkAmount.toLocaleString("ar-SA-u-nu-latn")}
                      </p>
                    </div>
                    {aroniumData.transferAmount > 0 && (
                      <div className="rounded-xl bg-purple-500/5 border border-purple-500/10 p-3 text-center">
                        <p className="text-muted text-xs mb-1">🏦 تحويل</p>
                        <p className="text-purple-300 font-bold text-sm ltr-num" dir="ltr">
                          {aroniumData.transferAmount.toLocaleString("ar-SA-u-nu-latn")}
                        </p>
                      </div>
                    )}
                    {aroniumData.deferredAmount > 0 && (
                      <div className="rounded-xl bg-amber/5 border border-amber/10 p-3 text-center">
                        <p className="text-muted text-xs mb-1">📋 آجل</p>
                        <p className="text-amber font-bold text-sm ltr-num" dir="ltr">
                          {aroniumData.deferredAmount.toLocaleString("ar-SA-u-nu-latn")}
                        </p>
                      </div>
                    )}
                  </div>
                  {aroniumData.lastSync && (
                    <p className="text-muted text-xs text-center mb-3">
                      آخر مزامنة: {new Date(aroniumData.lastSync).toLocaleTimeString("ar-SA-u-nu-latn")}
                    </p>
                  )}
                  <button
                    onClick={applyAroniumData}
                    className="w-full bg-green hover:bg-green-dark text-white rounded-xl py-3 font-bold text-sm transition-colors active:scale-[0.98]"
                  >
                    ✓ تطبيق البيانات تلقائياً
                  </button>
                </div>
              </div>
            )}

            {!aroniumLoading && aroniumApplied && (
              <div className="rounded-2xl border border-green/30 bg-green/10 px-4 py-3 flex items-center gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-green font-bold text-sm">تم تطبيق بيانات Aronium</p>
                  <p className="text-muted text-xs">تحقق من الأرقام أدناه قبل المتابعة</p>
                </div>
                <button
                  onClick={() => { setAroniumApplied(false); applyAroniumData(); }}
                  className="mr-auto text-muted text-xs hover:text-cream transition-colors"
                >
                  إعادة تطبيق
                </button>
              </div>
            )}
          </>
        )}

        {/* ═══ بانر Aronium POS - الخطوة 3: فئات المنتجات ═══ */}
        {step === 3 && (
          <>
            {aroniumLoading && (
              <div className="rounded-2xl border border-blue-400/20 bg-blue-400/5 px-4 py-3 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" />
                <p className="text-blue-300 text-sm">جاري جلب بيانات أصناف Aronium...</p>
              </div>
            )}

            {!aroniumLoading && aroniumData && aroniumData.hasCategoryData && !categoryApplied && (
              <div className="rounded-2xl border border-blue-400/30 bg-blue-400/5 overflow-hidden">
                <div className="bg-blue-400/10 px-4 py-3 border-b border-blue-400/20 flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <h3 className="text-blue-300 font-bold text-sm">تفاصيل المبيعات من Aronium</h3>
                  <span className="text-muted text-xs mr-auto">تعبئة تلقائية</span>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { key: "hashi", icon: "🐪", label: "حاشي",   color: "text-amber"       },
                      { key: "sheep", icon: "🐑", label: "غنم",    color: "text-blue-300"    },
                      { key: "beef",  icon: "🐄", label: "عجل",    color: "text-red-300"     },
                      { key: "offal", icon: "🥩", label: "مخلفات", color: "text-purple-300"  },
                    ].map(c => {
                      const d = aroniumData.byCategory?.[c.key];
                      if (!d || (d.amount === 0 && d.qty === 0)) return null;
                      return (
                        <div key={c.key} className="rounded-xl bg-bg border border-line p-3 text-center">
                          <p className="text-lg mb-0.5">{c.icon}</p>
                          <p className="text-muted text-xs">{c.label}</p>
                          <p className={`font-bold text-sm ltr-num ${c.color}`} dir="ltr">
                            {d.amount.toLocaleString("ar-SA-u-nu-latn")} ر.س
                          </p>
                          <p className="text-muted text-xs">{d.qty} كغ</p>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={applyCategoryData}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-3 font-bold text-sm transition-colors active:scale-[0.98]"
                  >
                    ✓ تعبئة الفئات تلقائياً
                  </button>
                </div>
              </div>
            )}

            {/* تنبيه: منتجات غير مصنفة */}
            {!aroniumLoading && aroniumData && (aroniumData.unclassifiedAmount ?? 0) > 0 && (
              <div className="rounded-2xl border border-orange-400/30 bg-orange-400/5 px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg flex-shrink-0">⚠️</span>
                  <div className="flex-1">
                    <p className="text-orange-300 text-sm font-bold">
                      منتجات غير مصنفة: {(aroniumData.unclassifiedAmount ?? 0).toLocaleString("ar-SA-u-nu-latn")} ر.س
                    </p>
                    <p className="text-muted text-xs mt-1">
                      يوجد مبيعات لم تُصنَّف بعد — صنّفها من لوحة الإدارة حتى تُضاف للفئات الصحيحة
                    </p>
                    <a
                      href="/dashboard/products"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs text-orange-300 underline hover:text-orange-200"
                    >
                      ← اذهب لتصنيف المنتجات
                    </a>
                  </div>
                </div>
              </div>
            )}

            {!aroniumLoading && aroniumData && !aroniumData.hasCategoryData && (
              <div className="rounded-2xl border border-amber/20 bg-amber/5 px-4 py-3">
                <p className="text-amber text-sm font-semibold">⚠️ لا توجد بيانات أصناف</p>
                <p className="text-muted text-xs mt-1">
                  صنّف المنتجات من لوحة الإدارة ← تصنيف المنتجات حتى تتمكن من التعبئة التلقائية
                </p>
              </div>
            )}

            {!aroniumLoading && categoryApplied && (
              <div className="rounded-2xl border border-blue-400/30 bg-blue-400/10 px-4 py-3 flex items-center gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-blue-300 font-bold text-sm">تم تعبئة فئات المنتجات</p>
                  <p className="text-muted text-xs">تحقق من الأرقام أدناه</p>
                </div>
                <button
                  onClick={() => { setCategoryApplied(false); applyCategoryData(); }}
                  className="mr-auto text-muted text-xs hover:text-cream transition-colors"
                >
                  إعادة تطبيق
                </button>
              </div>
            )}
          </>
        )}

        {/* قارئ الفاتورة الذكي - للمبيعات الإجمالية والمدفوعات */}
        <InvoiceScanner
          availableFields={fields.map(f => f.field_name)}
          onApply={handleScannerApply}
        />

        {/* قارئ تقرير المبيعات حسب المنتج - للخطوات التي تحتوي حقول hashi_/sheep_/beef_/offal_ */}
        <SalesProductScanner
          step={step}
          fields={fields}
          onApply={handleSalesProductApply}
        />

        {/* Grouped Fields */}
        {renderGroupedFields()}


        {/* Navigation Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleBack}
            className="flex-1 bg-card-hi border border-line text-muted rounded-2xl py-4 text-lg font-bold transition-colors hover:text-cream active:scale-[0.98]"
          >
            ← السابق
          </button>
          <button
            onClick={handleNext}
            className="flex-[2] bg-green hover:bg-green-dark text-white rounded-2xl py-4 text-lg font-bold transition-colors active:scale-[0.98]"
          >
            {nextStep ? `التالي →` : `المراجعة →`}
          </button>
        </div>
      </div>
    </div>
  );
}
