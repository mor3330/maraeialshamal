// @ts-nocheck
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const toN = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function fmt(n: number) { return n === 0 ? "" : n; }

export async function GET(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("from");
  const dateTo   = searchParams.get("to");
  if (!dateFrom || !dateTo) return NextResponse.json({ error: "from و to مطلوبان" }, { status: 400 });

  // ── جلب البيانات ──
  const [branchesRes, reportsRes] = await Promise.all([
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    supabase.from("daily_reports")
      .select("id, branch_id, report_date, status, total_sales, cash_expected, cash_actual, notes, submitted_at")
      .gte("report_date", dateFrom)
      .lte("report_date", dateTo)
      .in("status", ["submitted", "approved"])
      .order("report_date", { ascending: true })
      .order("branch_id"),
  ]);

  const branches: { id: string; name: string }[] = branchesRes.data ?? [];
  const reports = reportsRes.data ?? [];

  // ── parse notes لكل تقرير ──
  const parsed = reports.map((r: any) => {
    let notes: any = {};
    try { notes = typeof r.notes === "string" ? JSON.parse(r.notes) : (r.notes ?? {}); } catch {}
    const payments: any[] = notes.payments ?? [];
    const s6 = notes.step6Named ?? {};
    const s1 = notes.step1Named ?? {};
    const s3 = notes.step3Named ?? {};
    const s4 = notes.step4Named ?? {};
    const s5 = notes.step5Named ?? {};
    const expenses: any[] = notes.expenses ?? [];
    const expensesTotal = expenses.reduce((s: number, e: any) => s + toN(e.amount), 0);

    let cash = 0, network = 0, transfer = 0, deferred = 0;
    if (payments.length > 0) {
      payments.forEach((p: any) => {
        const amt = toN(p.amount);
        switch ((p.methodCode ?? "").toLowerCase()) {
          case "cash":     cash     += amt; break;
          case "network":  network  += amt; break;
          case "transfer": transfer += amt; break;
          case "deferred": deferred += amt; break;
        }
      });
    } else {
      cash     = toN(s6.cash_amount);
      network  = toN(s6.network_amount);
      transfer = toN(s6.transfer_amount);
      deferred = toN(s6.deferred_amount);
    }

    const totalSales = cash + network + transfer + deferred || toN(r.total_sales);
    const cashDiff   = toN(r.cash_actual) - toN(r.cash_expected);

    return {
      reportId:    r.id,
      branchId:    r.branch_id,
      branchName:  branches.find(b => b.id === r.branch_id)?.name ?? r.branch_id,
      date:        r.report_date,
      status:      r.status === "approved" ? "معتمد" : "مرسل",
      submittedAt: r.submitted_at ? r.submitted_at.substring(0, 16).replace("T", " ") : "",
      // مبيعات
      totalSales, cash, network, transfer, deferred,
      expenses: expensesTotal,
      netCash: cash - expensesTotal,
      cashExpected: toN(r.cash_expected),
      cashActual:   toN(r.cash_actual),
      cashDiff,
      // لحوم - وارد
      hashiIn:  toN(s1.hashi_weight),
      sheepIn:  toN(s1.sheep_weight),
      beefIn:   toN(s1.beef_weight),
      // لحوم - مباع
      hashiBoneW: toN(s3.hashi_bone_weight), hashiBoneP: toN(s3.hashi_bone_price),
      hashiCleanW: toN(s3.hashi_clean_weight), hashiCleanP: toN(s3.hashi_clean_price),
      sheepW: toN(s3.sheep_weight), sheepP: toN(s3.sheep_price),
      beefBoneW: toN(s3.beef_bone_weight), beefBoneP: toN(s3.beef_bone_price),
      beefCleanW: toN(s3.beef_clean_weight), beefCleanP: toN(s3.beef_clean_price),
      // صادر
      hashiExport: toN(s4.hashi_export), sheepExport: toN(s4.sheep_export), beefExport: toN(s4.beef_export),
      // هالك
      hashiWaste: toN(s4.hashi_waste), sheepWaste: toN(s4.sheep_waste), beefWaste: toN(s4.beef_waste),
      // متبقي
      hashiRem: toN(s5.hashi_remaining), sheepRem: toN(s5.sheep_remaining), beefRem: toN(s5.beef_remaining),
    };
  });

  const wb = XLSX.utils.book_new();

  // ══════════════════════════════════════
  // شيت 1: ملخص المبيعات اليومي
  // ══════════════════════════════════════
  const salesRows = parsed.map(r => ({
    "التاريخ":        r.date,
    "الفرع":          r.branchName,
    "الحالة":         r.status,
    "إجمالي المبيعات": fmt(r.totalSales),
    "كاش":            fmt(r.cash),
    "شبكة":           fmt(r.network),
    "تحويل":          fmt(r.transfer),
    "آجل":            fmt(r.deferred),
    "المصروفات":      fmt(r.expenses),
    "صافي الكاش":     fmt(r.netCash),
    "كاش متوقع":      fmt(r.cashExpected),
    "كاش فعلي":       fmt(r.cashActual),
    "الفرق":          r.cashDiff === 0 ? "" : r.cashDiff,
    "وقت الإرسال":    r.submittedAt,
  }));

  const ws1 = XLSX.utils.json_to_sheet(salesRows, { origin: "A3" });
  XLSX.utils.sheet_add_aoa(ws1, [["ملخص المبيعات اليومي"], [`الفترة: ${dateFrom} — ${dateTo}`]], { origin: "A1" });
  ws1["!cols"] = [10,20,8,14,10,10,10,10,12,12,12,12,10,16].map(w => ({ wch: w }));
  ws1["!dir"] = "RTL";
  XLSX.utils.book_append_sheet(wb, ws1, "المبيعات اليومية");

  // ══════════════════════════════════════
  // شيت 2: ملخص الفروع (إجماليات)
  // ══════════════════════════════════════
  const branchSummary = branches.map(b => {
    const bRows = parsed.filter(r => r.branchId === b.id);
    const sum = (key: keyof typeof bRows[0]) =>
      bRows.reduce((s, r) => s + (typeof r[key] === "number" ? r[key] as number : 0), 0);
    return {
      "الفرع":           b.name,
      "عدد التقارير":    bRows.length,
      "إجمالي المبيعات":  fmt(sum("totalSales")),
      "كاش":             fmt(sum("cash")),
      "شبكة":            fmt(sum("network")),
      "تحويل":           fmt(sum("transfer")),
      "آجل":             fmt(sum("deferred")),
      "المصروفات":       fmt(sum("expenses")),
      "صافي الكاش":      fmt(sum("netCash")),
    };
  }).filter(b => (b["عدد التقارير"] as number) > 0);

  // صف الإجماليات
  const totRow = {
    "الفرع": "الإجمالي",
    "عدد التقارير": branchSummary.reduce((s, b) => s + (b["عدد التقارير"] as number), 0),
    "إجمالي المبيعات": branchSummary.reduce((s, b) => s + toN(b["إجمالي المبيعات"]), 0) || "",
    "كاش": branchSummary.reduce((s, b) => s + toN(b["كاش"]), 0) || "",
    "شبكة": branchSummary.reduce((s, b) => s + toN(b["شبكة"]), 0) || "",
    "تحويل": branchSummary.reduce((s, b) => s + toN(b["تحويل"]), 0) || "",
    "آجل": branchSummary.reduce((s, b) => s + toN(b["آجل"]), 0) || "",
    "المصروفات": branchSummary.reduce((s, b) => s + toN(b["المصروفات"]), 0) || "",
    "صافي الكاش": branchSummary.reduce((s, b) => s + toN(b["صافي الكاش"]), 0) || "",
  };

  const ws2 = XLSX.utils.json_to_sheet([...branchSummary, totRow], { origin: "A3" });
  XLSX.utils.sheet_add_aoa(ws2, [["ملخص الفروع"], [`الفترة: ${dateFrom} — ${dateTo}`]], { origin: "A1" });
  ws2["!cols"] = [20, 12, 16, 12, 12, 12, 12, 12, 14].map(w => ({ wch: w }));
  ws2["!dir"] = "RTL";
  XLSX.utils.book_append_sheet(wb, ws2, "ملخص الفروع");

  // ══════════════════════════════════════
  // شيت 3: بيانات اللحوم
  // ══════════════════════════════════════
  const meatRows = parsed.map(r => ({
    "التاريخ": r.date,
    "الفرع":   r.branchName,
    // وارد
    "حاشي وارد (كجم)":    fmt(r.hashiIn),
    "غنم وارد (كجم)":     fmt(r.sheepIn),
    "عجل وارد (كجم)":     fmt(r.beefIn),
    // مباع - حاشي
    "حاشي عظم وزن":  fmt(r.hashiBoneW),  "حاشي عظم سعر":  fmt(r.hashiBoneP),
    "حاشي نظيف وزن": fmt(r.hashiCleanW), "حاشي نظيف سعر": fmt(r.hashiCleanP),
    // مباع - غنم
    "غنم وزن": fmt(r.sheepW), "غنم سعر": fmt(r.sheepP),
    // مباع - عجل
    "عجل عظم وزن":  fmt(r.beefBoneW),  "عجل عظم سعر":  fmt(r.beefBoneP),
    "عجل نظيف وزن": fmt(r.beefCleanW), "عجل نظيف سعر": fmt(r.beefCleanP),
    // صادر
    "حاشي صادر": fmt(r.hashiExport), "غنم صادر": fmt(r.sheepExport), "عجل صادر": fmt(r.beefExport),
    // هالك
    "حاشي هالك": fmt(r.hashiWaste), "غنم هالك": fmt(r.sheepWaste), "عجل هالك": fmt(r.beefWaste),
    // متبقي
    "حاشي متبقي": fmt(r.hashiRem), "غنم متبقي": fmt(r.sheepRem), "عجل متبقي": fmt(r.beefRem),
  }));

  const ws3 = XLSX.utils.json_to_sheet(meatRows, { origin: "A3" });
  XLSX.utils.sheet_add_aoa(ws3, [["بيانات اللحوم التفصيلية"], [`الفترة: ${dateFrom} — ${dateTo}`]], { origin: "A1" });
  ws3["!cols"] = Array(25).fill({ wch: 13 });
  ws3["!dir"] = "RTL";
  XLSX.utils.book_append_sheet(wb, ws3, "بيانات اللحوم");

  // ══════════════════════════════════════
  // إنتاج الملف
  // ══════════════════════════════════════
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `marai-report-${dateFrom}-to-${dateTo}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
