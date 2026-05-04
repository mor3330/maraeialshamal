"use client";

import { useState, useEffect, useCallback } from "react";

export const dynamic = "force-dynamic";

const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmt  = (v: number, d = 2) => v.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: d });

function getRiyadhToday() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

type CatTotals = { count: number; weight: number };
type DiffVal   = { diff: number; hasGap: boolean };

interface BranchRow {
  branchId: string;
  branchName: string;
  hasPurchases: boolean;
  hasReport: boolean;
  purchases: { hashi: CatTotals; sheep: CatTotals; beef: CatTotals };
  incoming:  { hashi: CatTotals; sheep: CatTotals; beef: CatTotals };
  diffs: {
    hashi: { count: DiffVal; weight: DiffVal };
    sheep: { count: DiffVal; weight: DiffVal };
    beef:  { count: DiffVal; weight: DiffVal };
  };
}

function DiffBadge({ d, unit }: { d: DiffVal; unit: string }) {
  if (!d.hasGap) return <span className="text-green text-xs font-medium">✓</span>;
  const sign = d.diff > 0 ? "+" : "";
  return (
    <span className="inline-flex items-center gap-0.5 rounded-lg bg-red/15 text-red px-2 py-0.5 text-xs font-bold ltr-num" dir="ltr">
      {sign}{fmt(d.diff, 2)} {unit}
    </span>
  );
}

function CatCell({ pur, inc, diff, label }: {
  pur: CatTotals; inc: CatTotals;
  diff: { count: DiffVal; weight: DiffVal };
  label: string;
}) {
  const anyGap = diff.count.hasGap || diff.weight.hasGap;
  return (
    <td className={`p-3 border-r border-line/30 align-top ${anyGap ? "bg-red/5" : ""}`}>
      <p className="text-[10px] text-muted font-medium mb-1.5">{label}</p>
      {/* صف المشتريات */}
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-muted">مشتريات:</span>
        <span className="ltr-num text-cream" dir="ltr">{pur.count} رأس / {fmt(pur.weight)} كجم</span>
      </div>
      {/* صف الوارد */}
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-muted">وارد فرع:</span>
        <span className="ltr-num text-cream" dir="ltr">{inc.count} رأس / {fmt(inc.weight)} كجم</span>
      </div>
      {/* الفرق */}
      <div className="flex gap-1.5 flex-wrap">
        <DiffBadge d={diff.count}  unit="رأس" />
        <DiffBadge d={diff.weight} unit="كجم" />
      </div>
    </td>
  );
}

