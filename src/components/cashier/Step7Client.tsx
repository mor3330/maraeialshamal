"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CashierHeader from "./CashierHeader";
import ExpensesTable from "./ExpensesTable";
import { getDraft, saveDraft, getSession } from "@/lib/report-store";

interface Expense {
  id: string;
  description: string;
  amount: number;
}

export default function Step7Client({ slug }: { slug: string }) {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s || s.branchSlug !== slug) {
      router.replace(`/branch/${slug}`);
      return;
    }
    setSession(s);

    // استعادة البيانات المحفوظة
    const draft = getDraft();
    if (draft) {
      setExpenses((draft.expenses || []).map((exp: any) => ({
        id: exp.id || String(Math.random()),
        description: exp.description,
        amount: exp.amount,
      })));
      setNotes((draft as any).notes || "");
    }
  }, [slug, router]);

  function handleNext() {
    if (!confirmed) {
      alert("يرجى التأكيد على صحة البيانات");
      return;
    }

    // حفظ البيانات
    const riyadhYest = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    riyadhYest.setDate(riyadhYest.getDate() - 1);
    const ry = riyadhYest.getFullYear();
    const rm = String(riyadhYest.getMonth() + 1).padStart(2, "0");
    const rd = String(riyadhYest.getDate()).padStart(2, "0");
    const draft = getDraft() || {
      branchId: session!.branchId,
      branchName: session!.branchName,
      branchSlug: slug,
      reportDate: `${ry}-${rm}-${rd}`,
    };

    saveDraft({
      ...draft,
      expenses: expenses.map(({ description, amount }) => ({ category: "general", description, amount })),
      notes,
      step7Values: { confirmed: true },
    });

    // الانتقال للمراجعة
    router.push(`/branch/${slug}/report/review`);
  }

  function handleBack() {
    // حفظ البيانات الحالية
    const draft = getDraft();
    if (draft) {
      saveDraft({
        ...draft,
        expenses: expenses.map(({ description, amount }) => ({ category: "general", description, amount })),
        notes,
      });
    }
    router.push(`/branch/${slug}/report/step-5`);
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-muted">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <CashierHeader
        branchName={session.branchName}
        step={7}
        totalSteps={7}
        stepLabel="المصروفات والملاحظات"
      />

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6">
        {/* العنوان */}
        <div className="bg-card-hi rounded-xl p-4 border border-line">
          <h2 className="text-cream text-lg font-bold text-center">
            📝 المصروفات والملاحظات
          </h2>
        </div>

        {/* جدول المصروفات */}
        <ExpensesTable expenses={expenses} onChange={setExpenses} />

        {/* الملاحظات */}
        <div className="bg-card rounded-2xl border border-line overflow-hidden">
          <div className="bg-card-hi px-4 py-3 border-b border-line">
            <h3 className="text-cream font-bold text-lg">📋 ملاحظات إضافية</h3>
          </div>
          <div className="p-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات أو تعليقات..."
              rows={4}
              className="w-full bg-card-hi border border-line rounded-xl px-4 py-3 text-cream placeholder-muted focus:outline-none focus:border-green transition-colors resize-none"
            />
          </div>
        </div>

        {/* التأكيد */}
        <div className="bg-card rounded-2xl border border-line p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="w-5 h-5 rounded border-2 border-line bg-card-hi checked:bg-green checked:border-green transition-colors cursor-pointer"
            />
            <span className="text-cream font-medium">
              أؤكد صحة جميع البيانات المدخلة
            </span>
          </label>
        </div>

        {/* الأزرار */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleBack}
            className="flex-1 bg-card-hi border border-line text-muted rounded-2xl py-4 text-lg font-bold transition-colors hover:text-cream active:scale-[0.98]"
          >
            ← السابق
          </button>
          <button
            onClick={handleNext}
            disabled={!confirmed}
            className="flex-[2] bg-green hover:bg-green-dark text-white rounded-2xl py-4 text-lg font-bold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            المراجعة النهائية →
          </button>
        </div>
      </div>
    </div>
  );
}
