import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ضريبة القيمة المضافة في السعودية = 15%
const VAT_RATE = 0.15;

export async function GET(request: NextRequest) {
  const url   = new URL(request.url);
  const year  = parseInt(url.searchParams.get("year")  || String(new Date().getFullYear()));
  const month = parseInt(url.searchParams.get("month") || String(new Date().getMonth() + 1));

  const supabase = createServiceClient();

  // ─── نطاق الشهر (بتوقيت الرياض +3) ───
  const monthStr = String(month).padStart(2, "0");
  const fromUTC  = `${year}-${monthStr}-01T00:00:00+03:00`;
  const lastDay  = new Date(year, month, 0).getDate(); // آخر يوم في الشهر
  const lastDayStr = String(lastDay).padStart(2, "0");
  const toUTC    = `${year}-${monthStr}-${lastDayStr}T23:59:59+03:00`;

  // ─── جلب جميع الفروع ───
  const { data: branches } = await (supabase as any)
    .from("branches")
    .select("id, name, code")
    .order("name");

  if (!branches?.length) {
    return NextResponse.json({ branches: [], period: { year, month }, totals: { salesInclVAT: 0, salesExclVAT: 0, vat: 0, invoices: 0 } });
  }

  // ─── جلب المبيعات لكل الفروع دفعة واحدة ───
  const { data: allSales } = await (supabase as any)
    .from("sales")
    .select("branch_id, total, document_type")
    .in("branch_id", branches.map((b: any) => b.id))
    .gte("sale_date", fromUTC)
    .lte("sale_date", toUTC);

  const sales = (allSales || []) as any[];

  // ─── تجميع حسب الفرع ───
  const branchMap: Record<string, { salesInclVAT: number; returns: number; invoices: number }> = {};
  for (const branch of branches) {
    branchMap[branch.id] = { salesInclVAT: 0, returns: 0, invoices: 0 };
  }

  for (const row of sales) {
    const b = branchMap[row.branch_id];
    if (!b) continue;
    const amount = Math.abs(Number(row.total ?? 0));
    const isReturn = (row.document_type ?? "").toLowerCase().includes("refund") ||
                     (row.document_type ?? "").toLowerCase().includes("return");
    if (isReturn) {
      b.returns += amount;
    } else {
      b.salesInclVAT += amount;
      b.invoices++;
    }
  }

  // ─── بناء النتيجة ───
  const round = (n: number) => Math.round(n * 100) / 100;

  let totalSalesInclVAT = 0, totalReturns = 0, totalInvoices = 0;

  const branchRows = branches.map((branch: any) => {
    const b = branchMap[branch.id] || { salesInclVAT: 0, returns: 0, invoices: 0 };
    const netSalesInclVAT = b.salesInclVAT - b.returns;
    const netSalesExclVAT = netSalesInclVAT / (1 + VAT_RATE);
    const vatAmount       = netSalesInclVAT - netSalesExclVAT;

    totalSalesInclVAT += netSalesInclVAT;
    totalReturns      += b.returns;
    totalInvoices     += b.invoices;

    return {
      id:             branch.id,
      name:           branch.name,
      code:           branch.code,
      salesInclVAT:   round(netSalesInclVAT),
      salesExclVAT:   round(netSalesExclVAT),
      vat:            round(vatAmount),
      invoices:       b.invoices,
      returns:        round(b.returns),
    };
  });

  const totalSalesExclVAT = totalSalesInclVAT / (1 + VAT_RATE);
  const totalVAT          = totalSalesInclVAT - totalSalesExclVAT;

  return NextResponse.json({
    period: { year, month },
    vatRate: VAT_RATE * 100,
    branches: branchRows,
    totals: {
      salesInclVAT: round(totalSalesInclVAT),
      salesExclVAT: round(totalSalesExclVAT),
      vat:          round(totalVAT),
      invoices:     totalInvoices,
    },
  });
}
