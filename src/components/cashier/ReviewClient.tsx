"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CashierHeader from "./CashierHeader";
import { getDraft, clearDraft, getSession } from "@/lib/report-store";

export default function ReviewClient({ slug }: { slug: string }) {
  const router = useRouter();
  const [session, setSession] = useState<{ branchName: string } | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof getDraft>>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s || s.branchSlug !== slug) { router.replace(`/branch/${slug}`); return; }
    setSession(s);
    const d = getDraft();
    if (!d?.totalSales) { router.replace(`/branch/${slug}/report/step-1`); return; }
    setDraft(d);
  }, [slug, router]);

  async function handleSubmit() {
    if (!draft || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const payload = {
        report: {
          branchId: draft.branchId,
          reportDate: draft.reportDate,
          totalSales: draft.totalSales,
          invoiceCount: draft.invoiceCount ?? null,
          returnsValue: draft.returnsValue ?? 0,
          cashExpected: draft.cashExpected ?? null,
          cashActual: draft.cashActual ?? null,
          status: "submitted",
          notes: draft.notes ?? null,
        },
        payments: (draft.payments ?? []).map(p => ({ methodId: p.methodId, amount: p.amount })),
        meatSales: (draft.meatSales ?? []).map(m => ({ meatTypeId: m.meatTypeId, count: m.count, weightKg: m.weightKg })),
        inventory: (draft.inventory ?? []).map(i => ({
          meatTypeId: i.meatTypeId,
          openingStock: i.openingStock,
          incoming: i.incoming,
          outgoing: i.outgoing,
          remainingActual: i.remainingActual,
          shortage: i.shortage,
        })),
        expenses: draft.expenses ?? [],
      };

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "حدث خطأ أثناء الإرسال");
        return;
      }

      clearDraft();
      setSubmitted(true);
    } catch {
      setError("تعذر الاتصال بالخادم، تحقق من الإنترنت");
    } finally {
      setSubmitting(false);
    }
  }

  if (!session || !draft) return null;

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
        <div className="bg-card rounded-2xl p-8 text-center border border-green/30 max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-green/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-cream text-2xl font-bold mb-2">تم الإرسال بنجاح</h2>
          <p className="text-muted text-sm mb-2">{session.branchName}</p>
          <p className="text-muted text-sm mb-6">تم حفظ تقرير اليوم وإرساله للإدارة.</p>
          <p className="text-muted text-xs">لا يمكن التعديل بعد الإرسال</p>
        </div>
      </div>
    );
  }

  const cashDiff = (draft.cashActual ?? 0) - (draft.cashExpected ?? 0);
  const hasCashIssue = Math.abs(cashDiff) > 5;
  const inventoryIssues = (draft.inventory ?? []).filter(i => (i.shortage ?? 0) > 0.5);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <CashierHeader branchName={session.branchName} step={6} totalSteps={6} stepLabel="المراجعة والإرسال" />

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-4">

        {/* Alerts */}
        {(hasCashIssue || inventoryIssues.length > 0) && (
          <div className="space-y-2">
            {hasCashIssue && (
              <div className="bg-red/10 border border-red/30 rounded-2xl p-4 flex items-start gap-3">
                <span className="text-red text-lg">⚠</span>
                <div>
                  <p className="text-red font-semibold text-sm">فرق في الكاش</p>
                  <p className="text-muted text-xs mt-1">
                    فرق {Math.abs(cashDiff).toFixed(2)} ريال — {cashDiff > 0 ? "زيادة" : "عجز"}
                  </p>
                </div>
              </div>
            )}
            {inventoryIssues.map(i => (
              <div key={i.meatTypeId} className="bg-amber/10 border border-amber/30 rounded-2xl p-4 flex items-start gap-3">
                <span className="text-amber text-lg">⚠</span>
                <div>
                  <p className="text-amber font-semibold text-sm">عجز مخزون: {i.meatTypeName}</p>
                  <p className="text-muted text-xs mt-1">{(i.shortage ?? 0).toFixed(1)} كجم</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="bg-card rounded-2xl border border-line p-5 space-y-4">
          <p className="text-cream font-bold text-lg">ملخص التقرير</p>

          <div className="grid grid-cols-2 gap-3">
            <SummaryItem label="إجمالي المبيعات" value={`${(draft.totalSales ?? 0).toLocaleString("ar-SA-u-nu-latn")} ر.س`} />
            <SummaryItem label="عدد الفواتير" value={draft.invoiceCount ? String(draft.invoiceCount) : "—"} />
            <SummaryItem label="الكاش الفعلي" value={`${(draft.cashActual ?? 0).toLocaleString("ar-SA-u-nu-latn")} ر.س`} />
            <SummaryItem
              label="فرق الكاش"
              value={`${cashDiff >= 0 ? "+" : ""}${cashDiff.toFixed(2)}`}
              tone={hasCashIssue ? "bad" : "good"}
            />
          </div>
        </div>

        {/* Payments */}
        {draft.payments && draft.payments.length > 0 && (
          <div className="bg-card rounded-2xl border border-line p-5">
            <p className="text-cream font-semibold mb-3">طرق الدفع</p>
            <div className="grid grid-cols-2 gap-2">
              {draft.payments.filter(p => p.amount > 0).map(p => (
                <div key={p.methodId} className="bg-card-hi rounded-xl p-3 flex items-center justify-between">
                  <span className="text-muted text-sm">{p.methodName}</span>
                  <span className="text-cream font-bold text-sm ltr-num" dir="ltr">{p.amount.toLocaleString("ar-SA-u-nu-latn")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inventory shortages */}
        {inventoryIssues.length > 0 && (
          <div className="bg-card rounded-2xl border border-amber/20 p-5">
            <p className="text-amber font-semibold mb-3">عجز المخزون</p>
            <div className="space-y-2">
              {inventoryIssues.map(i => (
                <div key={i.meatTypeId} className="flex items-center justify-between">
                  <span className="text-muted text-sm">{i.meatTypeName}</span>
                  <span className="text-red font-bold text-sm ltr-num" dir="ltr">{(i.shortage ?? 0).toFixed(1)} كجم</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red/10 border border-red/30 rounded-2xl p-4 text-red text-sm text-center">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pb-6">
          <button
            onClick={() => router.back()}
            disabled={submitting}
            className="flex-1 bg-card-hi text-cream rounded-2xl py-4 font-medium border border-line disabled:opacity-40"
          >
            ← رجوع
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-[2] bg-green hover:bg-green-dark disabled:opacity-60 text-white rounded-2xl py-4 text-lg font-bold transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              "✓ تأكيد الإرسال"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="bg-card-hi rounded-xl p-3">
      <p className="text-muted text-xs mb-1">{label}</p>
      <p className={`font-bold ltr-num ${tone === "good" ? "text-green" : tone === "bad" ? "text-red" : "text-cream"}`} dir="ltr">
        {value}
      </p>
    </div>
  );
}
