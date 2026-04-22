// @ts-nocheck
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// الأصناف التي تُحتسب ضمن فئة "الغنم"
const SHEEP_TYPES = ["سواكني", "حري", "نعيمي", "خروف", "غنم", "روماني", "رفيدي", "تيس"];

// تصنيف الصنف إلى فئة رئيسية
function getMainCategory(itemTypeName: string): "hashi" | "sheep" | "beef" | "other" {
  const n = (itemTypeName || "").toLowerCase();
  if (n.includes("حاشي") || n.includes("hashi")) return "hashi";
  if (n.includes("عجل") || n.includes("beef")) return "beef";
  // الغنم: أي من الأصناف المدرجة
  if (SHEEP_TYPES.some(s => (itemTypeName || "").includes(s))) return "sheep";
  if (n.includes("غنم") || n.includes("sheep")) return "sheep";
  return "other";
}

export async function GET(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM
  const branchId = searchParams.get("branchId"); // optional - for branch detail

  if (!month) {
    return NextResponse.json({ error: "month مطلوب (YYYY-MM)" }, { status: 400 });
  }

  const [year, mon] = month.split("-");
  const startDate = `${year}-${mon}-01`;
  // آخر يوم في الشهر
  const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
  const endDate = `${year}-${mon}-${String(lastDay).padStart(2, "0")}`;

  let query = supabase
    .from("purchases")
    .select(`
      id,
      purchase_date,
      quantity,
      weight,
      price,
      notes,
      branch_id,
      branches:branch_id(id, name),
      suppliers:supplier_id(id, name),
      item_types:item_type_id(id, name, name_en)
    `)
    .gte("purchase_date", startDate)
    .lte("purchase_date", endDate)
    .order("purchase_date", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query.limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const purchases = data ?? [];

  // ── ملخص حسب الفئة الرئيسية ──
  const summary = {
    hashi: { count: 0, weight: 0, total: 0 },
    sheep: { count: 0, weight: 0, total: 0 },
    beef:  { count: 0, weight: 0, total: 0 },
    other: { count: 0, weight: 0, total: 0 },
  };

  // ── ملخص حسب الفرع ──
  const byBranch: Record<string, {
    branchId: string; branchName: string;
    hashi: { count: number; weight: number; total: number };
    sheep: { count: number; weight: number; total: number };
    beef:  { count: number; weight: number; total: number };
    other: { count: number; weight: number; total: number };
    grandTotal: number;
  }> = {};

  // ── ملخص حسب صنف الغنم التفصيلي ──
  const sheepByType: Record<string, { name: string; count: number; weight: number; total: number }> = {};

  for (const p of purchases) {
    const itemName = p.item_types?.name || "غير محدد";
    const cat = getMainCategory(itemName);
    const qty = Number(p.quantity) || 0;
    const wgt = Number(p.weight)   || 0;
    const amt = Number(p.price)    || 0;

    // إجمالي الفئة
    summary[cat].count  += qty;
    summary[cat].weight += wgt;
    summary[cat].total  += amt;

    // تفصيل أصناف الغنم
    if (cat === "sheep") {
      if (!sheepByType[itemName]) {
        sheepByType[itemName] = { name: itemName, count: 0, weight: 0, total: 0 };
      }
      sheepByType[itemName].count  += qty;
      sheepByType[itemName].weight += wgt;
      sheepByType[itemName].total  += amt;
    }

    // ملخص الفروع
    const bId = p.branch_id || "unknown";
    const bName = p.branches?.name || "غير محدد";
    if (!byBranch[bId]) {
      byBranch[bId] = {
        branchId: bId, branchName: bName,
        hashi: { count: 0, weight: 0, total: 0 },
        sheep: { count: 0, weight: 0, total: 0 },
        beef:  { count: 0, weight: 0, total: 0 },
        other: { count: 0, weight: 0, total: 0 },
        grandTotal: 0,
      };
    }
    byBranch[bId][cat].count  += qty;
    byBranch[bId][cat].weight += wgt;
    byBranch[bId][cat].total  += amt;
    byBranch[bId].grandTotal  += amt;
  }

  const grandTotal = summary.hashi.total + summary.sheep.total + summary.beef.total + summary.other.total;

  return NextResponse.json({
    month,
    startDate,
    endDate,
    summary,
    sheepByType: Object.values(sheepByType).sort((a, b) => b.total - a.total),
    byBranch: Object.values(byBranch).sort((a, b) => b.grandTotal - a.grandTotal),
    purchases: branchId ? purchases : [], // المشتريات التفصيلية فقط عند طلب فرع محدد
    grandTotal,
    totalCount: purchases.length,
  });
}
