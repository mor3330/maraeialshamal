"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CashierHeader from "./CashierHeader";
import DynamicField from "./DynamicField";
import { getDraft, saveDraft, getSession } from "@/lib/report-store";
import { StepField } from "@/types/database";

export default function Step1ClientDynamic({ slug }: { slug: string }) {
  const router = useRouter();
  const [session, setSession] = useState<{ branchName: string } | null>(null);
  const [fields, setFields] = useState<StepField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s || s.branchSlug !== slug) {
      router.replace(`/branch/${slug}`);
      return;
    }
    setSession(s);

    // Load step fields
    fetch("/api/admin/step-fields?step=1")
      .then(r => r.json())
      .then(data => {
        if (data.data) {
          setFields(data.data);
          // Restore draft
          const draft = getDraft();
          if (draft) {
            const v: Record<string, any> = {};
            data.data.forEach((f: StepField) => {
              // Map old draft structure to new field names
              if (f.field_name === "total_sales" && draft.totalSales) v[f.id] = String(draft.totalSales);
              if (f.field_name === "invoice_count" && draft.invoiceCount) v[f.id] = String(draft.invoiceCount);
              if (f.field_name === "returns_value" && draft.returnsValue) v[f.id] = String(draft.returnsValue);
              if (f.field_name === "discounts_value" && draft.discountsValue) v[f.id] = String(draft.discountsValue);
            });
            setValues(v);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        // Fallback to old static component if API fails
        router.replace(`/branch/${slug}/report/step-1`);
      });
  }, [slug, router]);

  function validate() {
    const errs: Record<string, string> = {};
    fields.forEach(field => {
      const v = values[field.id];
      const isEmpty = v === undefined || v === null || v === "";
      if (field.is_required && isEmpty) {
        errs[field.id] = `${field.field_label} مطلوب`;
      }
      // Special validation for numbers
      if (field.field_type === "number" && values[field.id]) {
        if (isNaN(Number(values[field.id])) || Number(values[field.id]) <= 0) {
          errs[field.id] = `أدخل قيمة صحيحة`;
        }
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

    // Extract values for known fields
    const totalSalesField = fields.find(f => f.field_name === "total_sales");
    const invoiceCountField = fields.find(f => f.field_name === "invoice_count");
    const returnsField = fields.find(f => f.field_name === "returns_value");
    const discountsField = fields.find(f => f.field_name === "discounts_value");

    // استخدام التاريخ المطلوب من الإدارة إذا وُجد، وإلا أمس بتوقيت الرياض
    const requestedDate = sessionStorage.getItem('requested_report_date');
    let reportDate: string;
    if (requestedDate) {
      reportDate = requestedDate;
    } else {
      const nowRiyadh = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
      nowRiyadh.setDate(nowRiyadh.getDate() - 1);
      reportDate = `${nowRiyadh.getFullYear()}-${String(nowRiyadh.getMonth() + 1).padStart(2, "0")}-${String(nowRiyadh.getDate()).padStart(2, "0")}`;
    }
    const requestId = sessionStorage.getItem('requested_report_id') || undefined;

    saveDraft({
      branchId: getSession()!.branchId,
      branchName: getSession()!.branchName,
      branchSlug: slug,
      reportDate,
      requestId,
      totalSales: totalSalesField ? Number(values[totalSalesField.id]) : 0,
      invoiceCount: invoiceCountField ? Number(values[invoiceCountField.id]) : undefined,
      returnsValue: returnsField ? Number(values[returnsField.id]) : 0,
      discountsValue: discountsField ? Number(values[discountsField.id]) : 0,
      step1CustomFields: values, // Save all custom field values
    });

    router.push(`/branch/${slug}/report/step-2`);
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
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted mb-4">لا توجد حقول محددة لهذه الخطوة</p>
          <p className="text-cream text-sm">يرجى التواصل مع الإدارة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <CashierHeader
        branchName={session.branchName}
        step={1}
        totalSteps={6}
        stepLabel="المبيعات الإجمالية"
      />

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-4">
        {fields.map(field => (
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
