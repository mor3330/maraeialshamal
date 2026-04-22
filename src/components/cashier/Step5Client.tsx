"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CashierHeader from "./CashierHeader";
import { getDraft, getSession, saveDraft } from "@/lib/report-store";

interface ExpenseRow {
  id: string;
  category: string;
  description: string;
  amount: string;
}

const EXPENSE_CATEGORIES = ["نثريات", "عمالة", "صيانة", "نقل", "ضيافة", "أخرى"];

function createExpenseRow(): ExpenseRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: "",
    description: "",
    amount: "",
  };
}

function formatAmount(value: number) {
  return value.toLocaleString("ar-SA-u-nu-latn", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function Step5Client({ slug }: { slug: string }) {
  const router = useRouter();
  const [session, setSession] = useState<{ branchName: string } | null>(null);
  const [cashSales, setCashSales] = useState(0);
  const [cashActual, setCashActual] = useState("");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession || currentSession.branchSlug !== slug) {
      router.replace(`/branch/${slug}`);
      return;
    }

    const draft = getDraft();
    if (!draft?.inventory) {
      router.replace(`/branch/${slug}/report/step-4`);
      return;
    }

    setSession(currentSession);

    const cashPayment =
      draft.payments?.find((payment) => payment.methodCode === "cash")?.amount ?? 0;

    setCashSales(cashPayment);
    setCashActual(
      draft.cashActual === undefined || draft.cashActual === null ? "" : String(draft.cashActual)
    );

    if (draft.expenses && draft.expenses.length > 0) {
      setExpenses(
        draft.expenses.map((expense, index) => ({
          id: `${Date.now()}-${index}`,
          category: expense.category,
          description: expense.description,
          amount: expense.amount === 0 ? "" : String(expense.amount),
        }))
      );
      return;
    }

    setExpenses([createExpenseRow()]);
  }, [router, slug]);

  const expenseTotal = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const cashExpected = cashSales - expenseTotal;
  const actualNumber = Number(cashActual);
  const hasActual = cashActual !== "" && !Number.isNaN(actualNumber);
  const difference = hasActual ? actualNumber - cashExpected : 0;

  function updateExpense(id: string, field: keyof Omit<ExpenseRow, "id">, value: string) {
    setExpenses((current) =>
      current.map((expense) => (expense.id === id ? { ...expense, [field]: value } : expense))
    );
    setError("");
  }

  function addExpenseRow() {
    setExpenses((current) => [...current, createExpenseRow()]);
  }

  function removeExpenseRow(id: string) {
    setExpenses((current) => {
      const filtered = current.filter((expense) => expense.id !== id);
      return filtered.length > 0 ? filtered : [createExpenseRow()];
    });
    setError("");
  }

  function handleNext() {
    if (cashActual === "" || Number.isNaN(actualNumber) || actualNumber < 0) {
      setError("أدخل المبلغ النقدي الفعلي بشكل صحيح.");
      return;
    }

    const touchedExpenses = expenses.filter(
      (expense) => expense.category || expense.description || expense.amount
    );

    const hasInvalidExpense = touchedExpenses.some((expense) => {
      const amount = Number(expense.amount);
      return !expense.category || Number.isNaN(amount) || amount <= 0;
    });

    if (hasInvalidExpense) {
      setError("أكمل بيانات المصروف أو احذف السطر غير المكتمل.");
      return;
    }

    saveDraft({
      cashActual: actualNumber,
      cashExpected,
      expenses: touchedExpenses.map((expense) => ({
        category: expense.category,
        description: expense.description.trim(),
        amount: Number(expense.amount),
      })),
    });

    router.push(`/branch/${slug}/report/step-6`);
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <CashierHeader
        branchName={session.branchName}
        step={5}
        totalSteps={6}
        stepLabel="الكاش والمصروفات"
      />

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-4">
        <div className="bg-card rounded-2xl p-5 border border-line space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-cream font-semibold">ملخص الكاش</p>
              <p className="text-muted text-xs mt-1">احتساب المتوقع بعد خصم المصروفات اليومية</p>
            </div>
            <span className="text-green text-xs bg-green/10 px-3 py-1 rounded-full border border-green/20">
              خطوة 5
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-card-hi rounded-xl p-3 border border-line">
              <p className="text-muted text-xs mb-1">كاش المبيعات</p>
              <p className="text-cream font-black ltr-num text-lg" dir="ltr">
                {formatAmount(cashSales)}
              </p>
            </div>
            <div className="bg-card-hi rounded-xl p-3 border border-line">
              <p className="text-muted text-xs mb-1">المصروفات</p>
              <p className="text-red font-black ltr-num text-lg" dir="ltr">
                {formatAmount(expenseTotal)}
              </p>
            </div>
            <div className="bg-green/10 rounded-xl p-3 border border-green/20">
              <p className="text-muted text-xs mb-1">المتوقع</p>
              <p className="text-green font-black ltr-num text-lg" dir="ltr">
                {formatAmount(cashExpected)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-line">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-cream font-semibold">الكاش الفعلي</p>
              <p className="text-muted text-xs mt-1">المبلغ الموجود فعلًا في الصندوق</p>
            </div>
            <span className="text-muted text-xs">ريال سعودي</span>
          </div>
          <input
            type="number"
            inputMode="decimal"
            value={cashActual}
            onChange={(event) => {
              setCashActual(event.target.value);
              setError("");
            }}
            placeholder="0"
            className="w-full bg-card-hi text-cream rounded-xl px-4 py-4 text-3xl font-black ltr-num border border-line focus:border-green outline-none"
            dir="ltr"
          />

          {hasActual && (
            <div
              className={`mt-4 rounded-xl p-4 border ${
                Math.abs(difference) < 0.01
                  ? "bg-green/10 border-green/20"
                  : difference > 0
                    ? "bg-amber/10 border-amber/20"
                    : "bg-red/10 border-red/20"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-muted text-xs mb-1">الفرق بين الفعلي والمتوقع</p>
                  <p
                    className={`font-black text-xl ltr-num ${
                      Math.abs(difference) < 0.01
                        ? "text-green"
                        : difference > 0
                          ? "text-amber"
                          : "text-red"
                    }`}
                    dir="ltr"
                  >
                    {formatAmount(Math.abs(difference))}
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold ${
                    Math.abs(difference) < 0.01
                      ? "text-green"
                      : difference > 0
                        ? "text-amber"
                        : "text-red"
                  }`}
                >
                  {Math.abs(difference) < 0.01
                    ? "مطابق"
                    : difference > 0
                      ? "زيادة في الصندوق"
                      : "عجز في الصندوق"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl p-5 border border-line space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-cream font-semibold">المصروفات</p>
              <p className="text-muted text-xs mt-1">سجل المصروفات النقدية التي خرجت من الصندوق</p>
            </div>
            <button
              type="button"
              onClick={addExpenseRow}
              className="bg-card-hi border border-line rounded-xl px-3 py-2 text-sm text-cream hover:border-green/30 transition-colors"
            >
              + إضافة مصروف
            </button>
          </div>

          {expenses.map((expense) => (
            <div key={expense.id} className="bg-card-hi rounded-2xl p-4 border border-line space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted text-xs mb-2">التصنيف</p>
                  <select
                    value={expense.category}
                    onChange={(event) => updateExpense(expense.id, "category", event.target.value)}
                    className="w-full bg-bg text-cream rounded-xl px-3 py-3 border border-line focus:border-green outline-none"
                  >
                    <option value="">اختر التصنيف</option>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-muted text-xs mb-2">المبلغ</p>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={expense.amount}
                    onChange={(event) => updateExpense(expense.id, "amount", event.target.value)}
                    placeholder="0"
                    className="w-full bg-bg text-cream rounded-xl px-3 py-3 text-xl font-black ltr-num border border-line focus:border-green outline-none"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <p className="text-muted text-xs mb-2">الوصف</p>
                <input
                  type="text"
                  value={expense.description}
                  onChange={(event) => updateExpense(expense.id, "description", event.target.value)}
                  placeholder="مثال: ماء، إصلاح، نقل طلب"
                  className="w-full bg-bg text-cream rounded-xl px-3 py-3 border border-line focus:border-green outline-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => removeExpenseRow(expense.id)}
                  className="text-red text-sm hover:opacity-80 transition-opacity"
                >
                  حذف السطر
                </button>
              </div>
            </div>
          ))}

          <div className="rounded-xl p-3 bg-bg border border-line flex items-center justify-between">
            <span className="text-muted text-sm">إجمالي المصروفات</span>
            <span className="text-cream font-black text-xl ltr-num" dir="ltr">
              {formatAmount(expenseTotal)}
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red/10 border border-red/20 rounded-2xl px-4 py-3 text-red text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/branch/${slug}/report/step-4`)}
            className="flex-1 bg-card-hi text-cream rounded-2xl py-4 font-medium border border-line"
          >
            رجوع
          </button>
          <button
            onClick={handleNext}
            className="flex-[2] bg-green hover:bg-green-dark text-white rounded-2xl py-4 text-lg font-bold transition-colors active:scale-[0.98]"
          >
            التالي ← المراجعة
          </button>
        </div>
      </div>
    </div>
  );
}
