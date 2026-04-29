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
    // أحدث تقرير قبل التاريخ الحالي (ليس بالضرورة يوم واحد فقط)
    const { data: prev } = await supabase
      .from("daily_reports" as any)
      .select("id, report_date, notes, status")
      .eq("branch_id", branchId)
      .lt("report_date", currentDate)
      .order("report_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousDate = (prev as any)?.report_date ?? null;

    if (!prev || !(prev as any).notes) {
      return NextResponse.json({
        data: { hasPrevious: false, previousDate: previousDate ?? "", hashi: 0, sheep: 0, beef: 0 },
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
        previousStatus: (prev as any).status,
        hashi,
        sheep,
        beef,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
