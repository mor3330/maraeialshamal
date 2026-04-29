import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function enrichReport(report: any): any {
  if (!report?.notes) return report;
  let notesObj: any = null;
  try { notesObj = JSON.parse(report.notes); } catch { return report; }
  if (!toN(report.total_sales) && notesObj.step2Named?.total_sales) {
    report.total_sales = toN(notesObj.step2Named.total_sales);
  }
  if (toN(report.cash_expected) === 0 && toN(report.cash_actual) === 0) {
    const step6 = notesObj.step6Named;
    if (step6?.cash_amount) {
      const cash = toN(step6.cash_amount);
      const expTotal = (notesObj.expenses || []).reduce((s: number, e: any) => s + toN(e.amount), 0);
      report.cash_expected = cash - expTotal;
      report.cash_actual = cash;
      report.cash_difference = cash - (cash - expTotal);
    }
  }
  return report;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await params;
  const supabase = createServiceClient();
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const limit = url.searchParams.get("limit") || "10";

  try {
    if (date) {
      const { data, error } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("branch_id", branchId)
        .eq("report_date", date)
        .single();
      if (error) return NextResponse.json({ data: null }, { status: 200 });
      return NextResponse.json({ data: enrichReport(data) });
    } else {
      const { data, error } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("branch_id", branchId)
        .in("status", ["draft", "submitted", "approved", "flagged"])
        .order("report_date", { ascending: false })
        .limit(parseInt(limit));
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ data: (data || []).map(enrichReport) });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
