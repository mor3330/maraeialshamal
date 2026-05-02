import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const url = new URL(request.url);
  const branchId   = url.searchParams.get("branchId");
  const currentDate = url.searchParams.get("date");

  if (!branchId || !currentDate) {
    return NextResponse.json({ error: "branchId and date required" }, { status: 400 });
  }

  try {
    // ══════════════════════════════════════════════════════════════
    // الإصلاح: رصيد أمس = تقرير اليوم السابق مباشرة (currentDate - 1)
    // إذا لم يوجد تقرير ليوم أمس → يُرجع 0 (وليس آخر تقرير قديم)
    // ══════════════════════════════════════════════════════════════
    const curDate = new Date(`${currentDate}T00:00:00Z`);
    curDate.setUTCDate(curDate.getUTCDate() - 1);
    const yesterdayDate = curDate.toISOString().slice(0, 10); // YYYY-MM-DD

    // ابحث عن تقرير بتاريخ أمس بالضبط
    const { data: prev } = await supabase
      .from("daily_reports" as any)
      .select("id, report_date, notes, status")
      .eq("branch_id", branchId)
      .eq("report_date", yesterdayDate)
      .maybeSingle();

    // لا يوجد تقرير ليوم أمس → رصيد = 0
    if (!prev) {
      return NextResponse.json({
        data: {
          hasPrevious: false,
          previousDate: yesterdayDate,
          hashi: 0,
          sheep: 0,
          beef: 0,
        },
      });
    }

    let hashi = 0, sheep = 0, beef = 0;

    // ── أولاً: حاول من جدول step_data (يشمل تعديلات الأدمن) ──
    try {
      const { data: sd } = await supabase
        .from("step_data" as any)
        .select("named_values")
        .eq("report_id", (prev as any).id)
        .eq("step_number", 5)
        .maybeSingle();

      if (sd && (sd as any).named_values) {
        const nv = (sd as any).named_values as Record<string, unknown>;
        const h = parseFloat(String(nv.hashi_remaining ?? 0));
        const s = parseFloat(String(nv.sheep_remaining ?? 0));
        const b = parseFloat(String(nv.beef_remaining  ?? 0));
        if (Number.isFinite(h)) hashi = h;
        if (Number.isFinite(s)) sheep = s;
        if (Number.isFinite(b)) beef  = b;
      }
    } catch { /* step_data غير متاح */ }

    // ── ثانياً: fallback من notes إذا لم تُعثر على بيانات ──
    if (hashi === 0 && sheep === 0 && beef === 0 && (prev as any).notes) {
      try {
        const notes = JSON.parse((prev as any).notes);
        const s5 = notes.step5Named || {};
        hashi = parseFloat(s5.hashi_remaining || 0) || 0;
        sheep = parseFloat(s5.sheep_remaining || 0) || 0;
        beef  = parseFloat(s5.beef_remaining  || 0) || 0;
      } catch { /* notes غير JSON */ }
    }

    return NextResponse.json({
      data: {
        hasPrevious: true,
        previousDate:     (prev as any).report_date,
        previousReportId: (prev as any).id,
        previousStatus:   (prev as any).status,
        hashi,
        sheep,
        beef,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
