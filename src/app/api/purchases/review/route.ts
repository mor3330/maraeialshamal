// @ts-nocheck
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// الفئات المتعرّف عليها (مرتبطة بعمود meat_category في item_types)
type Category = "hashi" | "sheep" | "beef" | "offal" | "other";

// Fallback: تصنيف بناءً على الاسم إذا لم يكن meat_category محدداً
const SHEEP_TYPES = ["سواكني", "حري", "نعيمي", "خروف", "غنم", "روماني", "رفيدي", "تيس"];
function getMainCategoryByName(itemTypeName: string): Category {
  const n = (itemTypeName || "").toLowerCase();
  if (n.includes("حاشي") || n.includes("hashi")) return "hashi";
  if (n.includes("عجل") || n.includes("beef")) return "beef";
  if (n.includes("مخلف") || n.includes("كبد") || n.includes("كراع")
    || n.includes("راس") || n.includes("رأس") || n.includes("معاصب")
    || n.includes("offal")) return "offal";
  if (SHEEP_TYPES.some(s => (itemTypeName || "").includes(s))) return "sheep";
  if (n.includes("غنم") || n.includes("sheep")) return "sheep";
  return "other";
}

function getCategory(item_type: { name?: string; meat_category?: string } | null): Category {
  if (!item_type) return "other";
  // استخدام العمود من DB أولاً
  if (item_type.meat_category) {
    const c = item_type.meat_category as Category;
    if (["hashi","sheep","beef","offal"].includes(c)) return c;
  }
  // Fallback على الاسم
  return getMainCategoryByName(item_type.name || "");
}

function emptyCat() {
  return { count: 0, weight: 0, total: 0 };
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
      item_types:item_type_id(id, name, name_en, meat_category)
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
  const summary: Record<Category, { count: number; weight: number; total: number }> = {
    hashi: emptyCat(),
    sheep: emptyCat(),
    beef:  emptyCat(),
    offal: emptyCat(),
    other: emptyCat(),
  };

  // ── ملخص حسب الفرع ──
  const byBranch: Record<string, {
    branchId: string; branchName: string;
    hashi: { count: number; weight: number; total: number };
    sheep: { count: number; weight: number; total: number };
    beef:  { count: number; weight: number; total: number };
    offal: { count: number; weight: number; total: number };
    other: { count: number; weight: number; total: number };
    grandTotal: number;
  }> = {};

  // ── تفصيل أصناف كل فئة ──
  const byType: Record<Category, Record<string, { name: string; count: number; weight: number; total: number }>> = {
    hashi: {}, sheep: {}, beef: {}, offal: {}, other: {},
  };

  for (const p of purchases) {
    const itemType  = p.item_types as { name?: string; meat_category?: string } | null;
    const itemName  = itemType?.name || "غير محدد";
    const cat       = getCategory(itemType);
    const qty = Number(p.quantity) || 0;
    const wgt = Number(p.weight)   || 0;
    const amt = Number(p.price)    || 0;

    // إجمالي الفئة
    summary[cat].count  += qty;
    summary[cat].weight += wgt;
    summary[cat].total  += amt;

    // تفصيل حسب الصنف داخل الفئة
    if (!byType[cat][itemName]) {
      byType[cat][itemName] = { name: itemName, count: 0, weight: 0, total: 0 };
    }
    byType[cat][itemName].count  += qty;
    byType[cat][itemName].weight += wgt;
    byType[cat][itemName].total  += amt;

    // ملخص الفروع
    const bId   = p.branch_id || "unknown";
    const bName = (p.branches as any)?.name || "غير محدد";
    if (!byBranch[bId]) {
      byBranch[bId] = {
        branchId: bId, branchName: bName,
        hashi: emptyCat(), sheep: emptyCat(),
        beef:  emptyCat(), offal: emptyCat(), other: emptyCat(),
        grandTotal: 0,
      };
    }
    byBranch[bId][cat].count  += qty;
    byBranch[bId][cat].weight += wgt;
    byBranch[bId][cat].total  += amt;
    byBranch[bId].grandTotal  += amt;
  }

  const grandTotal =
    summary.hashi.total + summary.sheep.total +
    summary.beef.total  + summary.offal.total + summary.other.total;

  // للتوافق مع الكود القديم نرجع sheepByType أيضاً
  const sheepByType = Object.values(byType.sheep).sort((a, b) => b.total - a.total);

  return NextResponse.json({
    month, startDate, endDate,
    summary,
    sheepByType,              // للتوافق مع الكود القديم
    byType: {                 // الجديد: تفصيل كل فئة
      hashi: Object.values(byType.hashi).sort((a, b) => b.total - a.total),
      sheep: Object.values(byType.sheep).sort((a, b) => b.total - a.total),
      beef:  Object.values(byType.beef).sort((a,  b) => b.total - a.total),
      offal: Object.values(byType.offal).sort((a, b) => b.total - a.total),
      other: Object.values(byType.other).sort((a, b) => b.total - a.total),
    },
    byBranch: Object.values(byBranch).sort((a, b) => b.grandTotal - a.grandTotal),
    purchases: branchId ? purchases : [],
    grandTotal,
    totalCount: purchases.length,
  });
}
