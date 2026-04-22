"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import CashierHeader from "./CashierHeader";
import { getDraft, saveDraft, getSession } from "@/lib/report-store";

export default function Step1Client({ slug }: { slug: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<{ branchName: string } | null>(null);

  const [totalSales, setTotalSales] = useState("");
  const [invoiceCount, setInvoiceCount] = useState("");
  const [returnsValue, setReturnsValue] = useState("");
  const [discountsValue, setDiscountsValue] = useState("");
  const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const s = getSession();
    if (!s || s.branchSlug !== slug) {
      router.replace(`/branch/${slug}`);
      return;
    }
    setSession(s);

    // Restore draft
    const draft = getDraft();
    if (draft) {
      if (draft.totalSales) setTotalSales(String(draft.totalSales));
      if (draft.invoiceCount) setInvoiceCount(String(draft.invoiceCount));
      if (draft.returnsValue) setReturnsValue(String(draft.returnsValue));
      if (draft.discountsValue) setDiscountsValue(String(draft.discountsValue));
    }

    
  }, [slug, router]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!totalSales || isNaN(Number(totalSales)) || Number(totalSales) <= 0) {
      errs.totalSales = "أدخل إجمالي المبيعات";
    }
    return errs;
  }

  function handleNext() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // استخدام التاريخ المطلوب من الإدارة إذا وُجد، وإلا أمس بتوقيت الرياض
    const requestedDate = sessionStorage.getItem('requested_report_date');
    const reportDate = requestedDate || (() => {
      const riyad = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
      riyad.setDate(riyad.getDate() - 1);
      return `${riyad.getFullYear()}-${String(riyad.getMonth() + 1).padStart(2, "0")}-${String(riyad.getDate()).padStart(2, "0")}`;
    })();
    const requestId = sessionStorage.getItem('requested_report_id') || undefined;

    saveDraft({
      branchId: getSession()!.branchId,
      branchName: getSession()!.branchName,
      branchSlug: slug,
      reportDate,
      requestId,
      totalSales: Number(totalSales),
      invoiceCount: invoiceCount ? Number(invoiceCount) : undefined,
      returnsValue: returnsValue ? Number(returnsValue) : 0,
      discountsValue: discountsValue ? Number(discountsValue) : 0,
    });

    router.push(`/branch/${slug}/report/step-2`);
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <CashierHeader
        branchName={session.branchName}
        step={1}
        totalSteps={6}
        stepLabel="المبيعات الإجمالية"
      />

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-4">

        {/* PDF Upload */}
        <div className="bg-card rounded-2xl p-5 border border-line">
          <p className="text-cream font-semibold mb-1">تقرير المبيعات PDF</p>
          <p className="text-muted text-xs mb-3">أو صورة · أو أي ملف (اختياري)</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          {fileName ? (
            <div className="bg-card-hi rounded-xl p-4 border border-green/30">
              <p className="text-green text-sm font-medium mb-1">✓ تم الإرفاق</p>
              <p className="text-muted text-xs">{fileName}</p>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-line rounded-xl p-6 text-center hover:border-green/40 transition-colors"
            >
              <p className="text-4xl mb-2">📎</p>
              <p className="text-muted text-sm">اضغط لإرفاق ملف</p>
            </button>
          )}
          {fileName && (
            <button
              onClick={() => { setFileName(""); if (fileRef.current) fileRef.current.value = ""; }}
              className="mt-2 text-muted text-xs underline"
            >
              إزالة الملف
            </button>
          )}
          
        </div>

        {/* Total Sales */}
        <div className="bg-card rounded-2xl p-5 border border-line">
          <p className="text-cream font-semibold mb-1">إجمالي المبيعات</p>
          <p className="text-muted text-xs mb-3">بالريال السعودي</p>
          <input
            type="number"
            inputMode="numeric"
            value={totalSales}
            onChange={(e) => { setTotalSales(e.target.value); setErrors({}); }}
            placeholder="0"
            className={`w-full bg-card-hi text-cream rounded-xl px-4 py-4 text-3xl font-black ltr-num border outline-none transition-colors
              ${errors.totalSales ? "border-red" : "border-line focus:border-green"}`}
            dir="ltr"
          />
          {errors.totalSales && (
            <p className="text-red text-xs mt-2">{errors.totalSales}</p>
          )}
        </div>

        {/* Optional fields */}
        <div className="bg-card rounded-2xl p-5 border border-line space-y-4">
          <p className="text-cream font-semibold">تفاصيل إضافية (اختياري)</p>

          <div>
            <p className="text-muted text-xs mb-2">عدد الفواتير</p>
            <input
              type="number"
              inputMode="numeric"
              value={invoiceCount}
              onChange={(e) => setInvoiceCount(e.target.value)}
              placeholder="0"
              className="w-full bg-card-hi text-cream rounded-xl px-4 py-3 text-xl font-bold ltr-num border border-line focus:border-green outline-none"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted text-xs mb-2">المرتجعات (ر.س)</p>
              <input
                type="number"
                inputMode="numeric"
                value={returnsValue}
                onChange={(e) => setReturnsValue(e.target.value)}
                placeholder="0"
                className="w-full bg-card-hi text-cream rounded-xl px-3 py-3 text-lg font-bold ltr-num border border-line focus:border-green outline-none"
                dir="ltr"
              />
            </div>
            <div>
              <p className="text-muted text-xs mb-2">الخصومات (ر.س)</p>
              <input
                type="number"
                inputMode="numeric"
                value={discountsValue}
                onChange={(e) => setDiscountsValue(e.target.value)}
                placeholder="0"
                className="w-full bg-card-hi text-cream rounded-xl px-3 py-3 text-lg font-bold ltr-num border border-line focus:border-green outline-none"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          className="w-full bg-green hover:bg-green-dark text-white rounded-2xl py-4 text-lg font-bold transition-colors active:scale-[0.98]"
        >
          التالي ← طرق الدفع
        </button>
      </div>
    </div>
  );
}
