"use client";

import { useState, useEffect, useCallback } from "react";

function fmt(n: number) {
  if (!n) return "0";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtCur(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const AR_MONTHS: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس",    "04": "أبريل",
  "05": "مايو",  "06": "يونيو",  "07": "يوليو",   "08": "أغسطس",
  "09": "سبتمبر","10": "أكتوبر", "11": "نوفمبر",  "12": "ديسمبر",
};

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${AR_MONTHS[m] || m} ${y}`;
}

export default function PurchasesReviewPage() {
  // ── الشهور/السنوات المتاحة
  const [byYear, setByYear]   = useState<Record<string, string[]>>({});
  const [years, setYears]     = useState<string[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // ── الاختيار
  const [selectedYear,  setSelectedYear]  = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // ── بيانات الشهر
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // ── تفصيل الفرع
  const [expandedBranch,  setExpandedBranch]  = useState<string | null>(null);
  const [branchPurchases, setBranchPurchases] = useState<any[]>([]);
  const [loadingBranch,   setLoadingBranch]   = useState(false);

  // ── تفصيل الغنم
  const [showSheepDetail, setShowSheepDetail] = useState(false);

  // جلب الشهور المتاحة
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/purchases/available-months");
        const json = await res.json();
        setByYear(json.byYear  || {});
        setYears(json.years    || []);
        // اختر السنة الأولى تلقائياً
        if (json.years?.length > 0) {
          const y = json.years[0];
          setSelectedYear(y);
          // اختر الشهر الأول في تلك السنة تلقائياً
          const months = json.byYear?.[y] || [];
          if (months.length > 0) setSelectedMonth(months[0]);
        }
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, []);

  // جلب بيانات الشهر المختار
  const load = useCallback(async (m: string) => {
    if (!m) return;
    setLoading(true);
    setData(null);
    setExpandedBranch(null);
    setBranchPurchases([]);
    try {
      const res  = await fetch(`/api/purchases/review?month=${m}`);
      const json = await res.json();
      setData(json);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { if (selectedMonth) load(selectedMonth); }, [selectedMonth, load]);

  // عند تغيير السنة: أعد تعيين الشهر
  function handleYearChange(y: string) {
    setSelectedYear(y);
    const months = byYear[y] || [];
    setSelectedMonth(months.length > 0 ? months[0] : "");
    setData(null);
  }

  async function loadBranchDetail(branchId: string) {
    if (expandedBranch === branchId) {
      setExpandedBranch(null);
      setBranchPurchases([]);
      return;
    }
    setExpandedBranch(branchId);
    setLoadingBranch(true);
    try {
      const res  = await fetch(`/api/purchases/review?month=${selectedMonth}&branchId=${branchId}`);
      const json = await res.json();
      setBranchPurchases(json.purchases || []);
    } catch { setBranchPurchases([]); }
    setLoadingBranch(false);
  }

  const s = data?.summary;
  const monthsForYear = byYear[selectedYear] || [];

  // ════════════════════════════════
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">

      {/* العنوان */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-black text-cream">محمد طه</h1>
          <span className="text-muted text-sm">/ مراجعة المشتريات</span>
        </div>
        <p className="text-muted text-sm">مراجعة شاملة لجميع مشتريات الفروع</p>
      </div>

      {/* ── اختيار السنة ثم الشهر ── */}
      {loadingMeta ? (
        <div className="bg-card border border-line rounded-2xl p-5 text-center text-muted text-sm">
          جاري تحميل البيانات المتاحة...
        </div>
      ) : years.length === 0 ? (
        <div className="bg-card border border-line rounded-2xl p-5 text-center text-muted text-sm">
          لا توجد مشتريات مسجلة
        </div>
      ) : (
        <div className="bg-card border border-line rounded-2xl p-5 space-y-4">
          {/* السنة */}
          <div>
            <p className="text-muted text-xs font-semibold mb-2">السنة</p>
            <div className="flex flex-wrap gap-2">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => handleYearChange(y)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                    selectedYear === y
                      ? "bg-green text-white"
                      : "bg-card-hi border border-line text-muted hover:text-cream"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* الشهر */}
          {selectedYear && (
            <div>
              <p className="text-muted text-xs font-semibold mb-2">الشهر</p>
              {monthsForYear.length === 0 ? (
                <p className="text-muted text-sm">لا توجد شهور في هذه السنة</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {monthsForYear.map(m => (
                    <button
                      key={m}
                      onClick={() => setSelectedMonth(m)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        selectedMonth === m
                          ? "bg-amber text-black"
                          : "bg-card-hi border border-line text-muted hover:text-cream"
                      }`}
                    >
                      {AR_MONTHS[m.split("-")[1]] || m.split("-")[1]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── مؤشر التحميل ── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-line border-t-amber rounded-full animate-spin" />
        </div>
      )}

      {/* ── النتائج ── */}
      {data && !loading && (
        <>
          {/* بطاقة الإجمالي الكلي */}
          <div className="bg-card border border-amber/40 rounded-2xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-muted text-sm">إجمالي مشتريات {monthLabel(selectedMonth)}</p>
                <p className="text-4xl font-black text-amber mt-1">{fmtCur(data.grandTotal)} ر.س</p>
              </div>
              <div className="text-left">
                <p className="text-muted text-xs">{data.totalCount} سجل مشتريات</p>
                <p className="text-muted text-xs mt-1">{data.byBranch?.length} فرع</p>
              </div>
            </div>
          </div>

          {/* بطاقات الفئات الثلاث */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* حاشي */}
            <div className="bg-card border border-amber/30 rounded-2xl p-4">
              <h3 className="text-amber font-black text-lg mb-3 border-b border-line pb-2">حاشي</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">العدد</span>
                  <span className="text-cream font-bold">{fmt(s.hashi.count)} رأس</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">الوزن</span>
                  <span className="text-cream font-bold">{fmt(s.hashi.weight)} كجم</span>
                </div>
                <div className="h-px bg-line" />
                <div className="flex justify-between">
                  <span className="text-muted text-sm">الإجمالي</span>
                  <span className="text-amber font-black">{fmtCur(s.hashi.total)} ر</span>
                </div>
              </div>
            </div>

            {/* غنم */}
            <div className="bg-card border border-sky-400/30 rounded-2xl p-4">
              <div className="flex items-center justify-between border-b border-line pb-2 mb-3">
                <button
                  onClick={() => setShowSheepDetail(!showSheepDetail)}
                  className="text-xs text-muted hover:text-cream underline"
                >
                  {showSheepDetail ? "إخفاء الأصناف" : "تفصيل الأصناف"}
                </button>
                <h3 className="text-sky-400 font-black text-lg">غنم</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">العدد</span>
                  <span className="text-cream font-bold">{fmt(s.sheep.count)} رأس</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">الوزن</span>
                  <span className="text-cream font-bold">{fmt(s.sheep.weight)} كجم</span>
                </div>
                <div className="h-px bg-line" />
                <div className="flex justify-between">
                  <span className="text-muted text-sm">الإجمالي</span>
                  <span className="text-sky-400 font-black">{fmtCur(s.sheep.total)} ر</span>
                </div>
              </div>

              {/* تفصيل أصناف الغنم */}
              {showSheepDetail && data.sheepByType?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line space-y-1.5">
                  {data.sheepByType.map((t: any) => (
                    <div key={t.name} className="flex justify-between text-xs gap-2">
                      <span className="text-sky-400 font-bold">{fmtCur(t.total)} ر</span>
                      <span className="text-muted flex-1 text-left">{fmt(t.count)} رأس · {fmt(t.weight)} كجم</span>
                      <span className="text-cream font-semibold">{t.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* عجل */}
            <div className="bg-card border border-red-400/30 rounded-2xl p-4">
              <h3 className="text-red-400 font-black text-lg mb-3 border-b border-line pb-2">عجل</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">العدد</span>
                  <span className="text-cream font-bold">{fmt(s.beef.count)} رأس</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">الوزن</span>
                  <span className="text-cream font-bold">{fmt(s.beef.weight)} كجم</span>
                </div>
                <div className="h-px bg-line" />
                <div className="flex justify-between">
                  <span className="text-muted text-sm">الإجمالي</span>
                  <span className="text-red-400 font-black">{fmtCur(s.beef.total)} ر</span>
                </div>
              </div>
            </div>
          </div>

          {/* قسم الفروع */}
          <div className="bg-card border border-line rounded-2xl overflow-hidden">
            <div className="bg-card-hi px-5 py-4 border-b border-line flex items-center justify-between">
              <p className="text-muted text-sm">{data.byBranch?.length} فرع</p>
              <h3 className="text-cream font-bold text-lg">المشتريات حسب الفرع</h3>
            </div>

            <div className="divide-y divide-line">
              {data.byBranch?.length === 0 && (
                <div className="p-8 text-center text-muted">لا توجد مشتريات في هذا الشهر</div>
              )}

              {data.byBranch?.map((branch: any) => (
                <div key={branch.branchId}>
                  {/* رأس الفرع */}
                  <button
                    onClick={() => loadBranchDetail(branch.branchId)}
                    className="w-full px-5 py-4 flex items-center gap-3 hover:bg-card-hi transition-colors text-right"
                  >
                    <div className="w-10 h-10 rounded-xl bg-green/10 border border-green/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-green font-black text-sm">{branch.branchName.charAt(0)}</span>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-cream font-bold">{branch.branchName}</p>
                      <div className="flex gap-4 text-xs text-muted mt-0.5">
                        {branch.hashi.total > 0 && <span>حاشي: {fmtCur(branch.hashi.total)} ر</span>}
                        {branch.sheep.total > 0 && <span>غنم: {fmtCur(branch.sheep.total)} ر</span>}
                        {branch.beef.total  > 0 && <span>عجل: {fmtCur(branch.beef.total)} ر</span>}
                      </div>
                    </div>
                    <div className="text-left flex-shrink-0">
                      <p className="text-amber font-black">{fmtCur(branch.grandTotal)} ر</p>
                      <p className="text-muted text-xs mt-0.5">
                        {expandedBranch === branch.branchId ? "اخفاء ▲" : "تفصيل ▼"}
                      </p>
                    </div>
                  </button>

                  {/* سجلات الفرع */}
                  {expandedBranch === branch.branchId && (
                    <div className="bg-bg border-t border-line">
                      {loadingBranch ? (
                        <div className="p-6 flex items-center justify-center gap-2 text-muted">
                          <div className="w-5 h-5 border-2 border-line border-t-amber rounded-full animate-spin" />
                          جاري التحميل...
                        </div>
                      ) : branchPurchases.length === 0 ? (
                        <div className="p-6 text-center text-muted text-sm">لا توجد سجلات</div>
                      ) : (
                        <div className="divide-y divide-line">
                          {/* رأس الجدول */}
                          <div className="grid grid-cols-[100px_1fr_60px_80px_80px_90px] gap-2 px-5 py-2 bg-card-hi text-xs text-muted font-semibold">
                            <span>التاريخ</span>
                            <span className="text-right">الصنف / المورد</span>
                            <span className="text-center">العدد</span>
                            <span className="text-center">الوزن</span>
                            <span className="text-center">السعر/كجم</span>
                            <span className="text-left">الإجمالي</span>
                          </div>

                          {branchPurchases.map((p: any) => (
                            <div key={p.id} className="grid grid-cols-[100px_1fr_60px_80px_80px_90px] gap-2 px-5 py-3 items-center text-sm hover:bg-card-hi">
                              <span className="text-muted text-xs">{p.purchase_date}</span>
                              <div className="text-right">
                                <p className="text-cream font-semibold">{p.item_types?.name || "-"}</p>
                                {p.suppliers?.name && <p className="text-muted text-xs">{p.suppliers.name}</p>}
                                {p.notes && <p className="text-muted text-xs italic">{p.notes}</p>}
                              </div>
                              <span className="text-cream text-center">{fmt(p.quantity)}</span>
                              <span className="text-cream text-center">{fmt(p.weight)} كجم</span>
                              <span className="text-muted text-center text-xs">
                                {p.weight ? fmtCur(p.price / p.weight) : "-"}
                              </span>
                              <span className="text-amber font-bold text-left">{fmtCur(p.price)} ر</span>
                            </div>
                          ))}

                          {/* إجمالي الفرع */}
                          <div className="grid grid-cols-[100px_1fr_60px_80px_80px_90px] gap-2 px-5 py-3 bg-card-hi font-bold text-sm">
                            <span className="text-muted">الإجمالي</span>
                            <span />
                            <span className="text-cream text-center">
                              {fmt(branch.hashi.count + branch.sheep.count + branch.beef.count)}
                            </span>
                            <span className="text-cream text-center">
                              {fmt(branch.hashi.weight + branch.sheep.weight + branch.beef.weight)} كجم
                            </span>
                            <span />
                            <span className="text-amber font-black text-left">{fmtCur(branch.grandTotal)} ر</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
