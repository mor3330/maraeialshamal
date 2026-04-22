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

interface SyncLogRow {
  sync_end: string | null;
  sales_count: number | null;
  status: string | null;
}

// ─── تجميع مبيعات Aronium لفرع ويوم معين ───
// يُستدعى من DynamicStepClient لتعبئة حقول الخطوة 2 تلقائياً
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId");
  const date     = url.searchParams.get("date"); // YYYY-MM-DD بتوقيت الرياض

  if (!branchId || !date) {
    return NextResponse.json({ error: "branchId و date مطلوبان" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // نطاق اليوم كاملاً بتوقيت الرياض (UTC+3)
  const fromUTC = `${date}T00:00:00+03:00`;
  const toUTC   = `${date}T23:59:59+03:00`;

  // ─── جلب الفواتير (المبيعات فقط، استبعاد المرتجعات) ───
  const { data: rawSales, error: salesErr } = await (supabase as any)
    .from("sales")
    .select("id, total, paid_amount, payment_method, document_type")
    .eq("branch_id", branchId)
    .gte("sale_date", fromUTC)
    .lte("sale_date", toUTC);
  const salesRows = (rawSales ?? []) as SaleRow[];

  if (salesErr) {
    return NextResponse.json({ error: salesErr.message }, { status: 500 });
  }

  if (!salesRows || salesRows.length === 0) {
    return NextResponse.json({ found: false, message: "لا توجد بيانات Aronium لهذا اليوم" });
  }

  // ─── تجميع الأرقام ───
  let totalSales    = 0;
  let totalReturns  = 0;
  let invoiceCount  = 0;
  let cashAmount    = 0;
  let networkAmount = 0;
  let transferAmount= 0;
  let deferredAmount= 0;

  for (const row of salesRows) {
    const amount = Number(row.total ?? 0);
    const isReturn = row.document_type?.toLowerCase().includes("refund") ||
                     row.document_type?.toLowerCase().includes("return");

    if (isReturn) {
      totalReturns += amount;
    } else {
      totalSales   += amount;
      invoiceCount += 1;
    }

    // تصنيف طريقة الدفع
    const method = (row.payment_method ?? "").toLowerCase();
    const paid   = Number(row.paid_amount ?? row.total ?? 0);

    if (method.includes("cash") || method.includes("نقد") || method.includes("كاش") || method === "1") {
      cashAmount += paid;
    } else if (method.includes("card") || method.includes("network") || method.includes("شبكة") || method === "2") {
      networkAmount += paid;
    } else if (method.includes("transfer") || method.includes("تحويل") || method === "3") {
      transferAmount += paid;
    } else if (method.includes("deferred") || method.includes("credit") || method.includes("آجل") || method === "4") {
      deferredAmount += paid;
    } else {
      // fallback: يُحسب كاش
      cashAmount += paid;
    }
  }

  // ─── آخر مزامنة لهذا الفرع ───
  const { data: rawSyncLog } = await (supabase as any)
    .from("sync_logs")
    .select("sync_end, sales_count, status")
    .eq("branch_id", branchId)
    .eq("status", "success")
    .order("sync_end", { ascending: false })
    .limit(1)
    .single();
  const syncLog = rawSyncLog as SyncLogRow | null;

  const round = (n: number) => Math.round(n * 100) / 100;

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
    lastSync: syncLog?.sync_end ?? null,
    syncedInvoices: syncLog?.sales_count ?? salesRows.length,
  });
}
