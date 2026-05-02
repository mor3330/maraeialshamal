import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface SaleRow {
  id: string;
  total: number | null;
  paid_amount: number | null;
  payment_method: string | null;
  document_type: string | null;
}

interface SaleItemRow {
  sale_id: string;
  product_name: string | null;
  quantity: number | null;
  total: number | null;
}

const round = (n: number) => Math.round(n * 100) / 100;

// ─── تجميع مبيعات Aronium لفرع ويوم معين ───
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId");
  const date     = url.searchParams.get("date");

  if (!branchId || !date) {
    return NextResponse.json({ error: "branchId و date مطلوبان" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // التحقق من أن مزامنة POS مفعلة للفرع
  const { data: branchInfo } = await (supabase as any)
    .from("branches")
    .select("id, pos_sync_enabled")
    .eq("id", branchId)
    .maybeSingle();

  if (branchInfo && branchInfo.pos_sync_enabled === false) {
    return NextResponse.json({
      found: false,
      blocked: true,
      message: "🔴 مزامنة POS متوقفة لهذا الفرع"
    });
  }

  // نطاق اليوم كاملاً بتوقيت الرياض
  const fromUTC = `${date}T00:00:00+03:00`;
  const toUTC   = `${date}T23:59:59+03:00`;

  // ─── جلب الفواتير ───
  const { data: rawSales, error: salesErr } = await (supabase as any)
    .from("sales")
    .select("id, total, paid_amount, payment_method, document_type")
    .eq("branch_id", branchId)
    .gte("sale_date", fromUTC)
    .lte("sale_date", toUTC);

  const salesRows = (rawSales ?? []) as SaleRow[];
  if (salesErr) return NextResponse.json({ error: salesErr.message }, { status: 500 });
  if (!salesRows || salesRows.length === 0) {
    return NextResponse.json({ found: false, message: "لا توجد بيانات Aronium لهذا اليوم" });
  }

  // ─── جلب أصناف الفواتير ───
  const saleIds = salesRows.map(s => s.id);
  const { data: rawItems } = await (supabase as any)
    .from("sale_items")
    .select("sale_id, product_name, quantity, total")
    .in("sale_id", saleIds);
  const saleItems = (rawItems || []) as SaleItemRow[];

  // ─── جلب product_mappings ───
  const { data: rawMappings } = await (supabase as any)
    .from("product_mappings")
    .select("aronium_name, category");
  const mappings: Record<string, string> = {};
  for (const m of (rawMappings || [])) {
    mappings[m.aronium_name] = m.category;
  }

  // ─── تجميع الأرقام من الفواتير (المصدر الموثوق لـ totalSales) ───
  let totalSales   = 0, totalReturns = 0, invoiceCount = 0;
  let cashAmount   = 0, networkAmount = 0, transferAmount = 0, deferredAmount = 0;

  for (const row of salesRows) {
    const amount = Number(row.total ?? 0);
    const isReturn = row.document_type?.toLowerCase().includes("refund") ||
                     row.document_type?.toLowerCase().includes("return");
    if (isReturn) { totalReturns += amount; continue; }
    totalSales   += amount;
    invoiceCount += 1;

    const method = (row.payment_method ?? "").toLowerCase();
    const paid   = Number(row.paid_amount ?? row.total ?? 0);
    if (method.includes("cash") || method.includes("نقد") || method.includes("كاش") || method === "1") cashAmount += paid;
    else if (method.includes("card") || method.includes("network") || method.includes("شبكة") || method === "2") networkAmount += paid;
    else if (method.includes("transfer") || method.includes("تحويل") || method === "3") transferAmount += paid;
    else if (method.includes("deferred") || method.includes("credit") || method.includes("آجل") || method === "4") deferredAmount += paid;
    else cashAmount += paid;
  }

  // ─── تجميع الأصناف حسب الفئة ───
  const byCategory: Record<string, { qty: number; amount: number }> = {
    hashi: { qty: 0, amount: 0 },
    sheep: { qty: 0, amount: 0 },
    beef:  { qty: 0, amount: 0 },
    offal: { qty: 0, amount: 0 },
    other: { qty: 0, amount: 0 },
  };

  for (const item of saleItems) {
    const name = item.product_name?.trim() || "";
    const cat  = mappings[name] || "other";
    byCategory[cat as keyof typeof byCategory].qty    += Number(item.quantity || 0);
    byCategory[cat as keyof typeof byCategory].amount += Number(item.total    || 0);
  }

  // ─── توزيع نسبي: نضمن أن مجموع الفئات = totalSales تماماً ───
  // (الفرق يحدث بسبب خصومات الفاتورة الكلية في Aronium التي لا تنعكس على الأصناف)
  const totalItemsAmount = Object.values(byCategory).reduce((s, c) => s + c.amount, 0);
  if (totalItemsAmount > 0 && totalSales > 0) {
    const ratio = totalSales / totalItemsAmount;
    for (const cat of Object.keys(byCategory)) {
      const c = byCategory[cat as keyof typeof byCategory];
      c.amount = Math.round(c.amount * ratio * 100) / 100;
    }
  }

  const hasCategoryData = Object.values(byCategory).some(c => c.amount > 0);

  // ─── آخر مزامنة ───
  const { data: rawSyncLog } = await (supabase as any)
    .from("sync_logs")
    .select("sync_end, sales_count, status")
    .eq("branch_id", branchId)
    .eq("status", "success")
    .order("sync_end", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    found: true,
    branchId,
    date,
    totalSales:     round(totalSales),
    invoiceCount,
    returnsValue:   round(totalReturns),
    cashAmount:     round(cashAmount),
    networkAmount:  round(networkAmount),
    transferAmount: round(transferAmount),
    deferredAmount: round(deferredAmount),
    // بيانات الفئات للخطوة 3
    hasCategoryData,
    byCategory: {
      hashi: { qty: round(byCategory.hashi.qty), amount: round(byCategory.hashi.amount) },
      sheep: { qty: round(byCategory.sheep.qty), amount: round(byCategory.sheep.amount) },
      beef:  { qty: round(byCategory.beef.qty),  amount: round(byCategory.beef.amount)  },
      offal: { qty: round(byCategory.offal.qty), amount: round(byCategory.offal.amount) },
      other: { qty: round(byCategory.other.qty), amount: round(byCategory.other.amount) },
    },
    // المبلغ غير المصنف - للتنبيه بضرورة التصنيف
    unclassifiedAmount: round(byCategory.other.amount),
    unclassifiedQty:    round(byCategory.other.qty),
    lastSync:       rawSyncLog?.sync_end ?? null,
    syncedInvoices: rawSyncLog?.sales_count ?? salesRows.length,
  });
}
