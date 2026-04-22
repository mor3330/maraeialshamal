"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CashierHeader from "./CashierHeader";
import {
  clearDraft,
  getDraft,
  getSession,
  type ReportDraft,
} from "@/lib/report-store";

function formatAmount(value: number) {
  return value.toLocaleString("ar-SA-u-nu-latn", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function buildReportNotes(draft: ReportDraft, cashDifference: number) {
  const notes: string[] = [];

  if (Math.abs(cashDifference) >= 0.01) {
    notes.push(
      `Cash difference: ${cashDifference > 0 ? "+" : ""}${cashDifference.toFixed(2)} SAR`
    );
  }

  draft.inventory
    ?.filter((item) => Math.abs(item.shortage ?? 0) >= 0.01)
    .forEach((item) => {
      notes.push(`Inventory variance - ${item.meatTypeName}: ${(item.shortage ?? 0).toFixed(1)} kg`);
    });

  return notes.join(" | ");
}

export default function Step6Client({ slug }: { slug: string }) {
  const router = useRouter();
  const [session, setSession] = useState<{ branchName: string } | null>(null);
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [submittedStatus, setSubmittedStatus] = useState<"submitted" | "flagged" | null>(null);

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession || currentSession.branchSlug !== slug) {
      router.replace(`/branch/${slug}`);
      return;
    }

    const currentDraft = getDraft();
    if (!currentDraft?.inventory) {
      router.replace(`/branch/${slug}/report/step-4`);
      return;
    }

    if (currentDraft.cashActual === undefined) {
      router.replace(`/branch/${slug}/report/step-5`);
      return;
    }

    setSession(currentSession);
    setDraft(currentDraft);
  }, [router, slug]);

  if (!session || !draft) {
    return null;
  }

  const payments = draft.payments ?? [];
  const expenses = draft.expenses ?? [];
  const inventory = draft.inventory ?? [];
  const meatSales = draft.meatSales ?? [];

  const paymentsTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const cashPayment = payments.find((payment) => payment.methodCode === "cash")?.amount ?? 0;
  const cashExpected = draft.cashExpected ?? cashPayment - expenseTotal;
  const cashActual = draft.cashActual ?? 0;
  const cashDifference = cashActual - cashExpected;
  const inventoryAlerts = inventory.filter((item) => Math.abs(item.shortage ?? 0) >= 0.01);
  const reportStatus: "submitted" | "flagged" =
    Math.abs(cashDifference) >= 0.01 || inventoryAlerts.length > 0 ? "flagged" : "submitted";

  async function handleSubmit() {
    if (submitting || !draft) {
      return;
    }

    const currentDraft = draft;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report: {
            branchId: currentDraft.branchId,
            reportDate: currentDraft.reportDate,
            totalSales: currentDraft.totalSales,
            invoiceCount: currentDraft.invoiceCount,
            returnsValue: currentDraft.returnsValue,
            discountsValue: currentDraft.discountsValue,
            cashExpected,
            cashActual,
            salesPdfUrl: currentDraft.salesPdfUrl,
            status: reportStatus,
            notes: buildReportNotes(currentDraft, cashDifference),
          },
          payments,
          meatSales,
          inventory,
          expenses,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "تعذر إرسال التقرير.");
      }

      clearDraft();
      setSubmittedId(result.data?.id ?? null);
      setSubmittedStatus(reportStatus);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "تعذر إرسال التقرير.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedId) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <CashierHeader
          branchName={session.branchName}
          step={6}
          totalSteps={6}
          stepLabel="تم الإرسال"
        />

        <div className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
          <div className="bg-card rounded-3xl border border-line p-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-green/10 border border-green/20 text-green text-3xl mx-auto flex items-center justify-center">
              ✓
            </div>
            <div>
              <h2 className="text-2xl font-bold text-cream">تم إرسال التقرير</h2>
              <p className="text-muted text-sm mt-2">
                رقم التقرير: <span dir="ltr">{submittedId.slice(0, 8)}</span>
              </p>
              <p className="text-muted text-sm mt-1">
                الحالة: {submittedStatus === "flagged" ? "مرفوع مع ملاحظات" : "مكتمل وجاهز للمراجعة"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-card-hi rounded-2xl border border-line p-4">
                <p className="text-muted text-xs mb-1">إجمالي المبيعات</p>
                <p className="text-cream font-black text-xl ltr-num" dir="ltr">
                  {formatAmount(draft.totalSales ?? 0)}
                </p>
              </div>
              <div className="bg-card-hi rounded-2xl border border-line p-4">
                <p className="text-muted text-xs mb-1">فرق الكاش</p>
                <p
                  className={`font-black text-xl ltr-num ${
                    Math.abs(cashDifference) >= 0.01 ? "text-red" : "text-green"
                  }`}
                  dir="ltr"
                >
                  {formatAmount(Math.abs(cashDifference))}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/branch/${slug}/report/step-1`)}
                className="flex-1 bg-green hover:bg-green-dark text-white rounded-2xl py-4 font-bold transition-colors"
              >
                تقرير جديد
              </button>
              <button
                onClick={() => router.push(`/branch/${slug}`)}
                className="flex-1 bg-card-hi text-cream rounded-2xl py-4 font-medium border border-line"
              >
                العودة للفرع
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <CashierHeader
        branchName={session.branchName}
        step={6}
        totalSteps={6}
        stepLabel="المراجعة والإرسال"
      />

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-4">
        <div className="bg-card rounded-2xl p-5 border border-line">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-cream font-semibold">جاهز للإرسال</p>
              <p className="text-muted text-xs mt-1">
                راجع الأرقام الأساسية ثم أرسل التقرير النهائي للإدارة
              </p>
            </div>
            <span
              className={`text-xs px-3 py-1 rounded-full border ${
                reportStatus === "flagged"
                  ? "text-amber border-amber/20 bg-amber/10"
                  : "text-green border-green/20 bg-green/10"
              }`}
            >
              {reportStatus === "flagged" ? "يحتاج مراجعة" : "سليم"}
            </span>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-line space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-cream font-semibold">المبيعات</p>
            <span className="text-muted text-xs">{draft.reportDate}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card-hi rounded-xl p-3 border border-line">
              <p className="text-muted text-xs mb-1">إجمالي المبيعات</p>
              <p className="text-cream text-xl font-black ltr-num" dir="ltr">
                {formatAmount(draft.totalSales ?? 0)}
              </p>
            </div>
            <div className="bg-card-hi rounded-xl p-3 border border-line">
              <p className="text-muted text-xs mb-1">عدد الفواتير</p>
              <p className="text-cream text-xl font-black ltr-num" dir="ltr">
                {formatAmount(draft.invoiceCount ?? 0)}
              </p>
            </div>
            <div className="bg-card-hi rounded-xl p-3 border border-line">
              <p className="text-muted text-xs mb-1">المرتجعات</p>
              <p className="text-red text-xl font-black ltr-num" dir="ltr">
                {formatAmount(draft.returnsValue ?? 0)}
              </p>
            </div>
            <div className="bg-card-hi rounded-xl p-3 border border-line">
              <p className="text-muted text-xs mb-1">الخصومات</p>
              <p className="text-amber text-xl font-black ltr-num" dir="ltr">
                {formatAmount(draft.discountsValue ?? 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-line space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-cream font-semibold">طرق الدفع</p>
            <span className="text-muted text-xs">الإجمالي {formatAmount(paymentsTotal)}</span>
          </div>
          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.methodId}
                className="bg-card-hi rounded-xl px-4 py-3 border border-line flex items-center justify-between"
              >
                <span className="text-muted text-sm">{payment.methodName}</span>
                <span className="text-cream font-bold ltr-num" dir="ltr">
                  {formatAmount(payment.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-line space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-cream font-semibold">مبيعات اللحوم</p>
            <span className="text-muted text-xs">{meatSales.length} أصناف</span>
          </div>
          <div className="space-y-2">
            {meatSales.map((item) => (
              <div
                key={item.meatTypeId}
                className="bg-card-hi rounded-xl px-4 py-3 border border-line flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-cream text-sm font-medium">{item.meatTypeName}</p>
                  <p className="text-muted text-xs mt-1">
                    {item.hasCount ? `العدد ${formatAmount(item.count)} • ` : ""}
                    {formatAmount(item.weightKg)} كجم
                  </p>
                </div>
                <span className="text-muted text-xs">{item.category}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-line space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-cream font-semibold">الكاش والمصروفات</p>
            <span className="text-muted text-xs">{expenses.length} مصروفات</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card-hi rounded-xl p-3 border border-line">
              <p className="text-muted text-xs mb-1">كاش المبيعات</p>
              <p className="text-cream font-black text-xl ltr-num" dir="ltr">
                {formatAmount(cashPayment)}
              </p>
            </div>
            <div className="bg-card-hi rounded-xl p-3 border border-line">
              <p className="text-muted text-xs mb-1">إجمالي المصروفات</p>
              <p className="text-red font-black text-xl ltr-num" dir="ltr">
                {formatAmount(expenseTotal)}
              </p>
            </div>
            <div className="bg-green/10 rounded-xl p-3 border border-green/20">
              <p className="text-muted text-xs mb-1">المتوقع</p>
              <p className="text-green font-black text-xl ltr-num" dir="ltr">
                {formatAmount(cashExpected)}
              </p>
            </div>
            <div
              className={`rounded-xl p-3 border ${
                Math.abs(cashDifference) < 0.01
                  ? "bg-green/10 border-green/20"
                  : "bg-red/10 border-red/20"
              }`}
            >
              <p className="text-muted text-xs mb-1">الفعلي / الفرق</p>
              <p className="text-cream font-black text-xl ltr-num" dir="ltr">
                {formatAmount(cashActual)}
              </p>
              <p
                className={`text-xs mt-1 ${
                  Math.abs(cashDifference) < 0.01 ? "text-green" : "text-red"
                }`}
                dir="ltr"
              >
                {Math.abs(cashDifference) < 0.01
                  ? "0.00"
                  : `${cashDifference > 0 ? "+" : ""}${cashDifference.toFixed(2)}`}
              </p>
            </div>
          </div>

          {expenses.length > 0 && (
            <div className="space-y-2">
              {expenses.map((expense, index) => (
                <div
                  key={`${expense.category}-${index}`}
                  className="bg-card-hi rounded-xl px-4 py-3 border border-line flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-cream text-sm font-medium">{expense.category}</p>
                    <p className="text-muted text-xs mt-1">{expense.description || "بدون وصف"}</p>
                  </div>
                  <span className="text-red font-bold ltr-num" dir="ltr">
                    {formatAmount(expense.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl p-5 border border-line space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-cream font-semibold">فروقات المخزون</p>
            <span className="text-muted text-xs">{inventoryAlerts.length} عناصر</span>
          </div>
          {inventoryAlerts.length === 0 ? (
            <div className="bg-green/10 border border-green/20 rounded-xl p-4 text-green text-sm">
              لا توجد فروقات مخزون مسجلة في هذا التقرير.
            </div>
          ) : (
            <div className="space-y-2">
              {inventoryAlerts.map((item) => (
                <div
                  key={item.meatTypeId}
                  className="bg-red/10 rounded-xl px-4 py-3 border border-red/20 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-cream text-sm font-medium">{item.meatTypeName}</p>
                    <p className="text-muted text-xs mt-1">
                      المتوقع {formatAmount(item.remainingExpected ?? 0)} كجم
                    </p>
                  </div>
                  <span className="text-red font-bold ltr-num" dir="ltr">
                    {(item.shortage ?? 0) > 0 ? "عجز " : "زيادة "}
                    {formatAmount(Math.abs(item.shortage ?? 0))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red/10 border border-red/20 rounded-2xl px-4 py-3 text-red text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/branch/${slug}/report/step-5`)}
            disabled={submitting}
            className="flex-1 bg-card-hi text-cream rounded-2xl py-4 font-medium border border-line disabled:opacity-50"
          >
            رجوع
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-[2] bg-green hover:bg-green-dark disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl py-4 text-lg font-bold transition-colors active:scale-[0.98]"
          >
            {submitting ? "جاري الإرسال..." : "إرسال التقرير"}
          </button>
        </div>
      </div>
    </div>
  );
}
