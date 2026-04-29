"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ItemType {
  id: string;
  name: string;
  name_en: string;
  meat_category: string | null;
}

const CATEGORIES = [
  { value: "hashi", label: "حاشي 🐄",  color: "bg-amber/20 border-amber/40 text-amber" },
  { value: "sheep", label: "غنم 🐑",   color: "bg-blue-500/20 border-blue-500/40 text-blue-400" },
  { value: "beef",  label: "عجل 🥩",   color: "bg-red/20 border-red/40 text-red" },
  { value: "offal", label: "مخلفات ♻️", color: "bg-purple-500/20 border-purple-500/40 text-purple-400" },
];

const getCatStyle = (v: string | null) =>
  CATEGORIES.find(c => c.value === v)?.color ?? "bg-card-hi border-line text-muted";
const getCatLabel = (v: string | null) =>
  CATEGORIES.find(c => c.value === v)?.label ?? "غير مصنّف";

export default function PurchaseCategoriesPage() {
  const [items, setItems]         = useState<ItemType[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState<string | null>(null); // id الذي يُحفظ
  const [success, setSuccess]     = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/item-types");
      const d   = await res.json();
      setItems(d.itemTypes ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function setCategory(id: string, cat: string | null) {
    setSaving(id);
    setError(null);
    try {
      const res = await fetch(`/api/item-types/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meat_category: cat }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "فشل الحفظ");
      setItems(prev =>
        prev.map(it => it.id === id ? { ...it, meat_category: cat } : it)
      );
      setSuccess(id);
      setTimeout(() => setSuccess(null), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  // إحصاءات
  const classified   = items.filter(i => i.meat_category).length;
  const unclassified = items.filter(i => !i.meat_category).length;

  return (
    <div className="min-h-screen bg-bg text-cream p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* رأس الصفحة */}
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <Link href="/dashboard" className="text-muted hover:text-cream text-sm transition-colors">
            &larr; لوحة الإدارة
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-black">تصنيف أصناف المشتريات</h1>
            <p className="text-muted text-sm mt-1">
              حدّد لكل صنف الفئة التي ينتمي إليها ليظهر صحيحاً في ملخص اللحوم
            </p>
          </div>
        </div>

        {/* إحصاءات */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-card border border-green/20 rounded-2xl p-4 text-center">
            <p className="text-muted text-xs mb-1">مُصنَّف</p>
            <p className="text-green font-black text-2xl">{classified}</p>
          </div>
          <div className="bg-card border border-red/20 rounded-2xl p-4 text-center">
            <p className="text-muted text-xs mb-1">غير مُصنَّف</p>
            <p className="text-red font-black text-2xl">{unclassified}</p>
          </div>
          {CATEGORIES.map(cat => (
            <div key={cat.value} className={`bg-card border rounded-2xl p-4 text-center ${cat.color.replace("bg-", "border-").split(" ")[1]}`}>
              <p className="text-muted text-xs mb-1">{cat.label}</p>
              <p className="font-black text-2xl text-cream">
                {items.filter(i => i.meat_category === cat.value).length}
              </p>
            </div>
          ))}
        </div>

        {/* تعليمات */}
        <div className="bg-amber/5 border border-amber/20 rounded-2xl px-5 py-3 mb-6">
          <p className="text-amber text-sm font-bold">💡 كيفية الاستخدام</p>
          <p className="text-muted text-xs mt-1">
            انقر على الفئة بجانب كل صنف لتعيينه — يظهر التغيير فوراً في ملخص اللحوم بالداشبورد.
          </p>
        </div>

        {error && (
          <div className="bg-red/10 border border-red/20 rounded-xl px-4 py-3 text-red text-sm mb-4">{error}</div>
        )}

        {/* قائمة الأصناف */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div
                key={item.id}
                className={`bg-card border rounded-2xl px-5 py-4 flex items-center gap-4 flex-wrap transition-all ${
                  success === item.id ? "border-green/60" : "border-line"
                }`}
              >
                {/* اسم الصنف */}
                <div className="flex-1 min-w-[120px]">
                  <p className="font-bold text-cream">{item.name}</p>
                  {item.name_en && (
                    <p className="text-muted text-xs">{item.name_en}</p>
                  )}
                </div>

                {/* الفئة الحالية */}
                <div className={`rounded-xl border px-3 py-1.5 text-xs font-bold whitespace-nowrap ${getCatStyle(item.meat_category)}`}>
                  {success === item.id ? "✓ حُفظ" : getCatLabel(item.meat_category)}
                </div>

                {/* أزرار التصنيف */}
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      disabled={saving === item.id}
                      onClick={() => setCategory(item.id, item.meat_category === cat.value ? null : cat.value)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50 ${
                        item.meat_category === cat.value
                          ? cat.color + " scale-105 shadow-sm"
                          : "border-line bg-card-hi text-muted hover:text-cream"
                      }`}
                    >
                      {saving === item.id && item.meat_category !== cat.value ? "..." : cat.label}
                    </button>
                  ))}
                  {/* زر إلغاء التصنيف */}
                  {item.meat_category && (
                    <button
                      disabled={saving === item.id}
                      onClick={() => setCategory(item.id, null)}
                      className="rounded-xl border border-line/50 px-2 py-1.5 text-xs text-muted/60 hover:text-red hover:border-red/30 transition-all"
                      title="إلغاء التصنيف"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* تحذير إذا يوجد غير مصنف */}
        {!loading && unclassified > 0 && (
          <div className="mt-6 bg-amber/5 border border-amber/20 rounded-2xl px-5 py-4">
            <p className="text-amber text-sm font-bold">
              ⚠️ {unclassified} صنف غير مصنّف — لن تُحتسب في ملخص اللحوم
            </p>
          </div>
        )}

        {!loading && unclassified === 0 && items.length > 0 && (
          <div className="mt-6 bg-green/5 border border-green/20 rounded-2xl px-5 py-4">
            <p className="text-green text-sm font-bold">
              ✅ جميع الأصناف مُصنَّفة — ملخص اللحوم يعمل بشكل كامل
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
