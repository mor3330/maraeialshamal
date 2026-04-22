// @ts-nocheck
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const toN = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// ─── تصنيف الأصناف بالاسم العربي أو name_en ───
const SHEEP_NAMES = ["سواكني","نعيمي","رفيدي","تيس","روماني","خروف","حري","غنم"];
const OFFAL_NAMES = ["مخلفات","كبدة","كراعين","راس","معاصيب","كرشة","لحم","كراعين بقر","كبدة غنم","كبدة حاشي","راس غنم","راس بقر","كراعين غنم"];

function resolveCategory(item: { name: string; name_en?: string | null }): "hashi" | "sheep" | "beef" | "offal" | null {
  const ar = (item.name ?? "").trim();
  // الاسم العربي له الأولوية — أصناف الغنم تُعرَّف بالاسم العربي
  if (ar.includes("حاشي")) return "hashi";
  if (SHEEP_NAMES.some(n => ar.includes(n))) return "sheep";
  if (ar.includes("عجل") || (ar.includes("بقر") && !ar.includes("كبدة") && !ar.includes("راس") && !ar.includes("كراعين"))) return "beef";
  if (OFFAL_NAMES.some(n => ar.includes(n))) return "offal";
  // fallback لـ name_en إذا لم يُعرَّف بالعربي
  const en = (item.name_en ?? "").toLowerCase().trim();
  if (en === "hashi") return "hashi";
  if (en === "sheep") return "sheep";
  if (en === "beef")  return "beef";
  if (en === "offal") return "offal";
  return null;
}

// ─── استخراج حركات اللحوم من notes JSON ───
// notes يحتوي على: step1Named (الوارد), step3Named (مبيعات اللحوم + أسعارها),
//                  step4Named (الصادر), step5Named (المتبقي + المخلفات)
interface MeatMovements {
  // وارد
  hashi_incoming_weight: number;
  hashi_incoming_count: number;
  sheep_incoming_weight: number;
  sheep_incoming_count: number;
  beef_incoming_weight: number;
  beef_incoming_count: number;
  // مبيعات (الوزن والسعر من step3)
  hashi_sales_weight: number;
  hashi_sales_price: number;
  sheep_sales_weight: number;
  sheep_sales_price: number;
  beef_sales_weight: number;
  beef_sales_price: number;
  offal_sales_price: number;
  // صادر (step4)
  hashi_outgoing: number;
  sheep_outgoing_weight: number;
  beef_outgoing: number;
  // متبقي (step5)
  hashi_remaining: number;
  sheep_remaining: number;
  beef_remaining: number;
  hashi_waste: number;   // مخلفات الحاشي
  sheep_waste: number;
  beef_waste: number;
}

function parseMeatMovements(notesRaw: string | null | undefined): MeatMovements {
  const zero: MeatMovements = {
    hashi_incoming_weight: 0, hashi_incoming_count: 0,
    sheep_incoming_weight: 0, sheep_incoming_count: 0,
    beef_incoming_weight: 0, beef_incoming_count: 0,
    hashi_sales_weight: 0, hashi_sales_price: 0,
    sheep_sales_weight: 0, sheep_sales_price: 0,
    beef_sales_weight: 0, beef_sales_price: 0,
    offal_sales_price: 0,
    hashi_outgoing: 0, sheep_outgoing_weight: 0, beef_outgoing: 0,
    hashi_remaining: 0, sheep_remaining: 0, beef_remaining: 0,
    hashi_waste: 0, sheep_waste: 0, beef_waste: 0,
  };
  if (!notesRaw) return zero;
  try {
    const n = typeof notesRaw === "string" ? JSON.parse(notesRaw) : notesRaw;
    const s1 = n.step1Named ?? {};
    const s3 = n.step3Named ?? {};
    const s4 = n.step4Named ?? {};
    const s5 = n.step5Named ?? {};
    return {
      // step1 — الوارد
      hashi_incoming_weight: toN(s1.hashi_weight),
      hashi_incoming_count:  toN(s1.hashi_count),
      sheep_incoming_weight: toN(s1.sheep_weight),
      sheep_incoming_count:  toN(s1.sheep_count),
      beef_incoming_weight:  toN(s1.beef_weight),
      beef_incoming_count:   toN(s1.beef_count),
      // step3 — مبيعات اللحوم بالوزن والريال
      hashi_sales_weight: toN(s3.hashi_weight),
      hashi_sales_price:  toN(s3.hashi_price),
      sheep_sales_weight: toN(s3.sheep_weight),
      sheep_sales_price:  toN(s3.sheep_price),
      beef_sales_weight:  toN(s3.beef_weight),
      beef_sales_price:   toN(s3.beef_price),
      offal_sales_price:  toN(s3.offal_total_price),
      // step4 — الصادر
      hashi_outgoing:        toN(s4.hashi_outgoing),
      sheep_outgoing_weight: toN(s4.sheep_outgoing_weight),
      beef_outgoing:         toN(s4.beef_outgoing),
      // step5 — المتبقي والمخلفات
      hashi_remaining: toN(s5.hashi_remaining),
      sheep_remaining: toN(s5.sheep_remaining),
      beef_remaining:  toN(s5.beef_remaining),
      hashi_waste:     toN(s5.hashi_offal),
      sheep_waste:     toN(s5.sheep_offal),
      beef_waste:      toN(s5.beef_offal),
    };
  } catch { return zero; }
}

