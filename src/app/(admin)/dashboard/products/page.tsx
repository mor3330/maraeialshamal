"use client";

import { useState, useEffect, useCallback } from "react";

type Category = "hashi" | "sheep" | "beef" | "offal" | "other" | null;

interface Product {
  name: string;
  category: Category;
}

const CAT_INFO: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  hashi: { label: "حاشي",   icon: "🐪", color: "text-amber",      bg: "bg-amber/10",      border: "border-amber/40"       },
  sheep: { label: "غنم",    icon: "🐑", color: "text-blue-400",   bg: "bg-blue-400/10",   border: "border-blue-400/40"    },
  beef:  { label: "عجل",    icon: "🐄", color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/40"     },
  offal: { label: "مخلفات", icon: "🥩", color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/40"  },
  other: { label: "أخرى",   icon: "📦", color: "text-muted",      bg: "bg-card-hi",       border: "border-line"           },
};

const CATS = ["hashi", "sheep", "beef", "offal", "other"] as const;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [filterCat, setFilterCat] = useState<Category | "unclassified">("unclassified");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products-mapping");
      const json = await res.json();
      setProducts(json.products || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSetCategory(name: string, category: string) {
    setSaving(name);
    try {
      await fetch("/api/products-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category }),
      });
      setProducts(prev => prev.map(p => p.name === name ? { ...p, category: category as Category } : p));
      setSuccessMsg(`✓ تم تصنيف "${name}"`);
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch {}
    setSaving(null);
  }

  async function handleRemoveCategory(name: string) {
    setSaving(name);
    try {
      await fetch(`/api/products-mapping?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      setProducts(prev => prev.map(p => p.name === name ? { ...p, category: null } : p));
    } catch {}
    setSaving(null);
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "unclassified" ? !p.category
      : filterCat === null ? true
      : p.category === filterCat;
    return matchSearch && matchCat;
  });

  const unclassifiedCount = products.filter(p => !p.category).length;
  const classifiedCount   = products.filter(p => p.category).length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cream">🏷️ تصنيف منتجات POS</h1>
          <p className="text-muted text-sm mt-1">
            صنّف كل منتج حتى تظهر مبيعاته في تقارير الحاشي والغنم والعجل
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 bg-card border border-line text-muted hover:text-cream px-4 py-2 rounded-xl text-sm transition-colors">
          🔄 تحديث
        </button>
      </div>

      {/* ── إحصائيات ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-red/20 rounded-2xl p-3 text-center">
          <p className="text-muted text-xs">غير مصنّفة</p>
          <p className="text-red font-bold text-xl">{unclassifiedCount}</p>
        </div>
        <div className="bg-card border border-green/20 rounded-2xl p-3 text-center">
          <p className="text-muted text-xs">مصنّفة</p>
          <p className="text-green font-bold text-xl">{classifiedCount}</p>
        </div>
        {["hashi", "sheep", "beef", "offal"].map(cat => (
          <div key={cat} className={`bg-card border rounded-2xl p-3 text-center ${CAT_INFO[cat].border}`}>
            <p className="text-muted text-xs">{CAT_INFO[cat].icon} {CAT_INFO[cat].label}</p>
            <p className={`font-bold text-xl ${CAT_INFO[cat].color}`}>
              {products.filter(p => p.category === cat).length}
            </p>
          </div>
        ))}
      </div>

      {/* ── رسالة النجاح ── */}
      {successMsg && (
        <div className="bg-green/10 border border-green/30 rounded-xl px-4 py-3 text-green text-sm font-semibold">
          {successMsg}
        </div>
      )}

      {/* ── فلاتر البحث ── */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="text"
          placeholder="بحث عن منتج..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-card border border-line rounded-xl px-4 py-2 text-cream text-sm placeholder:text-muted focus:outline-none focus:border-green/50 flex-1 min-w-48"
        />
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterCat("unclassified")}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${filterCat === "unclassified" ? "bg-red/20 text-red border border-red/30" : "bg-card border border-line text-muted hover:text-cream"}`}>
            غير مصنّفة {unclassifiedCount > 0 && <span className="bg-red text-white rounded-full px-1.5 py-0.5 mr-1">{unclassifiedCount}</span>}
          </button>
          <button onClick={() => setFilterCat(null)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${filterCat === null ? "bg-green/20 text-green border border-green/30" : "bg-card border border-line text-muted hover:text-cream"}`}>
            الكل
          </button>
          {CATS.map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${filterCat === cat ? `${CAT_INFO[cat].bg} ${CAT_INFO[cat].color} border ${CAT_INFO[cat].border}` : "bg-card border border-line text-muted hover:text-cream"}`}>
              {CAT_INFO[cat].icon} {CAT_INFO[cat].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="text-4xl mb-4">📦</p>
          <p className="text-lg font-semibold mb-2">لا توجد منتجات بعد</p>
          <p className="text-sm">ستظهر المنتجات هنا بعد مزامنة بيانات POS</p>
        </div>
      ) : (
        <div className="bg-card border border-line rounded-2xl overflow-hidden">
          <div className="bg-card-hi px-4 py-3 border-b border-line flex items-center justify-between">
            <h3 className="text-cream font-bold text-sm">
              {filtered.length} منتج {search || filterCat !== null ? "مفلترة" : ""}
            </h3>
            {unclassifiedCount > 0 && filterCat === "unclassified" && (
              <p className="text-amber text-xs">صنّف كل منتج بضغطة واحدة 👇</p>
            )}
          </div>

          <div className="divide-y divide-line/50">
            {filtered.length === 0 && (
              <div className="text-center py-8 text-muted text-sm">لا توجد نتائج</div>
            )}
            {filtered.map(product => (
              <div key={product.name} className="px-4 py-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-semibold text-sm leading-tight">{product.name}</p>
                    {product.category ? (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-lg border ${CAT_INFO[product.category]?.bg} ${CAT_INFO[product.category]?.color} ${CAT_INFO[product.category]?.border}`}>
                          {CAT_INFO[product.category]?.icon} {CAT_INFO[product.category]?.label}
                        </span>
                        <button
                          onClick={() => handleRemoveCategory(product.name)}
                          disabled={saving === product.name}
                          className="text-xs text-muted/50 hover:text-red transition-colors"
                        >
                          إزالة
                        </button>
                      </div>
                    ) : (
                      <p className="text-muted text-xs mt-1">غير مصنّف</p>
                    )}
                  </div>

                  {/* أزرار التصنيف */}
                  <div className="flex gap-1.5 flex-wrap">
                    {CATS.map(cat => {
                      const info = CAT_INFO[cat];
                      const isActive = product.category === cat;
                      const isSaving = saving === product.name;
                      return (
                        <button
                          key={cat}
                          onClick={() => handleSetCategory(product.name, cat)}
                          disabled={isSaving || isActive}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                            isActive
                              ? `${info.bg} ${info.color} ${info.border} opacity-100`
                              : `bg-card-hi border-line text-muted hover:${info.bg} hover:${info.color} hover:${info.border} disabled:opacity-50`
                          }`}
                        >
                          {isSaving ? "..." : <><span>{info.icon}</span><span>{info.label}</span></>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── تلميح ── */}
      {classifiedCount > 0 && (
        <div className="bg-amber/10 border border-amber/30 rounded-2xl p-4 text-sm text-amber">
          <p className="font-bold mb-1">💡 كيف يعمل التصنيف؟</p>
          <p className="text-muted text-xs leading-relaxed">
            بعد تصنيف المنتجات، ستظهر مبيعاتها حسب الفئة في صفحة تفاصيل POS.
            كما يمكن لقارئ الفاتورة في التقرير اليومي استخدام هذه البيانات لتعبئة تفاصيل المبيعات تلقائياً.
          </p>
        </div>
      )}
    </div>
  );
}
