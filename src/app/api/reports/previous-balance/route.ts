import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId");
  const currentDate = url.searchParams.get("date");

  if (!branchId || !currentDate) {
    return NextResponse.json({ error: "branchId and date required" }, { status: 400 });
  }

  try {
    // تاريخ اليوم السابق
    const current = new Date(currentDate);
    current.setDate(current.getDate() - 1);
    const previousDate = current.toISOString().split("T")[0];

    // جلب تقرير اليوم السابق — يقبل submitted أو approved
    const { data: prev } = await supabase
      .from("daily_reports" as any)
      .select("id, report_date, notes")
      .eq("branch_id", branchId)
      .eq("report_date", previousDate)
      .in("status", ["submitted", "approved"])
      .maybeSingle();

    if (!prev || !(prev as any).notes) {
      return NextResponse.json({
        data: { hasPrevious: false, previousDate, hashi: 0, sheep: 0, beef: 0 },
      });
    }

    // استخراج المتبقي من step5Named داخل notes
    let hashi = 0, sheep = 0, beef = 0;
    try {
      const notes = JSON.parse((prev as any).notes);
      const s5 = notes.step5Named || {};
      hashi = parseFloat(s5.hashi_remaining || 0);
      sheep = parseFloat(s5.sheep_remaining || 0);
      beef  = parseFloat(s5.beef_remaining  || 0);
    } catch { /* notes غير JSON */ }

    return NextResponse.json({
      data: {
        hasPrevious: true,
        previousDate: (prev as any).report_date,
        previousReportId: (prev as any).id,
        hashi,
        sheep,
        beef,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
