"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CashierHeader from "./CashierHeader";
import { getDraft, saveDraft, getSession } from "@/lib/report-store";

// الأصناف الثابتة — كل صنف بطاقة واحدة بحقل وزن + سعر
// نتجاهل التقسيم الفرعي من قاعدة البيانات تماماً
const MEAT_CATEGORIES = [
  { id: "hashi",  label: "🐪 الحاشي",           hasCount: false },
  { id: "beef",   label: "🐄 العجل",             hasCount: false },
  { id: "sheep",  label: "🐑 الغنم",             hasCount: true  },
  { id: "minced", label: "🥩 اللحم المفروم",     hasCount: false },
  { id: "offal",  label: "🫀 المخلفات",          hasCount: false },
];

export default function Step3Client({ slug }: { slug: string }) {
  const router = useRouter();
  const [session, setSession] = useState<{ branchName: string } | null>(null);
  // weights[catId] = وزن بالكجم
  const [weights, setWeights] = useState<Record<string, string>>({});
  // prices[catId] = سعر بالريال (أو عدد الرؤوس للغنم)
  const [prices, setPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    const s = getSession();
    if (!s || s.branchSlug !== slug) { router.replace(`/branch/${slug}`); return; }
    setSession(s);
    const draft = getDraft();
    if (!draft?.totalSales) { router.replace(`/branch/${slug}/report/step-1`); return; }

    // استعادة القيم المحفوظة — نقرأ فقط إذا كانت المفاتيح بتنسيق الـ categories الجديدة
    if (draft.meatSales) {
      const validCatIds = new Set(MEAT_CATEGORIES.map(c => c.id));
      const w: Record<string, string> = {};
      const p: Record<string, string> = {};
      for (const m of draft.meatSales) {
        // نقبل فقط البيانات التي مفتاحها category صحيح (hashi, beef, sheep, minced, offal)
        if (validCatIds.has(m.meatTypeId)) {
          if (m.weightKg) w[m.meatTypeId] = String(m.weightKg);
          if (m.count)    p[m.meatTypeId] = String(m.count);
        }
      }
      setWeights(w);
      setPrices(p);
    }
  }, [slug, router]);

  function handleNext() {
    // نحفظ كل category كـ entry واحدة
    saveDraft({
      meatSales: MEAT_CATEGORIES.map(cat => ({
        meatTypeId: cat.id,
        meatTypeName: cat.label.replace(/^[^\s]+\s/, ""), // شيل الإيموجي
        category: cat.id,
        hasCount: cat.hasCount,
        count: Number(prices[cat.id]) || 0,
        weightKg: Number(weights[cat.id]) || 0,
      })),
    });
    router.push(`/branch/${slug}/report/step-4`);
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <CashierHeader branchName={session.branchName} step={3} totalSteps={6} stepLabel="مبيعات اللحوم بالتفصيل" />

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-3">

        {MEAT_CATEGORIES.map(cat => (
          <div key={cat.id} className="bg-card rounded-2xl border border-line overflow-hidden">
            <div className="px-5 py-3 bg-card-hi border-b border-line">
              <p className="text-cream font-bold">{cat.label}</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {/* وزن */}
              <div>
                <p className="text-muted text-xs mb-2">الوزن (كجم)</p>
                <input
                  type="number" inputMode="decimal"
                  value={weights[cat.id] ?? ""}
                  onChange={e => setWeights(w => ({ ...w, [cat.id]: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-card-hi text-cream rounded-xl px-3 py-3 text-2xl font-black ltr-num border border-line focus:border-green outline-none"
                  dir="ltr"
                />
              </div>
              {/* غنم: رأس | غيره: سعر */}
              <div>
                <p className="text-muted text-xs mb-2">
                  {cat.hasCount ? "الكمية (رأس)" : "السعر (ريال)"}
                </p>
                <input
                  type="number" inputMode="numeric"
                  value={prices[cat.id] ?? ""}
                  onChange={e => setPrices(p => ({ ...p, [cat.id]: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-card-hi text-cream rounded-xl px-3 py-3 text-2xl font-black ltr-num border border-line focus:border-green outline-none"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        ))}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => router.back()}
            className="flex-1 bg-card-hi text-cream rounded-2xl py-4 font-medium border border-line hover:border-green/30 transition-colors"
          >
            ← رجوع
          </button>
          <button
            onClick={handleNext}
            className="flex-[2] bg-green hover:bg-green-dark text-white rounded-2xl py-4 text-lg font-bold transition-colors active:scale-[0.98]"
          >
            التالي ← المخزون
          </button>
        </div>

      </div>
    </div>
  );
}