export default function PurchasesComparisonPage() {
  const today = getRiyadhToday();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo,   setDateTo]   = useState(today);
  const [rows, setRows]    = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterGap, setFilterGap] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/purchases-comparison?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      const data = await res.json();
      setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const displayed = filterGap
    ? rows.filter(r =>
        r.diffs.hashi.count.hasGap  || r.diffs.hashi.weight.hasGap  ||
        r.diffs.sheep.count.hasGap  || r.diffs.sheep.weight.hasGap  ||
        r.diffs.beef.count.hasGap   || r.diffs.beef.weight.hasGap
      )
    : rows;

  const gapCount = rows.filter(r =>
    r.diffs.hashi.count.hasGap  || r.diffs.hashi.weight.hasGap  ||
    r.diffs.sheep.count.hasGap  || r.diffs.sheep.weight.hasGap  ||
    r.diffs.beef.count.hasGap   || r.diffs.beef.weight.hasGap
  ).length;

  const noReportCount = rows.filter(r => r.hasPurchases && !r.hasReport).length;

  return (
    <div className="min-h-screen bg-bg text-cream p-6">
      <div className="max-w-7xl mx-auto">

        {/* ── رأس الصفحة ── */}
        <div className="mb-8">
          <h1 className="text-4xl font-black mb-2">مقارنة المشتريات</h1>
          <p className="text-muted">مقارنة ما تم شراؤه مركزياً بما وصل فعلاً إلى كل فرع حسب التقارير</p>
        </div>

        {/* ── الفلاتر ── */}
        <div className="bg-card rounded-3xl border border-line p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs text-muted block mb-1">من تاريخ</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">إلى تاريخ</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="rounded-xl bg-bg border border-line px-3 py-2 text-cream text-sm focus:outline-none focus:border-green/50" />
            </div>
            <button onClick={() => { setDateFrom(today); setDateTo(today); }}
              className="rounded-xl bg-card-hi border border-line px-5 py-2 text-sm text-muted hover:text-cream transition-all">
              اليوم
            </button>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={filterGap} onChange={e => setFilterGap(e.target.checked)}
                className="w-4 h-4 accent-red rounded" />
              <span className="text-sm text-muted">الفروع التي بها اختلاف فقط</span>
            </label>
          </div>
        </div>

        {/* ── بطاقات ملخص ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-3xl border border-line bg-card p-5">
            <p className="text-muted text-xs mb-1">إجمالي الفروع</p>
            <p className="text-3xl font-black text-green">{rows.length}</p>
          </div>
          <div className={`rounded-3xl border p-5 ${gapCount > 0 ? "border-red/30 bg-red/5" : "border-line bg-card"}`}>
            <p className="text-muted text-xs mb-1">فروع بها اختلاف</p>
            <p className={`text-3xl font-black ${gapCount > 0 ? "text-red" : "text-green"}`}>{gapCount}</p>
          </div>
          <div className={`rounded-3xl border p-5 ${noReportCount > 0 ? "border-amber/30 bg-amber/5" : "border-line bg-card"}`}>
            <p className="text-muted text-xs mb-1">فروع بدون تقرير</p>
            <p className={`text-3xl font-black ${noReportCount > 0 ? "text-amber" : "text-green"}`}>{noReportCount}</p>
          </div>
          <div className="rounded-3xl border border-line bg-card p-5">
            <p className="text-muted text-xs mb-1">فروع مطابقة</p>
            <p className="text-3xl font-black text-green">{rows.length - gapCount}</p>
          </div>
        </div>

        {/* ── تعليمة التصنيف ── */}
        <div className="rounded-2xl border border-line bg-card-hi p-4 mb-6 flex flex-wrap gap-4 text-xs text-muted">
          <span className="font-bold text-cream">تصنيف الأصناف:</span>
          <span><span className="text-green font-bold">حاشي</span> = حاشي</span>
          <span><span className="text-blue-400 font-bold">غنم</span> = خروف · نعيمي · حري · رفيدي · تيس · غنم · سواكني · روماني</span>
          <span><span className="text-amber font-bold">عجل</span> = عجل / لحم بقر</span>
        </div>

        {/* ── الجدول الرئيسي ── */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-green border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-muted">جاري التحميل...</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="bg-card rounded-3xl border border-line text-center py-20">
            <p className="text-4xl mb-4">🎉</p>
            <p className="text-muted text-lg">
              {filterGap ? "لا توجد فروع بها اختلاف في هذه الفترة" : "لا توجد بيانات لهذه الفترة"}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-3xl border border-line overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg border-b border-line">
                  <tr className="text-muted text-xs">
                    <th className="p-4 text-right font-bold border-r border-line/30 w-40">الفرع</th>
                    <th className="p-4 text-center font-bold border-r border-line/30">
                      <span className="text-green">حاشي</span>
                    </th>
                    <th className="p-4 text-center font-bold border-r border-line/30">
                      <span className="text-blue-400">غنم</span>
                    </th>
                    <th className="p-4 text-center font-bold">
                      <span className="text-amber">عجل</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((row, i) => {
                    const anyGap =
                      row.diffs.hashi.count.hasGap  || row.diffs.hashi.weight.hasGap  ||
                      row.diffs.sheep.count.hasGap  || row.diffs.sheep.weight.hasGap  ||
                      row.diffs.beef.count.hasGap   || row.diffs.beef.weight.hasGap;

                    return (
                      <tr key={row.branchId}
                        className={`border-b border-line/50 ${i % 2 === 0 ? "" : "bg-bg/30"} ${anyGap ? "ring-1 ring-inset ring-red/20" : ""}`}
                      >
                        {/* اسم الفرع */}
                        <td className="p-4 border-r border-line/30 align-middle">
                          <p className="font-bold text-cream">{row.branchName}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {!row.hasPurchases && (
                              <span className="text-[9px] rounded bg-muted/20 text-muted px-1.5 py-0.5">بدون مشتريات</span>
                            )}
                            {!row.hasReport && (
                              <span className="text-[9px] rounded bg-amber/20 text-amber px-1.5 py-0.5">بدون تقرير</span>
                            )}
                            {anyGap && (
                              <span className="text-[9px] rounded bg-red/20 text-red px-1.5 py-0.5 font-bold">⚠ اختلاف</span>
                            )}
                          </div>
                        </td>

                        <CatCell
                          pur={row.purchases.hashi} inc={row.incoming.hashi}
                          diff={row.diffs.hashi} label="حاشي"
                        />
                        <CatCell
                          pur={row.purchases.sheep} inc={row.incoming.sheep}
                          diff={row.diffs.sheep} label="غنم"
                        />
                        <CatCell
                          pur={row.purchases.beef} inc={row.incoming.beef}
                          diff={row.diffs.beef} label="عجل"
                        />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* مفتاح الألوان */}
            <div className="px-6 py-4 border-t border-line bg-bg/50 flex flex-wrap gap-6 text-xs text-muted">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-red/15 border border-red/30 flex-shrink-0" />
                خلية بها اختلاف
              </span>
              <span className="flex items-center gap-2">
                <span className="text-green font-bold">✓</span>
                مطابق
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-flex rounded-lg bg-red/15 text-red px-2 py-0.5 font-bold">+5.00 كجم</span>
                المشتريات أكثر من الوارد
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
