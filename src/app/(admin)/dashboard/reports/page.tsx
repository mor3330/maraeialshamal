"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

interface Report {
  id: string;
  branch_id: string;
  report_date: string;
  status: string | null;
  total_sales: number | null;
  invoice_count: number | null;
  cash_expected: number | null;
  cash_actual: number | null;
  cash_difference: number | null;
  submitted_at: string;
}

interface Branch { id: string; name: string; }

const fmt = (n: unknown) => {
  const num = Number(n);
  return Number.isFinite(num) ? num.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "0";
};

const fmtDate = (v: string) =>
  new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${v}T00:00:00`));

const fmtTime = (v: string) =>
  new Intl.DateTimeFormat("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" })
    .format(new Date(v));

const STATUS_MAP: Record<string, { label: string; cls: string; dot: string }> = {
  submitted: { label: "مرفوع",   cls: "bg-sky-500/10 text-sky-300 border-sky-500/20",  dot: "bg-sky-400"  },
  approved:  { label: "معتمد",   cls: "bg-green/10 text-green border-green/20",         dot: "bg-green"    },
  flagged:   { label: "ملاحظات", cls: "bg-amber/10 text-amber border-amber/20",         dot: "bg-amber"    },
  draft:     { label: "مسودة",   cls: "bg-card-hi text-muted border-line",              dot: "bg-muted/40" },
};

function StatusBadge({ status }: { status: string | null }) {
  const m = STATUS_MAP[status ?? "draft"] ?? STATUS_MAP.draft;
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

// دالة للحصول على رقم الأسبوع في الشهر
function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  const dayOfWeek = firstDay.getDay();
  return Math.ceil((dayOfMonth + dayOfWeek) / 7);
}

// تجميع التقارير حسب السنة/الشهر/الأسبوع
function groupReportsByCalendar(reports: Report[]) {
  const grouped: Map<number, Map<number, Map<number, Report[]>>> = new Map();
  
  reports.forEach(report => {
    const date = new Date(`${report.report_date}T00:00:00`);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11
    const week = getWeekOfMonth(date);
    
    if (!grouped.has(year)) grouped.set(year, new Map());
    if (!grouped.get(year)!.has(month)) grouped.get(year)!.set(month, new Map());
    if (!grouped.get(year)!.get(month)!.has(week)) grouped.get(year)!.get(month)!.set(week, []);
    
    grouped.get(year)!.get(month)!.get(week)!.push(report);
  });
  
  return grouped;
}

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [branches, setBranches] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  
  // State للتحكم في فتح/إغلاق الأقسام
  const [openYears, setOpenYears] = useState<Set<number>>(new Set());
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set()); // "year-month"
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set()); // "year-month-week"

  const load = useCallback(async () => {
    try {
      const [bRes, rRes] = await Promise.all([
        fetch("/api/admin/branches"),
        fetch("/api/reports?limit=200"),
      ]);
      const bJson = await bRes.json();
      const rJson = await rRes.json();
      const bMap = new Map<string, string>((bJson.branches ?? []).map((b: Branch) => [b.id, b.name]));
      setBranches(bMap);
      setReports(rJson.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-muted text-center py-16">جاري التحميل...</div>
      </div>
    );
  }

  const groupedReports = groupReportsByCalendar(reports);
  const years = Array.from(groupedReports.keys()).sort((a, b) => b - a); // أحدث أولاً

  const toggleYear = (year: number) => {
    setOpenYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const toggleMonth = (year: number, month: number) => {
    const key = `${year}-${month}`;
    setOpenMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleWeek = (year: number, month: number, week: number) => {
    const key = `${year}-${month}-${week}`;
    setOpenWeeks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-cream">التقارير</h1>
          <p className="text-muted text-sm mt-1">مجموعة حسب السنة والشهر والأسبوع</p>
        </div>
        <button onClick={load} className="rounded-2xl border border-line bg-card-hi px-4 py-2 text-sm text-muted hover:text-cream transition-colors">
          ↻ تحديث
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-3xl border border-line bg-card p-12 text-center text-muted">لا توجد تقارير بعد.</div>
      ) : (
        <div className="space-y-4">
          {years.map(year => {
            const months = Array.from(groupedReports.get(year)!.keys()).sort((a, b) => b - a);
            const isYearOpen = openYears.has(year);
            const yearReportsCount = Array.from(groupedReports.get(year)!.values())
              .flatMap(monthMap => Array.from(monthMap.values()))
              .flatMap(weekReports => weekReports).length;
            
            return (
              <div key={year} className="rounded-3xl border border-line bg-card overflow-hidden">
                {/* Year Header */}
                <button
                  onClick={() => toggleYear(year)}
                  className="w-full flex items-center justify-between p-5 hover:bg-card-hi transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-black text-xl text-cream">{year}</p>
                      <p className="text-muted text-sm">{yearReportsCount} تقرير</p>
                    </div>
                  </div>
                  <span className="text-muted text-2xl">{isYearOpen ? "▼" : "◀"}</span>
                </button>

                {/* Months */}
                {isYearOpen && (
                  <div className="border-t border-line bg-bg/30 p-3 space-y-3">
                    {months.map(month => {
                      const weeks = Array.from(groupedReports.get(year)!.get(month)!.keys()).sort();
                      const isMonthOpen = openMonths.has(`${year}-${month}`);
                      const monthReportsCount = Array.from(groupedReports.get(year)!.get(month)!.values())
                        .flatMap(weekReports => weekReports).length;
                      
                      return (
                        <div key={month} className="rounded-2xl border border-line bg-card overflow-hidden">
                          {/* Month Header */}
                          <button
                            onClick={() => toggleMonth(year, month)}
                            className="w-full flex items-center justify-between p-4 hover:bg-card-hi transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="font-bold text-lg text-cream">{MONTH_NAMES[month]}</p>
                                <p className="text-muted text-xs">{monthReportsCount} تقرير</p>
                              </div>
                            </div>
                            <span className="text-muted">{isMonthOpen ? "▼" : "◀"}</span>
                          </button>

                          {/* Weeks */}
                          {isMonthOpen && (
                            <div className="border-t border-line bg-bg/50 p-2 space-y-2">
                              {weeks.map(week => {
                                const weekReports = groupedReports.get(year)!.get(month)!.get(week)!;
                                const isWeekOpen = openWeeks.has(`${year}-${month}-${week}`);
                                
                                return (
                                  <div key={week} className="rounded-xl border border-line bg-card overflow-hidden">
                                    {/* Week Header */}
                                    <button
                                      onClick={() => toggleWeek(year, month, week)}
                                      className="w-full flex items-center justify-between p-3 hover:bg-card-hi transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="text-right">
                                          <p className="font-bold text-cream">الأسبوع {week}</p>
                                          <p className="text-muted text-xs">{weekReports.length} تقرير</p>
                                        </div>
                                      </div>
                                      <span className="text-muted text-sm">{isWeekOpen ? "▼" : "◀"}</span>
                                    </button>

                                    {/* Reports */}
                                    {isWeekOpen && (
                                      <div className="border-t border-line p-2 space-y-2">
                                        {weekReports.map(r => {
                                          const diff = Number(r.cash_difference ?? 0);
                                          const st = STATUS_MAP[r.status ?? "draft"] ?? STATUS_MAP.draft;
                                          
                                          return (
                                            <Link
                                              key={r.id}
                                              href={`/dashboard/reports/${r.id}`}
                                              className="group rounded-xl border border-line bg-card-hi hover:border-green/30 hover:bg-card transition-all block p-4"
                                            >
                                              {/* Row 1: اسم الفرع + حالة + تاريخ */}
                                              <div className="flex items-center justify-between gap-3 mb-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
                                                  <div className="min-w-0">
                                                    <p className="font-bold text-cream text-sm group-hover:text-green transition-colors truncate">
                                                      {branches.get(r.branch_id) ?? "فرع غير معروف"}
                                                    </p>
                                                    <p className="text-muted text-xs">
                                                      {fmtDate(r.report_date)} · {fmtTime(r.submitted_at)}
                                                    </p>
                                                  </div>
                                                </div>
                                                <StatusBadge status={r.status} />
                                              </div>

                                              {/* Row 2: أرقام */}
                                              <div className="grid grid-cols-4 gap-2">
                                                <div className="rounded-lg bg-bg border border-line px-2 py-1.5">
                                                  <p className="text-muted text-xs mb-0.5">المبيعات</p>
                                                  <p className="font-bold text-cream ltr-num text-xs" dir="ltr">{fmt(r.total_sales)}</p>
                                                </div>
                                                <div className="rounded-lg bg-bg border border-line px-2 py-1.5">
                                                  <p className="text-muted text-xs mb-0.5">الفواتير</p>
                                                  <p className="font-bold text-cream ltr-num text-xs" dir="ltr">{fmt(r.invoice_count)}</p>
                                                </div>
                                                <div className="rounded-lg bg-bg border border-line px-2 py-1.5">
                                                  <p className="text-muted text-xs mb-0.5">كاش متوقع</p>
                                                  <p className="font-bold text-cream ltr-num text-xs" dir="ltr">{fmt(r.cash_expected)}</p>
                                                </div>
                                                <div className={`rounded-lg border px-2 py-1.5 ${Math.abs(diff) >= 0.01 ? "bg-red/10 border-red/20" : "bg-green/10 border-green/20"}`}>
                                                  <p className="text-muted text-xs mb-0.5">فرق الكاش</p>
                                                  <p className={`font-bold ltr-num text-xs ${Math.abs(diff) >= 0.01 ? "text-red" : "text-green"}`} dir="ltr">
                                                    {Math.abs(diff) >= 0.01 ? `${diff > 0 ? "+" : ""}${diff.toFixed(2)}` : "✓ 0"}
                                                  </p>
                                                </div>
                                              </div>
                                            </Link>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
