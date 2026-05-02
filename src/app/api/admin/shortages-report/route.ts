import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function n(v: unknown): number { const x = Number(v); return Number.isFinite(x) ? x : 0; }

export async function GET(req: NextRequest) {
  const supabase = createServiceClient();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to   = url.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from/to required" }, { status: 400 });

  try {
    // ── جلب كل التقارير في الفترة مع أسماء الفروع ──
    const { data: reports, error: repErr } = await supabase
      .from("daily_reports" as any)
      .select("id, report_date, branch_id, branches(name), notes")
      .gte("report_date", from)
      .lte("report_date", to)
      .order("report_date", { ascending: true });

    if (repErr) throw repErr;
    if (!reports || reports.length === 0) return NextResponse.json({ rows: [] });

    const reportIds = (reports as any[]).map(r => r.id);

    // ── جلب step_data للخطوات 1، 3، 4، 5 لكل التقارير ──
    const { data: stepRows } = await supabase
      .from("step_data" as any)
      .select("report_id, step_number, named_values")
      .in("report_id", reportIds)
      .in("step_number", [1, 3, 4, 5]);

    // ── بناء map: reportId → { step1, step3, step4, step5 } ──
    const stepMap: Record<string, Record<number, Record<string, unknown>>> = {};
    for (const row of (stepRows ?? []) as any[]) {
      if (!stepMap[row.report_id]) stepMap[row.report_id] = {};
      stepMap[row.report_id][row.step_number] = row.named_values ?? {};
    }

    // ── للرصيد السابق: جلب تقارير اليوم قبل "from" لكل فرع ──
    // نحتاج step5 ليوم أمس لأول يوم في الفترة
    const dayBefore = new Date(`${from}T00:00:00Z`);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    const dayBeforeStr = dayBefore.toISOString().slice(0, 10);

    const branchIds = [...new Set((reports as any[]).map(r => r.branch_id))];
    const { data: prevReports } = await supabase
      .from("daily_reports" as any)
      .select("id, branch_id, report_date")
      .in("branch_id", branchIds)
      .gte("report_date", dayBeforeStr)
      .lt("report_date", from);

    const prevReportIds = (prevReports ?? []).map((r: any) => r.id);
    let prevStepMap: Record<string, Record<string, unknown>> = {};
    if (prevReportIds.length > 0) {
      const { data: prevStepRows } = await supabase
        .from("step_data" as any)
        .select("report_id, named_values")
        .in("report_id", prevReportIds)
        .eq("step_number", 5);
      for (const row of (prevStepRows ?? []) as any[]) {
        // map: branchId → step5 named_values of yesterday
        const rep = (prevReports ?? []).find((r: any) => r.id === row.report_id);
        if (rep) prevStepMap[(rep as any).branch_id] = row.named_values ?? {};
      }
    }

    // ── لكل تقرير: احسب العجز لكل صنف ──
    // ترتيب: نبني "رصيد اليوم قبله" من خريطة متراكمة
    // branchPrevRemaining: branchId → { hashi, sheep, beef }
    const branchPrevRemaining: Record<string, { hashi: number; sheep: number; beef: number }> = {};
    for (const bId of branchIds) {
      const ps5 = prevStepMap[bId] ?? {};
      branchPrevRemaining[bId] = {
        hashi: n(ps5.hashi_remaining),
        sheep: n(ps5.sheep_remaining),
        beef:  n(ps5.beef_remaining),
      };
    }

    // نرتب التقارير بالتاريخ ثم نعالجها
    const sortedReports = [...(reports as any[])].sort((a, b) => a.report_date.localeCompare(b.report_date));

    // نجمّع النتائج حسب الفرع
    const branchMap: Record<string, {
      branchName: string;
      entries: any[];
    }> = {};

    // لتتبع الرصيد اليومي لكل فرع
    const latestPrev: Record<string, { hashi: number; sheep: number; beef: number }> = { ...branchPrevRemaining };

    // نجمع حسب branchId + date: أحياناً نفس الفرع قد يرفع تقريراً مرتين
    const processed = new Set<string>();
    for (const rep of sortedReports) {
      const key = `${rep.branch_id}__${rep.report_date}`;
      if (processed.has(key)) continue;
      processed.add(key);

      const bId   = rep.branch_id;
      const bName = (rep.branches as any)?.name ?? "فرع غير معروف";
      const steps = stepMap[rep.id] ?? {};
      const s1    = (steps[1] ?? {}) as Record<string, unknown>;
      const s3    = (steps[3] ?? {}) as Record<string, unknown>;
      const s4    = (steps[4] ?? {}) as Record<string, unknown>;
      const s5    = (steps[5] ?? {}) as Record<string, unknown>;

      // كذلك نحاول قراءة من notes fallback
      let notesS1: Record<string, unknown> = {};
      let notesS3: Record<string, unknown> = {};
      let notesS4: Record<string, unknown> = {};
      let notesS5: Record<string, unknown> = {};
      try {
        const nd = JSON.parse(rep.notes || "{}");
        notesS1 = nd.step1Named ?? {};
        notesS3 = nd.step3Named ?? {};
        notesS4 = nd.step4Named ?? {};
        notesS5 = nd.step5Named ?? {};
      } catch {}

      const g1 = (k: string) => n(s1[k] ?? notesS1[k]);
      const g3 = (k: string) => n(s3[k] ?? notesS3[k]);
      const g4 = (k: string) => n(s4[k] ?? notesS4[k]);
      const g5 = (k: string) => n(s5[k] ?? notesS5[k]);

      const prev = latestPrev[bId] ?? { hashi: 0, sheep: 0, beef: 0 };

      const calc = (animal: "hashi" | "sheep" | "beef", outKey: string) => {
        const previous = prev[animal];
        const incoming = g1(`${animal}_weight`);
        const sales    = g3(`${animal}_weight`);
        const outgoing = g4(outKey);
        const offal    = g5(`${animal}_offal`);
        const actual   = g5(`${animal}_remaining`);
        const expected = previous + incoming - sales - outgoing - offal;
        const shortage = actual - expected; // سالب = عجز
        return { previous, incoming, sales, outgoing, offal, expected, actual, shortage };
      };

      const entry = {
        date:  rep.report_date,
        hashi: calc("hashi", "hashi_outgoing"),
        sheep: calc("sheep", "sheep_outgoing_weight"),
        beef:  calc("beef",  "beef_outgoing"),
      };

      if (!branchMap[bId]) branchMap[bId] = { branchName: bName, entries: [] };
      branchMap[bId].entries.push(entry);

      // تحديث الرصيد للأيام التالية
      latestPrev[bId] = {
        hashi: entry.hashi.actual,
        sheep: entry.sheep.actual,
        beef:  entry.beef.actual,
      };
    }

    const rows = Object.values(branchMap);
    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
