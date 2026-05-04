import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// تصنيف الأصناف إلى (hashi / sheep / beef)
const SHEEP_NAMES = ["سواكني","نعيمي","رفيدي","تيس","روماني","خروف","حري","غنم"];
const OFFAL_NAMES = ["مخلفات","كبدة","كراعين","راس","معاصيب","كرشة"];

function resolveCategory(it: { name: string; name_en: string; meat_category: string | null }): "hashi"|"sheep"|"beef"|"offal"|null {
  if (it.meat_category && ["hashi","sheep","beef","offal"].includes(it.meat_category)) {
    return it.meat_category as "hashi"|"sheep"|"beef"|"offal";
  }
  const ar = (it.name ?? "").trim();
  const en = (it.name_en ?? "").toLowerCase().trim();
  if (ar.includes("حاشي")) return "hashi";
  if (SHEEP_NAMES.some(n => ar.includes(n))) return "sheep";
  if (ar.includes("عجل") || ar === "لحم" || ar.startsWith("لحم ") || (ar.includes("بقر") && !OFFAL_NAMES.some(n => ar.includes(n)))) return "beef";
  if (OFFAL_NAMES.some(n => ar.includes(n))) return "offal";
  if (en === "hashi") return "hashi";
  if (en === "sheep") return "sheep";
  if (en === "beef")  return "beef";
  if (en === "offal") return "offal";
  return null;
}

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom") ?? new Date().toISOString().substring(0, 10);
  const dateTo   = searchParams.get("dateTo")   ?? dateFrom;

  const [branchesRes, itemTypesRes, purchasesRes, reportsRes] = await Promise.all([
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    supabase.from("item_types").select("id, name, name_en, meat_category").eq("is_active", true),
    supabase.from("purchases")
      .select("branch_id, item_type_id, quantity, weight")
      .gte("purchase_date", dateFrom)
      .lte("purchase_date", dateTo),
    supabase.from("daily_reports")
      .select("branch_id, report_date, notes")
      .gte("report_date", dateFrom)
      .lte("report_date", dateTo)
      .in("status", ["submitted", "approved"]),
  ]);

  if (branchesRes.error) return NextResponse.json({ error: branchesRes.error.message }, { status: 500 });
  if (reportsRes.error)  return NextResponse.json({ error: reportsRes.error.message  }, { status: 500 });

  // خريطة تصنيف الأصناف
  const catMap: Record<string, "hashi"|"sheep"|"beef"|"offal"> = {};
  (itemTypesRes.data ?? []).forEach((it: any) => {
    const cat = resolveCategory(it);
    if (cat) catMap[it.id] = cat;
  });

  // مجاميع المشتريات لكل فرع
  type CatTotals = { count: number; weight: number };
  const purByBranch: Record<string, { hashi: CatTotals; sheep: CatTotals; beef: CatTotals }> = {};

  (purchasesRes.data ?? []).forEach((p: any) => {
    const cat = catMap[p.item_type_id];
    if (!cat || cat === "offal") return;
    if (!purByBranch[p.branch_id]) {
      purByBranch[p.branch_id] = {
        hashi: { count: 0, weight: 0 },
        sheep: { count: 0, weight: 0 },
        beef:  { count: 0, weight: 0 },
      };
    }
    purByBranch[p.branch_id][cat].count  += toN(p.quantity);
    purByBranch[p.branch_id][cat].weight += toN(p.weight);
  });

  // مجاميع الوارد (الخطوة 1) لكل فرع — من حقل notes JSON
  const inByBranch: Record<string, { hashi: CatTotals; sheep: CatTotals; beef: CatTotals }> = {};

  (reportsRes.data ?? []).forEach((r: any) => {
    let notesObj: any = null;
    try { notesObj = typeof r.notes === "string" ? JSON.parse(r.notes) : r.notes; } catch { return; }
    const s1 = notesObj?.step1Named ?? {};
    if (!s1 || (toN(s1.hashi_weight) === 0 && toN(s1.sheep_weight) === 0 && toN(s1.beef_weight) === 0)) return;

    if (!inByBranch[r.branch_id]) {
      inByBranch[r.branch_id] = {
        hashi: { count: 0, weight: 0 },
        sheep: { count: 0, weight: 0 },
        beef:  { count: 0, weight: 0 },
      };
    }
    inByBranch[r.branch_id].hashi.count  += toN(s1.hashi_count);
    inByBranch[r.branch_id].hashi.weight += toN(s1.hashi_weight);
    inByBranch[r.branch_id].sheep.count  += toN(s1.sheep_count);
    inByBranch[r.branch_id].sheep.weight += toN(s1.sheep_weight);
    inByBranch[r.branch_id].beef.count   += toN(s1.beef_count);
    inByBranch[r.branch_id].beef.weight  += toN(s1.beef_weight);
  });

  const ZERO: CatTotals = { count: 0, weight: 0 };

  const rows = (branchesRes.data ?? []).map((b: any) => {
    const pur = purByBranch[b.id] ?? { hashi: ZERO, sheep: ZERO, beef: ZERO };
    const inc = inByBranch[b.id]  ?? { hashi: ZERO, sheep: ZERO, beef: ZERO };

    const diff = (purVal: number, incVal: number) => {
      const d = purVal - incVal;
      return { diff: d, hasGap: Math.abs(d) > 0.01 };
    };

    return {
      branchId:   b.id,
      branchName: b.name,
      hasPurchases: !!purByBranch[b.id],
      hasReport:    !!inByBranch[b.id],
      purchases: {
        hashi: pur.hashi,
        sheep: pur.sheep,
        beef:  pur.beef,
      },
      incoming: {
        hashi: inc.hashi,
        sheep: inc.sheep,
        beef:  inc.beef,
      },
      diffs: {
        hashi: {
          count:  diff(pur.hashi.count,  inc.hashi.count),
          weight: diff(pur.hashi.weight, inc.hashi.weight),
        },
        sheep: {
          count:  diff(pur.sheep.count,  inc.sheep.count),
          weight: diff(pur.sheep.weight, inc.sheep.weight),
        },
        beef: {
          count:  diff(pur.beef.count,   inc.beef.count),
          weight: diff(pur.beef.weight,  inc.beef.weight),
        },
      },
    };
  });

  return NextResponse.json({ rows, dateFrom, dateTo });
}
