"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const MONTHS_AR = [
  "", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const fmtNum = (n: number) =>
  n.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const nowRiyadh = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));

export default function VatReportPage() {
  const now = nowRiyadh();
  const [year,       setYear]       = useState(now.getFullYear());
  const [month,      setMonth]      = useState(now.getMonth() + 1);
  const [data,       setData]       = useState<any>(null);
  const [loading,    setLoading]    = useState(false);
  // فلتر الفرع: "all" أو id الفرع
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/pos/vat-report?year=${year}&month=${month}`);
      const json = await res.json();
      setData(json);
    } catch {}
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const printDate = new Date().toLocaleDateString("ar-SA", {
    year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Riyadh",
  });

  // الفروع المعروضة (كل أو مفلتر)
  const allBranches: any[] = data?.branches ?? [];
  const displayBranches = branchFilter === "all"
    ? allBranches
    : allBranches.filter((b: any) => b.id === branchFilter);

  // إجمالي الفروع المعروضة
  const displayTotals = {
    invoices:    displayBranches.reduce((a: number, b: any) => a + b.invoices, 0),
    salesInclVAT: displayBranches.reduce((a: number, b: any) => a + b.salesInclVAT, 0),
    salesExclVAT: displayBranches.reduce((a: number, b: any) => a + b.salesExclVAT, 0),
    vat:         displayBranches.reduce((a: number, b: any) => a + b.vat, 0),
  };

  const selectedBranch = branchFilter !== "all"
    ? allBranches.find((b: any) => b.id === branchFilter)
    : null;

  // دالة بناء HTML الطباعة وفتح نافذة جديدة
  function doPrint() {
    const rowsHtml = displayBranches.map((branch: any, i: number) => `
      <tr>
        <td style="border:1px solid #ccc;padding:6px 10px;color:#666">${i + 1}</td>
        <td style="border:1px solid #ccc;padding:6px 10px;font-weight:600">${branch.name}${branch.code ? ` (${branch.code})` : ""}</td>
        <td style="border:1px solid #ccc;padding:6px 10px;text-align:center">${branch.invoices.toLocaleString()}</td>
        <td style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-weight:bold">${fmtNum(branch.salesInclVAT)}</td>
        <td style="border:1px solid #ccc;padding:6px 10px;text-align:right">${fmtNum(branch.salesExclVAT)}</td>
        <td style="border:1px solid #ccc;padding:6px 10px;text-align:right;color:#dc2626;font-weight:bold">${fmtNum(branch.vat)}</td>
      </tr>
    `).join("");

    const daysInMonth = new Date(year, month, 0).getDate();

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>تقرير ضريبة القيمة المضافة — ${MONTHS_AR[month]} ${year}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 20px; color: #000; background: #fff; direction: rtl; }
    h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: #555; margin-bottom: 16px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
    .total-sales { text-align: left; }
    .total-sales p { font-size: 11px; color: #555; margin-bottom: 2px; }
    .total-sales strong { font-size: 18px; color: #16a34a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f5f5f5; border: 1px solid #ccc; padding: 8px; text-align: right; }
    td { border: 1px solid #ccc; padding: 6px 10px; }
    tfoot tr { background: #e8f5e9; font-weight: bold; }
    .footer { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .notes { font-size: 11px; color: #666; line-height: 1.8; }
    .vat-box { text-align: center; border: 2px solid #dc2626; border-radius: 8px; padding: 12px 20px; }
    .vat-box p { font-size: 11px; color: #666; margin-bottom: 4px; }
    .vat-box strong { font-size: 22px; color: #dc2626; }
    .sigs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; text-align: center; font-size: 12px; color: #666; margin-top: 16px; border-top: 1px solid #ccc; padding-top: 16px; }
    .sig-line { border-bottom: 1px solid #333; margin-bottom: 8px; padding-bottom: 40px; }
    .url { font-size: 10px; color: #aaa; text-align: center; margin-top: 12px; }
    @page { margin: 1cm; size: A4 landscape; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>تقرير ضريبة القيمة المضافة — ${MONTHS_AR[month]} ${year}${selectedBranch ? ` / ${selectedBranch.name}` : ""}</h1>
      <p class="subtitle">مراعي الشمال | نسبة الضريبة: ${data?.vatRate ?? 15}% | تاريخ الإعداد: ${printDate}</p>
    </div>
    <div class="total-sales">
      <p>المبيعات الخاضعة للضريبة</p>
      <strong>${fmtNum(displayTotals.salesInclVAT)} ر.س</strong>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>اسم الفرع</th>
        <th style="text-align:center">الفواتير</th>
        <th>المبيعات (شامل ض.)</th>
        <th>المبيعات (بدون ض.)</th>
        <th style="color:#dc2626">الضريبة 15%</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="color:#16a34a;font-size:14px">الإجمالي الكلي</td>
        <td style="text-align:center;color:#16a34a">${displayTotals.invoices.toLocaleString()}</td>
        <td style="text-align:right;color:#16a34a;font-size:14px">${fmtNum(displayTotals.salesInclVAT)}</td>
        <td style="text-align:right;color:#16a34a">${fmtNum(displayTotals.salesExclVAT)}</td>
        <td style="text-align:right;color:#dc2626;font-size:16px">${fmtNum(displayTotals.vat)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div class="notes">
      <p>🧮 الأسعار شاملة الضريبة (15%) — الضريبة = المبيعات × (15 ÷ 115)</p>
      <p>📅 الفترة: 1 ${MONTHS_AR[month]} ${year} — ${daysInMonth} ${MONTHS_AR[month]} ${year}</p>
      <p>🕐 وقت الإعداد: ${printDate}</p>
    </div>
    <div class="vat-box">
      <p>إجمالي الضريبة المستحقة</p>
      <strong>${fmtNum(displayTotals.vat)}</strong>
      <p>ريال سعودي</p>
    </div>
  </div>

  <div class="sigs">
    <div><div class="sig-line"></div>توقيع المعد</div>
    <div><div class="sig-line"></div>توقيع المراجع</div>
    <div><div class="sig-line"></div>توقيع المدير</div>
  </div>

  <p class="url">https://marai-alshimal.com/dashboard/vat-report</p>

  <script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  return (
    <>
      {/* ── واجهة المستخدم العادية ── */}
      <div className="p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">

        {/* ── رأس الصفحة ── */}
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/dashboard" className="text-muted hover:text-cream text-sm transition-colors">
            &larr; العودة
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-cream">تقرير ضريبة القيمة المضافة</h1>
            <p className="text-muted text-sm mt-1">إجمالي الضريبة الشهرية لكل فرع — نسبة الضريبة 15%</p>
          </div>

          {/* زر طباعة */}
          <button
            onClick={doPrint}
            disabled={!data || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green text-white font-bold text-sm hover:bg-green/90 transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4zm2-4a1 1 0 110 2 1 1 0 010-2z" clipRule="evenodd"/>
            </svg>
            طباعة / PDF
          </button>
        </div>

        {/* ── الفلاتر ── */}
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="text-muted text-xs block mb-1">السنة</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="bg-card border border-line rounded-xl px-4 py-2 text-cream text-sm focus:outline-none focus:border-green/50">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-muted text-xs block mb-1">الشهر</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="bg-card border border-line rounded-xl px-4 py-2 text-cream text-sm focus:outline-none focus:border-green/50">
              {MONTHS_AR.slice(1).map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted text-xs block mb-1">الفرع</label>
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="bg-card border border-line rounded-xl px-4 py-2 text-cream text-sm focus:outline-none focus:border-green/50 min-w-[180px]">
              <option value="all">كل الفروع</option>
              {allBranches.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name} {b.code ? `(${b.code})` : ""}</option>
              ))}
            </select>
          </div>
          <button onClick={load} disabled={loading}
            className="px-5 py-2 rounded-xl bg-card border border-line text-cream text-sm hover:bg-card-hi transition-colors disabled:opacity-50">
            {loading ? "جاري التحميل..." : "عرض"}
          </button>
        </div>

        {/* ── شارة الفرع المحدد ── */}
        {selectedBranch && (
          <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-400/30 rounded-xl px-4 py-3">
            <span className="text-purple-400 text-sm font-bold">🏪 تقرير فرع محدد:</span>
            <span className="text-cream font-bold">{selectedBranch.name}</span>
            {selectedBranch.code && <span className="text-muted text-xs">({selectedBranch.code})</span>}
            <button
              onClick={() => setBranchFilter("all")}
              className="mr-auto text-xs text-muted hover:text-cream border border-line rounded-lg px-2 py-1 transition-colors">
              × عرض الكل
            </button>
          </div>
        )}

        {/* ── بطاقات الإجمالي ── */}
        {data && !loading && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-green/20 rounded-2xl p-4 text-center">
                <p className="text-muted text-xs mb-1">إجمالي المبيعات (شامل الضريبة)</p>
                <p className="text-green font-black text-xl ltr-num" dir="ltr">{fmtNum(displayTotals.salesInclVAT)}</p>
                <p className="text-muted text-xs">ر.س</p>
              </div>
              <div className="bg-card border border-line rounded-2xl p-4 text-center">
                <p className="text-muted text-xs mb-1">المبيعات (بدون ضريبة)</p>
                <p className="text-cream font-bold text-xl ltr-num" dir="ltr">{fmtNum(displayTotals.salesExclVAT)}</p>
                <p className="text-muted text-xs">ر.س</p>
              </div>
              <div className="bg-red/10 border border-red/20 rounded-2xl p-4 text-center">
                <p className="text-muted text-xs mb-1">إجمالي الضريبة المستحقة</p>
                <p className="text-red font-black text-xl ltr-num" dir="ltr">{fmtNum(displayTotals.vat)}</p>
                <p className="text-muted text-xs">ر.س</p>
              </div>
              <div className="bg-card border border-line rounded-2xl p-4 text-center">
                <p className="text-muted text-xs mb-1">عدد الفواتير</p>
                <p className="text-cream font-bold text-xl">{displayTotals.invoices.toLocaleString()}</p>
                <p className="text-muted text-xs">فاتورة</p>
              </div>
            </div>

            {/* ── الجدول ── */}
            <div className="bg-card border border-line rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-line">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-cream font-black text-lg">
                      تقرير ضريبة القيمة المضافة — {MONTHS_AR[month]} {year}
                      {selectedBranch && <span className="text-purple-400 text-base mr-2">/ {selectedBranch.name}</span>}
                    </h2>
                    <p className="text-muted text-sm mt-1">
                      مراعي الشمال | نسبة الضريبة: {data.vatRate}% | تاريخ الإعداد: {printDate}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-muted text-xs">المبيعات الخاضعة للضريبة</p>
                    <p className="text-green font-black text-lg ltr-num" dir="ltr">
                      {fmtNum(displayTotals.salesInclVAT)} ر.س
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-card-hi border-b border-line">
                      <th className="text-right px-4 py-3 text-muted font-semibold">#</th>
                      <th className="text-right px-4 py-3 text-muted font-semibold">اسم الفرع</th>
                      <th className="text-left px-4 py-3 text-muted font-semibold">الفواتير</th>
                      <th className="text-left px-4 py-3 text-muted font-semibold">المبيعات (شامل ض.)</th>
                      <th className="text-left px-4 py-3 text-muted font-semibold">المبيعات (بدون ض.)</th>
                      <th className="text-left px-4 py-3 text-red font-semibold">الضريبة 15%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/50">
                    {displayBranches.map((branch: any, i: number) => (
                      <tr key={branch.id}
                        className={`hover:bg-card-hi/40 transition-colors cursor-pointer ${branchFilter === branch.id ? "bg-purple-500/5" : ""}`}
                        onClick={() => setBranchFilter(branchFilter === branch.id ? "all" : branch.id)}>
                        <td className="px-4 py-3 text-muted text-xs">{i + 1}</td>
                        <td className="px-4 py-3">
                          <span className="text-cream font-semibold">{branch.name}</span>
                          {branch.code && <span className="text-muted text-xs mr-2">({branch.code})</span>}
                        </td>
                        <td className="px-4 py-3 text-cream ltr-num text-left">
                          {branch.invoices.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-cream font-bold ltr-num text-left" dir="ltr">
                          {fmtNum(branch.salesInclVAT)}
                        </td>
                        <td className="px-4 py-3 text-cream ltr-num text-left" dir="ltr">
                          {fmtNum(branch.salesExclVAT)}
                        </td>
                        <td className="px-4 py-3 text-red font-black ltr-num text-left" dir="ltr">
                          {fmtNum(branch.vat)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-green/10 border-t-2 border-green/30">
                      <td className="px-4 py-3" colSpan={2}>
                        <span className="text-green font-black text-base">الإجمالي</span>
                      </td>
                      <td className="px-4 py-3 text-green font-bold ltr-num text-left">
                        {displayTotals.invoices.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-green font-black ltr-num text-left" dir="ltr">
                        {fmtNum(displayTotals.salesInclVAT)}
                      </td>
                      <td className="px-4 py-3 text-green font-bold ltr-num text-left" dir="ltr">
                        {fmtNum(displayTotals.salesExclVAT)}
                      </td>
                      <td className="px-4 py-3 text-red font-black text-xl ltr-num text-left" dir="ltr">
                        {fmtNum(displayTotals.vat)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* تذييل */}
              <div className="px-6 py-4 border-t border-line bg-card-hi/50">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="space-y-1 text-xs text-muted">
                    <p>🧮 طريقة الحساب: الأسعار شاملة الضريبة (15%) — الضريبة = المبيعات × (15 ÷ 115)</p>
                    <p>📅 الفترة: 1 {MONTHS_AR[month]} {year} — {new Date(year, month, 0).getDate()} {MONTHS_AR[month]} {year}</p>
                    {branchFilter !== "all" && (
                      <p className="text-purple-400">🏪 مفلتر للفرع: {selectedBranch?.name}</p>
                    )}
                    <p className="text-muted/60 text-xs mt-1">💡 انقر على صف لعرض فرع واحد، ثم اطبع</p>
                  </div>
                  <div className="text-center border border-red/30 rounded-xl px-6 py-3 bg-red/5">
                    <p className="text-muted text-xs mb-1">إجمالي الضريبة المستحقة</p>
                    <p className="text-red font-black text-2xl ltr-num" dir="ltr">
                      {fmtNum(displayTotals.vat)}
                    </p>
                    <p className="text-muted text-xs">ريال سعودي</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ملاحظة */}
            <div className="bg-amber/5 border border-amber/20 rounded-2xl px-5 py-4">
              <p className="text-amber text-sm font-bold mb-1">⚠️ ملاحظة مهمة للمحاسب</p>
              <ul className="text-muted text-xs space-y-1 list-disc list-inside">
                <li>الأرقام مبنية على بيانات مزامنة Aronium POS فقط (لا تشمل المبيعات اليدوية)</li>
                <li>يُفترض أن أسعار البيع شاملة للضريبة 15% — تأكد من إعدادات Aronium</li>
                <li>المرتجعات مُستقطعة من الإجمالي قبل حساب الضريبة</li>
                <li>يُنصح بمراجعة الأرقام مع تقارير Aronium المباشرة قبل التقديم الضريبي</li>
              </ul>
            </div>
          </>
        )}

        {loading && !data && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </>
  );
}
