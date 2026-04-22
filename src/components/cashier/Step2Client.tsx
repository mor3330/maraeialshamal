"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CashierHeader from "./CashierHeader";
import { getDraft, saveDraft, getSession } from "@/lib/report-store";

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
}

const METHOD_ICONS: Record<string, string> = {
  cash: "ك",
  network: "ش",
  transfer: "ت",
  deferred: "آ",
};

export default function Step2Client({ slug }: { slug: string }) {
  const router = useRouter();
  const [session, setSession] = useState<{ branchName: string } | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [totalSales, setTotalSales] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s || s.branchSlug !== slug) { router.replace(`/branch/${slug}`); return; }
    setSession(s);

    const draft = getDraft();
    if (!draft?.totalSales) { router.replace(`/branch/${slug}/report/step-1`); return; }
    setTotalSales(draft.totalSales);

    // Restore saved payments
    if (draft.payments) {
      const a: Record<string, string> = {};
      draft.payments.forEach(p => { a[p.methodId] = String(p.amount); });
      setAmounts(a);
    }

    // Load payment methods
    fetch("/api/payment-methods")
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          setMethods(d.data);
          if (!draft.payments) {
            const init: Record<string, string> = {};
            d.data.forEach((m: PaymentMethod) => { init[m.id] = ""; });
            setAmounts(init);
          }
        }
      })
      .catch(() => {
        // Fallback static methods
        const fallback = [
          { id: "cash", name: "كاش", code: "cash" },
          { id: "network", name: "شبكة", code: "network" },
          { id: "transfer", name: "تحويل بنكي", code: "transfer" },
          { id: "deferred", name: "آجل", code: "deferred" },
        ];
        setMethods(fallback);
        const init: Record<string, string> = {};
        fallback.forEach(m => { init[m.id] = ""; });
        setAmounts(init);
      });
  }, [slug, router]);

  const total = Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const diff = total - totalSales;
  const isMatch = Math.abs(diff) < 0.01;

  function handleNext() {
    if (!isMatch) {
      setError(`المجموع ${total.toLocaleString("ar-SA")} لا يطابق إجمالي المبيعات ${totalSales.toLocaleString("ar-SA")}`);
      return;
    }
    saveDraft({
      payments: methods.map(m => ({
        methodId: m.id,
        methodName: m.name,
        methodCode: m.code,
        amount: Number(amounts[m.id]) || 0,
      })),
    });
    router.push(`/branch/${slug}/report/step-3`);
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <CashierHeader branchName={session.branchName} step={2} totalSteps={6} stepLabel="طرق الدفع" />

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-4">
        <div className="bg-card rounded-2xl p-5 border border-line">
          <div className="flex items-center justify-between mb-4">
            <p className="text-cream font-semibold">طرق الدفع</p>
            <p className="text-muted text-xs">المجموع لازم يطابق الإجمالي</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {methods.map(m => (
              <div key={m.id} className="bg-card-hi rounded-xl p-3 border border-line">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 rounded-full bg-green/20 text-green text-sm font-bold flex items-center justify-center">
                    {METHOD_ICONS[m.code] ?? m.name[0]}
                  </span>
                  <span className="text-muted text-sm">{m.name}</span>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amounts[m.id] ?? ""}
                  onChange={e => { setAmounts(a => ({ ...a, [m.id]: e.target.value })); setError(""); }}
                  placeholder="0"
                  className="w-full bg-bg text-cream rounded-lg px-3 py-2 text-xl font-black ltr-num border border-line focus:border-green outline-none"
                  dir="ltr"
                />
              </div>
            ))}
          </div>

          {/* Total check */}
          <div className={`mt-4 rounded-xl p-3 flex items-center justify-between ${
            total === 0 ? "bg-card-hi" : isMatch ? "bg-green/10 border border-green/30" : "bg-red/10 border border-red/30"
          }`}>
            <span className="text-muted text-sm">المجموع</span>
            <div className="text-left ltr-num" dir="ltr">
              <span className={`text-xl font-black ${isMatch && total > 0 ? "text-green" : total > 0 ? "text-red" : "text-cream"}`}>
                {total.toLocaleString("ar-SA-u-nu-latn")}
              </span>
              <span className="text-muted text-xs mr-1">/ {totalSales.toLocaleString("ar-SA-u-nu-latn")}</span>
            </div>
          </div>
          {total > 0 && isMatch && (
            <p className="text-green text-sm text-center mt-2 font-medium">✓ المجموع مطابق: {totalSales.toLocaleString("ar-SA-u-nu-latn")} ريال</p>
          )}
          {error && <p className="text-red text-sm text-center mt-2">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="flex-1 bg-card-hi text-cream rounded-2xl py-4 font-medium border border-line hover:border-green/30 transition-colors"
          >
            ← رجوع
          </button>
          <button
            onClick={handleNext}
            disabled={!isMatch || total === 0}
            className="flex-[2] bg-green hover:bg-green-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl py-4 text-lg font-bold transition-colors active:scale-[0.98]"
          >
            التالي ← مبيعات اللحوم
          </button>
        </div>
      </div>
    </div>
  );
}