interface CategoryData {
  purchaseQty: number; purchaseWeight: number; purchaseValue: number;
  prevWeight: number; prevValue: number;
  totalCostWeight: number; totalCostValue: number; costPerKg: number;
  salesWeight: number; salesValue: number;
  outgoingWeight: number; outgoingValue: number;
  wasteWeight: number; remainingWeight: number; remainingValue: number;
  profit: number; weightBalance: number;
}
interface OffalData { purchaseValue: number; salesValue: number; remainingValue: number; profit: number; }
interface BranchProfitData {
  branchId: string; branchName: string;
  hashi: CategoryData; sheep: CategoryData; beef: CategoryData; offal: OffalData;
  totalProfit: number;
}

export async function GET(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("from");
  const dateTo   = searchParams.get("to");
  if (!dateFrom || !dateTo) return NextResponse.json({ error: "from و to مطلوبان" }, { status: 400 });

  // ─── 1. الفروع ───
  const { data: branches } = await supabase
    .from("branches").select("id, name").eq("is_active", true).order("name");
  if (!branches?.length) return NextResponse.json({ branches: [], summary: null });

  // ─── 2. item_types للتصنيف ───
  const { data: itemTypes } = await supabase
    .from("item_types").select("id, name, name_en").eq("is_active", true);
  const itemCategoryMap: Record<string, "hashi" | "sheep" | "beef" | "offal"> = {};
  (itemTypes ?? []).forEach((it: any) => {
    const cat = resolveCategory(it);
    if (cat) itemCategoryMap[it.id] = cat;
  });

  // ─── 3. المشتريات في الفترة ───
  const { data: purchases } = await supabase
    .from("purchases")
    .select("id, branch_id, purchase_date, item_type_id, quantity, weight, price")
    .gte("purchase_date", dateFrom).lte("purchase_date", dateTo)
    .order("purchase_date", { ascending: true });

  // ─── 4. تقارير الفروع في الفترة (notes فقط) ───
  const { data: reports } = await supabase
    .from("daily_reports")
    .select("id, branch_id, report_date, total_sales, notes")
    .gte("report_date", dateFrom).lte("report_date", dateTo)
    .in("status", ["submitted", "approved"]);

  // ─── 5. آخر سعر شراء (لأي فرع) قبل الفترة وفي الفترة — لحساب سعر الكيلو ───
  // السعر مركزي: نأخذ أحدث سعر لكل category بغض النظر عن الفرع
  const { data: allPrevPurchases } = await supabase
    .from("purchases")
    .select("branch_id, item_type_id, purchase_date, weight, price")
    .lt("purchase_date", dateFrom)
    .order("purchase_date", { ascending: false });

  // آخر سعر عالمي لكل category (مستقل عن الفرع)
  const globalPrevPriceMap: Record<"hashi"|"sheep"|"beef"|"offal", { weight: number; price: number } | null> = {
    hashi: null, sheep: null, beef: null, offal: null,
  };
  (allPrevPurchases ?? []).forEach((p: any) => {
    const cat = itemCategoryMap[p.item_type_id] as keyof typeof globalPrevPriceMap;
    if (!cat || globalPrevPriceMap[cat]) return;
    globalPrevPriceMap[cat] = { weight: toN(p.weight), price: toN(p.price) };
  });

  // آخر سعر لكل فرع × category (لو موجود، وإلا يستخدم العالمي)
  const prevPriceMap: Record<string, { weight: number; price: number }> = {};
  (allPrevPurchases ?? []).forEach((p: any) => {
    const cat = itemCategoryMap[p.item_type_id];
    if (!cat) return;
    const key = `${p.branch_id}_${cat}`;
    if (!prevPriceMap[key]) prevPriceMap[key] = { weight: toN(p.weight), price: toN(p.price) };
  });

  // سعر كيلو الفترة الحالية (لكل category) — من purchases في الفترة
  const periodPriceMap: Record<string, { totalWeight: number; totalPrice: number }> = {};
  (purchases ?? []).forEach((p: any) => {
    const cat = itemCategoryMap[p.item_type_id];
    if (!cat) return;
    // مرجّح لكل فرع
    const key = `${p.branch_id}_${cat}`;
    if (!periodPriceMap[key]) periodPriceMap[key] = { totalWeight: 0, totalPrice: 0 };
    periodPriceMap[key].totalWeight += toN(p.weight);
    periodPriceMap[key].totalPrice  += toN(p.price);
    // مرجّح عالمي
    const gkey = `global_${cat}`;
    if (!periodPriceMap[gkey]) periodPriceMap[gkey] = { totalWeight: 0, totalPrice: 0 };
    periodPriceMap[gkey].totalWeight += toN(p.weight);
    periodPriceMap[gkey].totalPrice  += toN(p.price);
  });

  // دالة للحصول على سعر الكيلو: فرع-محدد أولاً، ثم عالمي، ثم آخر سعر قبل الفترة
  function getKgPrice(branchId: string, cat: "hashi"|"sheep"|"beef"|"offal"): number {
    // 1. سعر مرجّح من purchases هذا الفرع في الفترة
    const branchPeriod = periodPriceMap[`${branchId}_${cat}`];
    if (branchPeriod?.totalWeight > 0) return branchPeriod.totalPrice / branchPeriod.totalWeight;
    // 2. سعر مرجّح من purchases أي فرع في الفترة
    const globalPeriod = periodPriceMap[`global_${cat}`];
    if (globalPeriod?.totalWeight > 0) return globalPeriod.totalPrice / globalPeriod.totalWeight;
    // 3. آخر سعر لهذا الفرع قبل الفترة
    const branchPrev = prevPriceMap[`${branchId}_${cat}`];
    if (branchPrev?.weight > 0) return branchPrev.price / branchPrev.weight;
    // 4. آخر سعر عالمي قبل الفترة
    const gp = globalPrevPriceMap[cat];
    if (gp?.weight > 0) return gp.price / gp.weight;
    return 0;
  }

  // ─── 6. رصيد أمس من تقرير اليوم السابق ───
  const dayBefore = new Date(dateFrom);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayBeforeStr = dayBefore.toISOString().split("T")[0];

  const { data: prevReports } = await supabase
    .from("daily_reports")
    .select("branch_id, notes")
    .eq("report_date", dayBeforeStr)
    .in("branch_id", branches.map((b: any) => b.id));

  // رصيد المتبقي من تقرير أمس لكل (branchId_category)
  const prevRemainingMap: Record<string, number> = {};
  (prevReports ?? []).forEach((r: any) => {
    const m = parseMeatMovements(r.notes);
    const bId = r.branch_id;
    if (m.hashi_remaining > 0) prevRemainingMap[`${bId}_hashi`] = m.hashi_remaining;
    if (m.sheep_remaining > 0) prevRemainingMap[`${bId}_sheep`] = m.sheep_remaining;
    if (m.beef_remaining  > 0) prevRemainingMap[`${bId}_beef`]  = m.beef_remaining;
  });

  // ─── 7. حساب التقرير لكل فرع ───
  const branchResults: BranchProfitData[] = [];

  for (const branch of branches as any[]) {
    const bId = branch.id;
    const bPurchases = (purchases ?? []).filter((p: any) => p.branch_id === bId);
    const bReports   = (reports   ?? []).filter((r: any) => r.branch_id === bId);

    // مجمّع حركات اللحوم من كل تقارير الفرع في الفترة
    const totalMovements: MeatMovements = {
      hashi_incoming_weight: 0, hashi_incoming_count: 0,
      sheep_incoming_weight: 0, sheep_incoming_count: 0,
      beef_incoming_weight: 0, beef_incoming_count: 0,
      hashi_sales_weight: 0, hashi_sales_price: 0,
      sheep_sales_weight: 0, sheep_sales_price: 0,
      beef_sales_weight: 0, beef_sales_price: 0,
      offal_sales_price: 0,
      hashi_outgoing: 0, sheep_outgoing_weight: 0, beef_outgoing: 0,
      hashi_remaining: 0, sheep_remaining: 0, beef_remaining: 0,
      hashi_waste: 0, sheep_waste: 0, beef_waste: 0,
    };

    // آخر تقرير للمتبقي (نأخذ من آخر يوم فقط وليس مجموع)
    const sortedReports = [...bReports].sort((a, b) => a.report_date.localeCompare(b.report_date));
    const lastReport = sortedReports[sortedReports.length - 1];

    bReports.forEach((r: any) => {
      const m = parseMeatMovements(r.notes);
      // الوارد والمبيعات والصادر يُجمّع
      totalMovements.hashi_incoming_weight += m.hashi_incoming_weight;
      totalMovements.hashi_incoming_count  += m.hashi_incoming_count;
      totalMovements.sheep_incoming_weight += m.sheep_incoming_weight;
      totalMovements.sheep_incoming_count  += m.sheep_incoming_count;
      totalMovements.beef_incoming_weight  += m.beef_incoming_weight;
      totalMovements.beef_incoming_count   += m.beef_incoming_count;
      totalMovements.hashi_sales_weight += m.hashi_sales_weight;
      totalMovements.hashi_sales_price  += m.hashi_sales_price;
      totalMovements.sheep_sales_weight += m.sheep_sales_weight;
      totalMovements.sheep_sales_price  += m.sheep_sales_price;
      totalMovements.beef_sales_weight  += m.beef_sales_weight;
      totalMovements.beef_sales_price   += m.beef_sales_price;
      totalMovements.offal_sales_price  += m.offal_sales_price;
      totalMovements.hashi_outgoing        += m.hashi_outgoing;
      totalMovements.sheep_outgoing_weight += m.sheep_outgoing_weight;
      totalMovements.beef_outgoing         += m.beef_outgoing;
      totalMovements.hashi_waste += m.hashi_waste;
      totalMovements.sheep_waste += m.sheep_waste;
      totalMovements.beef_waste  += m.beef_waste;
    });

    // المتبقي = من آخر تقرير فقط
    if (lastReport) {
      const lm = parseMeatMovements(lastReport.notes);
      totalMovements.hashi_remaining = lm.hashi_remaining;
      totalMovements.sheep_remaining = lm.sheep_remaining;
      totalMovements.beef_remaining  = lm.beef_remaining;
    }

    function calcCategory(cat: "hashi" | "sheep" | "beef"): CategoryData {
      // ── مشتريات من purchases (وزن + قيمة حقيقية) ──
      const catPurchases = bPurchases.filter((p: any) => itemCategoryMap[p.item_type_id] === cat);
      const purchaseQty    = catPurchases.reduce((s: number, p: any) => s + toN(p.quantity), 0);
      const purchaseWeightFromDB = catPurchases.reduce((s: number, p: any) => s + toN(p.weight), 0);
      const purchaseValue  = catPurchases.reduce((s: number, p: any) => s + toN(p.price), 0);

      // ── وارد من step1Named في التقارير (الوزن الفعلي كما أدخله الكاشير) ──
      const incomingFromReports = cat === "hashi" ? totalMovements.hashi_incoming_weight
        : cat === "sheep" ? totalMovements.sheep_incoming_weight : totalMovements.beef_incoming_weight;
      const incomingQtyFromReports = cat === "hashi" ? totalMovements.hashi_incoming_count
        : cat === "sheep" ? totalMovements.sheep_incoming_count : totalMovements.beef_incoming_count;

      // نستخدم الوزن من purchases إذا موجود، وإلا من step1
      const purchaseWeight = purchaseWeightFromDB > 0 ? purchaseWeightFromDB : incomingFromReports;
      const finalPurchaseQty = purchaseQty > 0 ? purchaseQty : incomingQtyFromReports;

      // سعر الكيلو المرجّح — من purchases أو عالمي
      const costPerKg = getKgPrice(bId, cat);

      // قيمة الوارد: من purchases إذا موجود، وإلا نحسب من الوزن × سعر الكيلو
      const finalPurchaseValue = purchaseValue > 0 ? purchaseValue : purchaseWeight * costPerKg;

      // ── رصيد أمس ──
      const prevWeight   = prevRemainingMap[`${bId}_${cat}`] ?? 0;
      const prevKgPrice  = (() => {
        const p = prevPriceMap[`${bId}_${cat}`];
        if (p?.weight > 0) return p.price / p.weight;
        const gp = globalPrevPriceMap[cat];
        return gp?.weight > 0 ? gp.price / gp.weight : costPerKg;
      })();
      const prevValue = prevWeight * prevKgPrice;

      // ── الإجمالي (وارد اليوم + رصيد أمس) ──
      const totalCostWeight = purchaseWeight + prevWeight;
      const totalCostValue  = finalPurchaseValue + prevValue;
      const blendedCostPerKg = totalCostWeight > 0 ? totalCostValue / totalCostWeight : costPerKg;

      // ── الحركات ──
      const salesWeight    = cat === "hashi" ? totalMovements.hashi_sales_weight : cat === "sheep" ? totalMovements.sheep_sales_weight : totalMovements.beef_sales_weight;
      const salesValue     = cat === "hashi" ? totalMovements.hashi_sales_price  : cat === "sheep" ? totalMovements.sheep_sales_price  : totalMovements.beef_sales_price;
      const outgoingWeight = cat === "hashi" ? totalMovements.hashi_outgoing     : cat === "sheep" ? totalMovements.sheep_outgoing_weight : totalMovements.beef_outgoing;
      const wasteWeight    = cat === "hashi" ? totalMovements.hashi_waste        : cat === "sheep" ? totalMovements.sheep_waste : totalMovements.beef_waste;
      const remainingWeight= cat === "hashi" ? totalMovements.hashi_remaining    : cat === "sheep" ? totalMovements.sheep_remaining : totalMovements.beef_remaining;

      const outgoingValue  = outgoingWeight  * blendedCostPerKg;
      const remainingValue = remainingWeight * blendedCostPerKg;

      // ── صافي الربح = (مبيعات + متبقي + صادر) − مشتريات ──
      const profit = (salesValue + remainingValue + outgoingValue) - totalCostValue;

      // ── عجز الوزن ──
      const expectedRemaining = totalCostWeight - salesWeight - outgoingWeight - wasteWeight;
      const weightBalance = remainingWeight - expectedRemaining;

      return {
        purchaseQty: finalPurchaseQty, purchaseWeight, purchaseValue: finalPurchaseValue,
        prevWeight, prevValue, totalCostWeight, totalCostValue,
        costPerKg: blendedCostPerKg,
        salesWeight, salesValue, outgoingWeight, outgoingValue,
        wasteWeight, remainingWeight, remainingValue,
        profit, weightBalance,
      };
    }

    const hashi = calcCategory("hashi");
    const sheep = calcCategory("sheep");
    const beef  = calcCategory("beef");

    // المخلفات — مشتريات فقط من purchases
    const offalPurchases = bPurchases.filter((p: any) => itemCategoryMap[p.item_type_id] === "offal");
    const offalPurchaseValue = offalPurchases.reduce((s: number, p: any) => s + toN(p.price), 0);
    const offal: OffalData = { purchaseValue: offalPurchaseValue, salesValue: 0, remainingValue: 0, profit: 0 };

    branchResults.push({
      branchId: bId, branchName: branch.name,
      hashi, sheep, beef, offal,
      totalProfit: hashi.profit + sheep.profit + beef.profit,
    });
  }

  // ─── 8. إجماليات المشتريات ───
  const allPurchases = purchases ?? [];
  const groupSummary = {
    hashi:  { qty: 0, weight: 0, price: 0 },
    sheep:  { qty: 0, weight: 0, price: 0 },
    beef:   { qty: 0, weight: 0, price: 0 },
    offal:  { qty: 0, weight: 0, price: 0 },
  };
  allPurchases.forEach((p: any) => {
    const g = itemCategoryMap[p.item_type_id] as keyof typeof groupSummary;
    if (!g || !groupSummary[g]) return;
    groupSummary[g].qty   += toN(p.quantity);
    groupSummary[g].weight += toN(p.weight);
    groupSummary[g].price  += toN(p.price);
  });

  const totalPurchaseValue = branchResults.reduce((s, b) =>
    s + b.hashi.totalCostValue + b.sheep.totalCostValue + b.beef.totalCostValue + b.offal.purchaseValue, 0);

  const summary = {
    totalPurchaseValue,
    totalSalesValue: branchResults.reduce((s, b) => s + b.hashi.salesValue + b.sheep.salesValue + b.beef.salesValue, 0),
    totalProfit: branchResults.reduce((s, b) => s + b.totalProfit, 0),
    byCategory: {
      hashi: { purchaseWeight: branchResults.reduce((s,b) => s+b.hashi.totalCostWeight,0), purchaseValue: branchResults.reduce((s,b) => s+b.hashi.totalCostValue,0), salesWeight: branchResults.reduce((s,b) => s+b.hashi.salesWeight,0), salesValue: branchResults.reduce((s,b) => s+b.hashi.salesValue,0), remainingWeight: branchResults.reduce((s,b) => s+b.hashi.remainingWeight,0), remainingValue: branchResults.reduce((s,b) => s+b.hashi.remainingValue,0), profit: branchResults.reduce((s,b) => s+b.hashi.profit,0) },
      sheep: { purchaseWeight: branchResults.reduce((s,b) => s+b.sheep.totalCostWeight,0), purchaseValue: branchResults.reduce((s,b) => s+b.sheep.totalCostValue,0), salesWeight: branchResults.reduce((s,b) => s+b.sheep.salesWeight,0), salesValue: branchResults.reduce((s,b) => s+b.sheep.salesValue,0), remainingWeight: branchResults.reduce((s,b) => s+b.sheep.remainingWeight,0), remainingValue: branchResults.reduce((s,b) => s+b.sheep.remainingValue,0), profit: branchResults.reduce((s,b) => s+b.sheep.profit,0) },
      beef:  { purchaseWeight: branchResults.reduce((s,b) => s+b.beef.totalCostWeight,0),  purchaseValue: branchResults.reduce((s,b) => s+b.beef.totalCostValue,0),  salesWeight: branchResults.reduce((s,b) => s+b.beef.salesWeight,0),  salesValue: branchResults.reduce((s,b) => s+b.beef.salesValue,0),  remainingWeight: branchResults.reduce((s,b) => s+b.beef.remainingWeight,0),  remainingValue: branchResults.reduce((s,b) => s+b.beef.remainingValue,0),  profit: branchResults.reduce((s,b) => s+b.beef.profit,0) },
      offal: { purchaseValue: branchResults.reduce((s,b) => s+b.offal.purchaseValue,0), salesValue: 0, profit: 0 },
    },
    purchaseGroupSummary: groupSummary,
  };

  return NextResponse.json({ branches: branchResults, summary });
}
