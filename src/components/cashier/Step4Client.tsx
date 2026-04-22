"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CashierHeader from "./CashierHeader";
import { getDraft, saveDraft, getSession } from "@/lib/report-store";

interface InventoryRow {
  meatTypeId: string;
  meatTypeName: string;
  salesKg: number;
  openingStock: string;
  incoming: string;
  outgoing: string;
  remainingActual: string;
  remainingExpected?: number;
  shortage?: number;
}

export default function Step4Client({ slug }: { slug: string }) {
  const router = useRouter();
  const [session, setSession] = useState<{ branchName: string } | null>(null);
  const [rows, setRows] = useState<InventoryRow[]>([]);

  useEffect(() => {
    const s = getSession();
    if (!s || s.branchSlug !== slug) { router.replace(`/branch/${slug}`); return; }
    setSession(s);
    const draft = getDraft();
    if (!draft?.meatSales) { router.replace(`/branch/${slug}/report/step-1`); return; }

    const existing = draft.inventory ?? [];
    const newRows: InventoryRow[] = draft.meatSales.map(ms => {
      const saved = existing.find(i => i.meatTypeId === ms.meatTypeId);
      return {
        meatTypeId: ms.meatTypeId,
        meatTypeName: ms.meatTypeName,
        salesKg: ms.weightKg,
        openingStock: saved ? String(saved.openingStock) : "",
        incoming: saved ? String(saved.incoming) : "",
        outgoing: saved ? String(saved.outgoing) : "",
        remainingActual: saved ? String(saved.remainingActual) : "",
      };
    });
    setRows(newRows);
  }, [slug, router]);

  function update(id: string, field: keyof InventoryRow, val: string) {
    setRows(prev => prev.map(r => {
      if (r.meatTypeId !== id) return r;
      const updated = { ...r, [field]: val };
      // Auto-calc expected
      const o = Number(updated.openingStock) || 0;
      const i = Number(updated.incoming) || 0;
      const s = updated.salesKg;
      const out = Number(updated.outgoing) || 0;
      updated.remainingExpected = o + i - s - out;
      const actual = Number(updated.remainingActual);
      if (!isNaN(actual)) {
        updated.shortage = updated.remainingExpected - actual;
      }
      return updated;
    }));
  }

  function handleNext() {
    saveDraft({
      inventory: rows.map(r => ({
        meatTypeId: r.meatTypeId,
        meatTypeName: r.meatTypeName,
        openingStock: Number(r.openingStock) || 0,
        incoming: Number(r.incoming) || 0,
        outgoing: Number(r.outgoing) || 0,
        remainingActual: Number(r.remainingActual) || 0,
        remainingExpected: r.remainingExpected,
        shortage: r.shortage,
      })),
    });
    router.push(`/branch/${slug}/report/step-5`);
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <CashierHeader branchName={session.branchName} step={4} totalSteps={6} stepLabel="حركة المخزون" />

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-4">
        {rows.map(row => {
          const expected = row.remainingExpected;
          const actual = Number(row.remainingActual);
          const hasExpected = row.openingStock !== "" && expected !== undefined;
          const shortage = hasExpected ? expected! - actual : 0;
          const hasActual = row.remainingActual !== "";

          return (
            <div key={row.meatTypeId} className="bg-card rounded-2xl border border-line overflow-hidden">
              <div className="px-5 py-3 bg-card-hi flex items-center justify-between">
                <p className="text-cream font-bold">{row.meatTypeName}</p>
                <span className="text-muted text-xs">مبيعات اليوم: {row.salesKg} كجم</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "رصيد أمس (كجم)", field: "openingStock" as const },
                    { label: "الوارد اليوم (كجم)", field: "incoming" as const },
                  ].map(({ label, field }) => (
                    <div key={field}>
                      <p className="text-muted text-xs mb-1">{label}</p>
                      <input
                        type="number" inputMode="decimal"
                        value={row[field] as string}
                        onChange={e => update(row.meatTypeId, field, e.target.value)}
                        placeholder="0"
                        className="w-full bg-card-hi text-cream rounded-lg px-3 py-2 text-xl font-black ltr-num border border-line focus:border-green outline-none"
                        dir="ltr"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted text-xs mb-1">الصادر للغير (كجم)</p>
                    <input
                      type="number" inputMode="decimal"
                      value={row.outgoing}
                      onChange={e => update(row.meatTypeId, "outgoing", e.target.value)}
                      placeholder="0"
                      className="w-full bg-card-hi text-cream rounded-lg px-3 py-2 text-xl font-black ltr-num border border-line focus:border-green outline-none"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <p className="text-muted text-xs mb-1">المتبقي الفعلي (كجم)</p>
                    <input
                      type="number" inputMode="decimal"
                      value={row.remainingActual}
                      onChange={e => update(row.meatTypeId, "remainingActual", e.target.value)}
                      placeholder="0"
                      className="w-full bg-card-hi text-cream rounded-lg px-3 py-2 text-xl font-black ltr-num border border-line focus:border-green outline-none"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Auto calculation result */}
                {hasExpected && hasActual && (
                  <div className={`rounded-xl p-3 flex items-center justify-between ${
                    Math.abs(shortage) < 0.01 ? "bg-green/10 border border-green/20" :
                    shortage > 0 ? "bg-red/10 border border-red/20" : "bg-amber/10 border border-amber/20"
                  }`}>
                    <div>
                      <p className="text-muted text-xs">المفروض يبقى</p>
                      <p className="text-cream font-bold ltr-num" dir="ltr">{expected!.toFixed(1)} كجم</p>
                    </div>
                    <div className="text-left">
                      <p className="text-muted text-xs">الفرق</p>
                      <p className={`font-bold ltr-num ${shortage > 0.01 ? "text-red" : shortage < -0.01 ? "text-amber" : "text-green"}`} dir="ltr">
                        {shortage > 0.01 ? `عجز ${shortage.toFixed(1)}` : shortage < -0.01 ? `زيادة ${Math.abs(shortage).toFixed(1)}` : "✓ مطابق"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="flex gap-3">
          <button onClick={() => router.back()} className="flex-1 bg-card-hi text-cream rounded-2xl py-4 font-medium border border-line">← رجوع</button>
          <button onClick={handleNext} className="flex-[2] bg-green hover:bg-green-dark text-white rounded-2xl py-4 text-lg font-bold transition-colors active:scale-[0.98]">
            التالي ← الكاش
          </button>
        </div>
      </div>
    </div>
  );
}
