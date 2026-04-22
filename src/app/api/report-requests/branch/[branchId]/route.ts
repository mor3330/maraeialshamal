import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET: جلب طلبات التقارير لفرع معين — يُغلق تلقائياً الطلبات المكتملة
export async function GET(
  _request: Request,
  { params }: { params: { branchId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { branchId } = params;

    // جلب كل الطلبات المعلقة
    const { data: pending, error } = await supabase
      .from("report_requests")
      .select("*")
      .eq("branch_id", branchId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!pending || pending.length === 0) return NextResponse.json([]);

    // جلب التقارير المرسلة لنفس التواريخ
    const dates = pending.map((r: any) => r.requested_date);
    const { data: submitted } = await supabase
      .from("daily_reports")
      .select("report_date")
      .eq("branch_id", branchId)
      .in("report_date", dates)
      .in("status", ["submitted", "approved"]);

    const submittedDates = new Set((submitted || []).map((r: any) => r.report_date));

    // أغلق الطلبات التي لها تقارير مكتملة
    const toClose = pending.filter((r: any) => submittedDates.has(r.requested_date));
    if (toClose.length > 0) {
      await supabase
        .from("report_requests")
        .update({ status: "completed", completed_at: new Date().toISOString() } as never)
        .in("id", toClose.map((r: any) => r.id));
    }

    // أرجع فقط الطلبات التي لم تُغلق
    const stillPending = pending.filter((r: any) => !submittedDates.has(r.requested_date));
    return NextResponse.json(stillPending);
  } catch (error) {
    console.error("Error in GET /api/report-requests/branch:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
