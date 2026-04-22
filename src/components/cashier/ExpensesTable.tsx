"use client";

import { useState } from "react";

interface Expense {
  id: string;
  description: string;
  amount: number;
  imageUrl?: string;
}

interface ExpensesTableProps {
  expenses: Expense[];
  onChange: (expenses: Expense[]) => void;
}

export default function ExpensesTable({ expenses, onChange }: ExpensesTableProps) {
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newImage, setNewImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("حجم الصورة كبير جداً. الحد الأقصى 2 ميجابايت");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      alert("يرجى رفع صورة فقط");
      return;
    }

    setUploading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewImage(reader.result as string);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert("فشل رفع الصورة");
      setUploading(false);
    }
  }

  function handleAdd() {
    if (!newDescription.trim() || !newAmount) {
      alert("يرجى إدخال البيان والمبلغ");
      return;
    }

    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("يرجى إدخال مبلغ صحيح");
      return;
    }

    const newExpense: Expense = {
      id: Date.now().toString(),
      description: newDescription.trim(),
      amount,
      imageUrl: newImage || undefined,
    };

    onChange([...expenses, newExpense]);
    setNewDescription("");
    setNewAmount("");
    setNewImage(null);
  }

  function handleDelete(id: string) {
    onChange(expenses.filter(e => e.id !== id));
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <>
      <div className="bg-card rounded-2xl border border-line overflow-hidden">
        <div className="bg-card-hi px-4 py-3 border-b border-line">
          <h3 className="text-cream font-bold text-lg">💸 المصروفات</h3>
        </div>

        <div className="p-4 space-y-4">
          {/* قائمة المصروفات */}
          {expenses.length > 0 ? (
            <div className="space-y-2">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center gap-3 bg-card-hi p-3 rounded-xl border border-line"
                >
                  {expense.imageUrl && (
                    <button
                      onClick={() => setViewingImage(expense.imageUrl!)}
                      className="w-12 h-12 rounded-lg overflow-hidden border border-line hover:border-green transition-colors flex-shrink-0"
                    >
                      <img src={expense.imageUrl} alt="expense" className="w-full h-full object-cover" />
                    </button>
                  )}
                  <div className="flex-1">
                    <div className="text-cream font-medium">{expense.description}</div>
                    <div className="text-green-500 text-sm font-bold">
                      {expense.amount.toFixed(2)} ريال
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="text-red-500 hover:text-red-400 transition-colors px-3 py-1"
                  >
                    🗑️
                  </button>
                </div>
              ))}

              {/* الإجمالي */}
              <div className="bg-green/10 border border-green/30 rounded-xl p-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted font-medium">إجمالي المصروفات:</span>
                  <span className="text-green-500 font-bold text-lg">
                    {total.toFixed(2)} ريال
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted py-6">
              لا توجد مصروفات
            </div>
          )}

          {/* نموذج إضافة مصروف جديد */}
          <div className="border-t border-line pt-4 space-y-3">
            <div>
              <label className="block text-muted text-sm mb-1">البيان</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="مثال: كهرباء، صيانة، نظافة..."
                className="w-full bg-card-hi border border-line rounded-xl px-4 py-3 text-cream placeholder-muted focus:outline-none focus:border-green transition-colors"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    document.getElementById("amount-input")?.focus();
                  }
                }}
              />
            </div>

            <div>
              <label className="block text-muted text-sm mb-1">المبلغ (ريال)</label>
              <input
                id="amount-input"
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full bg-card-hi border border-line rounded-xl px-4 py-3 text-cream placeholder-muted focus:outline-none focus:border-green transition-colors"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
            </div>

            {/* رفع صورة */}
            <div>
              <label className="block text-muted text-sm mb-1">صورة المصروف (اختياري)</label>
              {newImage ? (
                <div className="relative">
                  <img src={newImage} alt="preview" className="w-full h-32 object-cover rounded-xl border border-line" />
                  <button
                    onClick={() => setNewImage(null)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className="block w-full bg-card-hi border border-dashed border-line rounded-xl px-4 py-6 text-center cursor-pointer hover:border-green transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={uploading}
                  />
                  <div className="text-muted">
                    {uploading ? "جاري الرفع..." : "📷 اضغط لرفع صورة"}
                  </div>
                  <div className="text-xs text-muted/60 mt-1">حجم أقصى: 2 ميجابايت</div>
                </label>
              )}
            </div>

            <button
              onClick={handleAdd}
              className="w-full bg-green hover:bg-green-dark text-white rounded-xl py-3 font-bold transition-colors active:scale-[0.98]"
            >
              ➕ إضافة مصروف
            </button>
          </div>
        </div>
      </div>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={viewingImage} alt="expense" className="max-w-full max-h-[90vh] rounded-xl" />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-4 right-4 bg-red-500 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
