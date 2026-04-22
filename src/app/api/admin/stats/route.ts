import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function getRiyadhDateRange(period: string, from?: string, to?: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const todayRiyadh = fmt.format(new Date());

  if (period === "custom" && from && to) return { from, to };

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));

  if (period === "daily") {
    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, "0"), d = String(now.getDate()).padStart(2, "0");
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const yy = yesterday.getFullYear(), ym = String(yesterday.getMonth() + 1).padStart(2, "0"), yd = String(yesterday.getDate()).padStart(2, "0");
    return { from: `${yy}-${ym}-${yd}`, to: `${y}-${m}-${d}` };
  }
  if (period === "weekly") {
    const end = new Date(now);
    const start = new Date(now); start.setDate(start.getDate() - 6);
    const fe = [end.getFullYear(), String(end.getMonth() + 1).padStart(2, "0"), String(end.getDate()).padStart(2, "0")].join("-");
    const fs = [start.getFullYear(), String(start.getMonth() + 1).padStart(2, "0"), String(start.getDate()).padStart(2, "0")].join("-");
    return { from: fs, to: fe };
  }
  if (period === "monthly") {
    const start = new Date(now); start.setDate(1);
    const fs = [start.getFullYear(), String(start.getMonth() + 1).padStart(2, "0"), "01"].join("-");
    return { from: fs, to: todayRiyadh };
  }
  if (period === "yearly") {
    return { from: `${now.getFullYear()}-01-01`, to: todayRiyadh };
  }
  return { from: todayRiyadh, to: todayRiyadh };
}

