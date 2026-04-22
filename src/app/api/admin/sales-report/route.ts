// @ts-nocheck
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const toN = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export async function GET(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("from");
  const dateTo   = searchParams.get("to");
  if (!dateFrom || !dateTo) return NextResponse.json({ error: "from و to مطلوبان" }, { status: 400 });

  const { data: branches } = await supabase
    .from("branches").select("id, name").eq("is_active", true).order("name");
  if (!branches?.length) return NextResponse.json({ branches: [], summary: null });

  const { data: reports } = await supabase
    .from("daily_reports")
    .select("id, branch_id, report_date, total_sales, notes")
    .gte("report_date", dateFrom)
    .lte("report_date", dateTo)
    .in("status", ["submitted", "approved"]);

  const branchResults = branches.map((branch: any) => {
    const bReports = (reports ?? []).filter((r: any) => r.branch_id === branch.id);

    let cash = 0, network = 0, transfer = 0, deferred = 0, expenses = 0;

    bReports.forEach((r: any) => {
      let notes: any = {};
      try { notes = typeof r.notes === "string" ? JSON.parse(r.notes) : (r.notes ?? {}); } catch {}

      // الدفعات من notes.payments أو step6Named
      const payments: any[] = notes.payments ?? [];
      const s6 = notes.step6Named ?? {};

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
        // fallback إلى step6Named
        cash     += toN(s6.cash_amount);
        network  += toN(s6.network_amount);
        transfer += toN(s6.transfer_amount);
        deferred += toN(s6.deferred_amount);
      }

      // المصروفات
      const expArr: any[] = notes.expenses ?? [];
      expenses += expArr.reduce((s: number, e: any) => s + toN(e.amount), 0);
    });

    const total = cash + network + transfer + deferred;

    return {
      branchId: branch.id,
      branchName: branch.name,
      cash, network, transfer, deferred,
      total, expenses,
      reportCount: bReports.length,
    };
  });

  const summary = {
    cash:     branchResults.reduce((s, b) => s + b.cash, 0),
    network:  branchResults.reduce((s, b) => s + b.network, 0),
    transfer: branchResults.reduce((s, b) => s + b.transfer, 0),
    deferred: branchResults.reduce((s, b) => s + b.deferred, 0),
    total:    branchResults.reduce((s, b) => s + b.total, 0),
    expenses: branchResults.reduce((s, b) => s + b.expenses, 0),
  };

  return NextResponse.json({ branches: branchResults, summary });
}
