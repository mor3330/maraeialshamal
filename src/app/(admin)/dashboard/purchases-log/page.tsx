"use client";

import { useState, useEffect } from "react";

interface Purchase {
  id: string;
  branch_id: string;
  supplier_id: string | null;
  item_type_id: string;
  purchase_date: string;
  quantity: number;
  weight: number;
  price: number;
  notes?: string;
  branches?: { id: string; name: string };
  suppliers?: { id: string; name: string };
  item_types?: { id: string; name: string };
}

interface Branch { id: string; name: string; }
interface Supplier { id: string; name: string; }
interface ItemType { id: string; name: string; }

const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmtN = (v: number) => v.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function getWeekRange() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  const sunday = new Date(now); sunday.setDate(now.getDate() - now.getDay());
  const saturday = new Date(sunday); saturday.setDate(sunday.getDate() + 6);
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return { from: f(sunday), to: f(saturday) };
}

export default function PurchasesLogPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const week = getWeekRange();
  const [fromDate, setFromDate] = useState(week.from);
  const [toDate, setToDate] = useState(week.to);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterItemType, setFilterItemType] = useState("");

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { loadPurchases(); }, [fromDate, toDate, filterBranch, filterSupplier, filterItemType]);

  async function loadMeta() {
    const [bRes, sRes, itRes] = await Promise.all([fetch("/api/admin/branches"), fetch("/api/suppliers"), fetch("/api/item-types")]);
    const bData = await bRes.json(); const sData = await sRes.json(); const itData = await itRes.json();
    setBranches(bData.branches || []); setSuppliers(sData.suppliers || []); setItemTypes(itData.itemTypes || []);
  }

  async function loadPurchases() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterBranch) params.set("branchId", filterBranch);
      if (filterSupplier) params.set("supplierId", filterSupplier);
      if (filterItemType) params.set("itemTypeId", filterItemType);
      const res = await fetch(`/api/purchases?${params.toString()}`);
      const data = await res.json();
      const all: Purchase[] = data.purchases || [];
      setPurchases(all.filter(p => { const d = p.purchase_date?.substring(0,10) || ""; return d >= fromDate && d <= toDate; }));
    } finally { setLoading(false); }
  }

  const totalWeight = purchases.reduce((s, p) => s + toN(p.weight), 0);
  const totalPrice = purchases.reduce((s, p) => s + toN(p.price), 0);
  const totalQty = purchases.reduce((s, p) => s + toN(p.quantity), 0);
  const byItemType: Record<string, { count: number; weight: number; price: number }> = {};
  purchases.forEach(p => {
    const name = p.item_types?.name || "غير محدد";
    if (!byItemType[name]) byItemType[name] = { count: 0, weight: 0, price: 0 };
    byItemType[name].count++; byItemType[name].weight += toN(p.weight); byItemType[name].price += toN(p.price);
  });

  return (
    <div className="min-h-screen bg-bg text-cream p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-black mb-2">سجل المشتريات</h1>
          <p className="text-muted">عرض وتحليل جميع المشتريات حسب الفترة الزمنية</p>
        </div>

        <div className="bg-card rounded-3xl border border-line p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div><label className="text-xs text-muted block mb-1">من تاريخ</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="w-full rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50" /></div>
            <div><label className="text-xs text-muted block mb-1">إلى تاريخ</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="w-full rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50" /></div>
            <div><label className="text-xs text-muted block mb-1">الفرع</label>
              <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}
                className="w-full rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50">
                <option value="">الكل</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><label className="text-xs text-muted block mb-1">المورد</label>
              <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
                className="w-full rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50">
                <option value="">الكل</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="text-xs text-muted block mb-1">الصنف</label>
              <select value={filterItemType} onChange={e => setFilterItemType(e.target.value)}
                className="w-full rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50">
                <option value="">الكل</option>{itemTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          </div>
          <div className="mt-4 flex gap-3 items-center">
            <button onClick={() => { const w = getWeekRange(); setFromDate(w.from); setToDate(w.to); setFilterBranch(""); setFilterSupplier(""); setFilterItemType(""); }}
              className="rounded-xl bg-card-hi border border-line px-5 py-2 text-sm text-muted hover:text-cream transition-all">
              إعادة تعيين</button>
            <span className="text-sm text-muted">النتائج: <span className="text-green font-bold">{purchases.length}</span> عملية</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="rounded-3xl border border-line bg-card p-6"><p className="text-muted text-sm mb-2">إجمالي العمليات</p><p className="text-4xl font-black text-green">{purchases.length}</p></div>
          <div className="rounded-3xl border border-line bg-card p-6"><p className="text-muted text-sm mb-2">إجمالي الوزن</p><p className="text-4xl font-black text-blue-400 ltr-num" dir="ltr">{fmtN(totalWeight)} <span className="text-lg">كجم</span></p></div>
          <div className="rounded-3xl border border-line bg-card p-6"><p className="text-muted text-sm mb-2">إجمالي المبلغ</p><p className="text-4xl font-black text-amber-400 ltr-num" dir="ltr">{fmtN(totalPrice)} <span className="text-lg">ر</span></p></div>
        </div>

        {Object.keys(byItemType).length > 0 && (
          <div className="bg-card rounded-3xl border border-line p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">ملخص حسب الصنف</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(byItemType).map(([name, s]) => (
                <div key={name} className="bg-bg rounded-2xl border border-line p-4">
                  <p className="font-bold text-cream mb-2">{name}</p>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted">عمليات: <span className="text-cream">{s.count}</span></span>
                    <span className="text-blue-400 ltr-num">{fmtN(s.weight)} كجم</span>
                  </div>
                  <p className="text-amber-400 font-bold ltr-num text-sm">{fmtN(s.price)} ر</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-card rounded-3xl border border-line overflow-hidden">
          <div className="px-6 py-4 border-b border-line"><h2 className="text-lg font-bold">تفاصيل المشتريات</h2></div>
          {loading ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-green border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-muted">جاري التحميل...</p>
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">📭</p>
              <p className="text-muted text-lg">لا توجد مشتريات في هذه الفترة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-bg">
                  <tr className="text-muted text-sm border-b border-line">
                    <th className="p-3 text-right">التاريخ</th><th className="p-3 text-right">الفرع</th>
                    <th className="p-3 text-right">المورد</th><th className="p-3 text-right">الصنف</th>
                    <th className="p-3 text-right">العدد</th><th className="p-3 text-right">الوزن</th>
                    <th className="p-3 text-right">السعر</th><th className="p-3 text-right">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p, i) => (
                    <tr key={p.id} className={`border-b border-line/50 hover:bg-card-hi transition-colors ${i%2===0?"":"bg-bg/30"}`}>
                      <td className="p-3 text-sm text-muted ltr-num" dir="ltr">{p.purchase_date?.substring(0,10)}</td>
                      <td className="p-3 font-medium">{p.branches?.name || "-"}</td>
                      <td className="p-3 text-sm">{p.suppliers?.name || "-"}</td>
                      <td className="p-3"><span className="rounded-lg bg-green/10 text-green px-2 py-0.5 text-xs font-medium">{p.item_types?.name || "-"}</span></td>
                      <td className="p-3 font-bold ltr-num" dir="ltr">{p.quantity}</td>
                      <td className="p-3 text-blue-400 font-bold ltr-num" dir="ltr">{fmtN(toN(p.weight))} <span className="text-xs text-muted">كجم</span></td>
                      <td className="p-3 text-amber-400 font-bold ltr-num" dir="ltr">{fmtN(toN(p.price))} <span className="text-xs text-muted">ر</span></td>
                      <td className="p-3 text-xs text-muted">{p.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-bg border-t-2 border-green/20">
                  <tr>
                    <td colSpan={4} className="p-3 font-bold text-muted text-sm">المجموع</td>
                    <td className="p-3 font-black text-green ltr-num">{Math.round(totalQty)}</td>
                    <td className="p-3 font-black text-blue-400 ltr-num" dir="ltr">{fmtN(totalWeight)} <span className="text-xs">كجم</span></td>
                    <td className="p-3 font-black text-amber-400 ltr-num" dir="ltr">{fmtN(totalPrice)} <span className="text-xs">ر</span></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}