const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// ───── استخراج بيانات مفصلة من notes ─────
function enrichReport(report: any): any {
  if (!report) return report;

  let notes: any = null;
  if (report.notes && typeof report.notes === "string") {
    try { notes = JSON.parse(report.notes); } catch { /* ignore */ }
  }

  // ── 1. المبيعات الإجمالية ──
  if (!toN(report.total_sales) && notes?.step2Named?.total_sales) {
    report.total_sales = toN(notes.step2Named.total_sales);
  }

  // ── 2. عدد الفواتير ──
  if (!toN(report.invoice_count) && notes?.step2Named?.invoice_count) {
    report.invoice_count = toN(notes.step2Named.invoice_count);
  }

  // ── 3. طرق الدفع: كاش / شبكة / تحويل / آجل ──
  // جرّب step2Named أولاً ثم step3Named ثم step6Named
  const step2 = notes?.step2Named ?? {};
  const step3 = notes?.step3Named ?? {};
  const step6 = notes?.step6Named ?? {};

  // الكاش
  report.cash = toN(report.cash)
    || toN(step2.cash) || toN(step2.cash_amount)
    || toN(step3.cash) || toN(step3.cash_amount)
    || toN(step6.cash) || toN(step6.cash_amount);

  // الشبكة
  report.network = toN(report.network)
    || toN(step2.network) || toN(step2.network_amount)
    || toN(step3.network) || toN(step3.network_amount)
    || toN(step6.network) || toN(step6.network_amount);

  // التحويل
  report.transfer = toN(report.transfer)
    || toN(step2.transfer) || toN(step2.transfer_amount)
    || toN(step3.transfer) || toN(step3.transfer_amount)
    || toN(step6.transfer) || toN(step6.transfer_amount);

  // الآجل
  report.deferred = toN(report.deferred)
    || toN(step2.deferred) || toN(step2.deferred_amount)
    || toN(step3.deferred) || toN(step3.deferred_amount)
    || toN(step6.deferred) || toN(step6.deferred_amount);

  // ── 4. المصروفات ──
  report.expenses = toN(report.expenses);
  if (!report.expenses && notes?.expenses) {
    report.expenses = (notes.expenses as any[]).reduce((s: number, e: any) => s + toN(e.amount), 0);
  }

  // ── 5. إذا كل طرق الدفع صفر لكن total_sales موجود → ضع الكل في كاش كـ fallback ──
  const payTotal = report.cash + report.network + report.transfer + report.deferred;
  if (payTotal === 0 && toN(report.total_sales) > 0) {
    // حاول من cash_actual أو cash_expected
    if (toN(report.cash_actual) > 0) {
      report.cash = toN(report.cash_actual);
    }
  }

  const { notes: _notes, ...rest } = report;
  return rest;
}

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? "weekly";
  const from = url.searchParams.get("from") ?? undefined;
  const to   = url.searchParams.get("to")   ?? undefined;

  const range = getRiyadhDateRange(period, from, to);

  const [branchesRes, reportsRes] = await Promise.all([
    supabase.from("branches").select("id, name, code, slug, is_active").order("name"),
    supabase
      .from("daily_reports")
      .select("id, branch_id, report_date, status, total_sales, invoice_count, cash_expected, cash_actual, cash_difference, submitted_at, notes")
      .gte("report_date", range.from)
      .lte("report_date", range.to)
      .order("report_date", { ascending: false }),
  ]);

  if (branchesRes.error) return NextResponse.json({ error: branchesRes.error.message }, { status: 400 });
  if (reportsRes.error) return NextResponse.json({ error: reportsRes.error.message }, { status: 400 });

  const branches = (branchesRes.data ?? []) as Array<{ id: string; name: string; slug: string; code: string; is_active: boolean }>;
  const reports  = (reportsRes.data ?? []).map(enrichReport);

  // ── Aggregate Totals ──
  const totalSales        = reports.reduce((s, r) => s + toN(r.total_sales), 0);
  const totalInvoices     = reports.reduce((s, r) => s + toN(r.invoice_count), 0);
  const totalCash         = reports.reduce((s, r) => s + toN(r.cash), 0);
  const totalNetwork      = reports.reduce((s, r) => s + toN(r.network), 0);
  const totalTransfer     = reports.reduce((s, r) => s + toN(r.transfer), 0);
  const totalDeferred     = reports.reduce((s, r) => s + toN(r.deferred), 0);
  const totalExpenses     = reports.reduce((s, r) => s + toN(r.expenses), 0);
  const totalCashVariance = reports.reduce((s, r) => s + Math.abs(toN(r.cash_difference)), 0);
  const reportCount       = reports.length;

  // ── Per-Branch Breakdown ──
  const branchStats: Record<string, {
    id: string; name: string; slug: string; code: string;
    totalSales: number; invoiceCount: number; cashVariance: number;
    cash: number; network: number; transfer: number; deferred: number; expenses: number;
    reportCount: number; reports: typeof reports;
  }> = {};

  for (const b of branches) {
    branchStats[b.id] = {
      id: b.id, name: b.name, slug: b.slug, code: b.code,
      totalSales: 0, invoiceCount: 0, cashVariance: 0,
      cash: 0, network: 0, transfer: 0, deferred: 0, expenses: 0,
      reportCount: 0, reports: [],
    };
  }

  for (const r of reports) {
    const bs = branchStats[r.branch_id];
    if (bs) {
      bs.totalSales   += toN(r.total_sales);
      bs.invoiceCount += toN(r.invoice_count);
      bs.cashVariance += Math.abs(toN(r.cash_difference));
      bs.cash         += toN(r.cash);
      bs.network      += toN(r.network);
      bs.transfer     += toN(r.transfer);
      bs.deferred     += toN(r.deferred);
      bs.expenses     += toN(r.expenses);
      bs.reportCount++;
      bs.reports.push(r);
    }
  }

  // ── Daily Totals for Chart ──
  const dailyMap: Record<string, { date: string; sales: number; invoices: number }> = {};
  for (const r of reports) {
    if (!dailyMap[r.report_date]) {
      dailyMap[r.report_date] = { date: r.report_date, sales: 0, invoices: 0 };
    }
    dailyMap[r.report_date].sales    += toN(r.total_sales);
    dailyMap[r.report_date].invoices += toN(r.invoice_count);
  }
  const dailyTotals = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    range,
    summary: {
      totalSales, totalInvoices,
      totalCash, totalNetwork, totalTransfer, totalDeferred, totalExpenses,
      totalCashVariance, reportCount, branchCount: branches.length,
    },
    branchStats: Object.values(branchStats),
    dailyTotals,
  });
}
