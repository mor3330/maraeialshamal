import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const slug     = url.searchParams.get("slug");
  const date     = url.searchParams.get("date");
  const fromParam = url.searchParams.get("from");  // تاريخ مخصص: من
  const toParam   = url.searchParams.get("to");    // تاريخ مخصص: إلى
  const period   = url.searchParams.get("period") || "today"; // today | yesterday | week | month

  if (!slug) return NextResponse.json({ error: "slug مطلوب" }, { status: 400 });

  const supabase = createServiceClient();

  // جلب الفرع
  const { data: branch, error: branchErr } = await (supabase as any)
    .from("branches")
    .select("id, name, slug, code")
    .eq("slug", slug)
    .single();

  if (branchErr || !branch) {
    return NextResponse.json({ error: "الفرع غير موجود" }, { status: 404 });
  }

  // حساب نطاق التاريخ
  const riyadhNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  let fromDate: string, toDate: string;

  if (fromParam && toParam) {
    // نطاق مخصص
    fromDate = fromParam;
    toDate   = toParam;
  } else if (fromParam) {
    fromDate = toDate = fromParam;
  } else if (date) {
    fromDate = toDate = date;
  } else {
    switch (period) {
      case "yesterday": {
        const d = new Date(riyadhNow); d.setDate(d.getDate() - 1);
        fromDate = toDate = d.toISOString().slice(0, 10);
        break;
      }
      case "week": {
        const d = new Date(riyadhNow); d.setDate(d.getDate() - 6);
        fromDate = d.toISOString().slice(0, 10);
        toDate = riyadhNow.toISOString().slice(0, 10);
        break;
      }
      case "month": {
        fromDate = `${riyadhNow.getFullYear()}-${String(riyadhNow.getMonth() + 1).padStart(2,"0")}-01`;
        toDate = riyadhNow.toISOString().slice(0, 10);
        break;
      }
      default: // today
        fromDate = toDate = riyadhNow.toISOString().slice(0, 10);
    }
  }

  const fromUTC = `${fromDate}T00:00:00+03:00`;
  const toUTC   = `${toDate}T23:59:59+03:00`;

  // ─── جلب الفواتير ───
  const { data: rawSales } = await (supabase as any)
    .from("sales")
    .select("id, total, paid_amount, payment_method, mixed_cash_amount, mixed_network_amount, document_type, invoice_number, sale_date, cashier_name")
    .eq("branch_id", branch.id)
    .gte("sale_date", fromUTC)
    .lte("sale_date", toUTC)
    .order("sale_date", { ascending: false });

  const sales = (rawSales || []) as any[];

  // ─── جلب أصناف الفواتير مع mapping ───
  const saleIds = sales.map((s: any) => s.id);
  let saleItems: any[] = [];
  if (saleIds.length > 0) {
    const { data: rawItems } = await (supabase as any)
      .from("sale_items")
      .select("id, sale_id, product_name, quantity, unit_price, total")
      .in("sale_id", saleIds);
    saleItems = rawItems || [];
  }

  // ─── جلب product_mappings ───
  const { data: rawMappings } = await (supabase as any)
    .from("product_mappings")
    .select("aronium_name, category");
  const mappings: Record<string, string> = {};
  for (const m of (rawMappings || [])) {
    mappings[m.aronium_name] = m.category;
  }

  // ─── تجميع الأرقام ───
  let totalSales = 0, totalReturns = 0, invoiceCount = 0;
  let cash = 0, network = 0, transfer = 0, deferred = 0, mixed = 0, unknownPay = 0;

  const byCategory: Record<string, { qty: number; amount: number }> = {
    hashi: { qty: 0, amount: 0 },
    sheep: { qty: 0, amount: 0 },
    beef:  { qty: 0, amount: 0 },
    offal: { qty: 0, amount: 0 },
    other: { qty: 0, amount: 0 },
  };

  // مجموعة IDs الفواتير العادية (ليست مرتجعات) — لاستخدامها عند تجميع الأصناف
  const normalSaleIds = new Set<string>();
  // جمع طرق الدفع الفريدة للـ debug
  const uniquePayMethods = new Set<string>();

  // تجميع المبيعات
  for (const row of sales) {
    const amount = Math.abs(Number(row.total ?? 0));
    const isReturn = (row.document_type ?? "").toLowerCase().includes("refund") ||
                     (row.document_type ?? "").toLowerCase().includes("return");
    if (isReturn) { totalReturns += amount; continue; }

    normalSaleIds.add(row.id); // فاتورة عادية
    totalSales += amount;
    invoiceCount++;

    const methodRaw = (row.payment_method ?? "").trim();
    const method    = methodRaw.toLowerCase();
    const paid      = Math.abs(Number(row.paid_amount ?? row.total ?? 0));

    uniquePayMethods.add(methodRaw); // للـ debug

    if (
      method.includes("cash") || method.includes("نقد") ||
      method.includes("كاش") || method === "1"
    ) {
      cash += paid;
    } else if (
      method.includes("card") || method.includes("network") ||
      method.includes("شبكة") || method === "2"
    ) {
      network += paid;
    } else if (
      method.includes("transfer") || method.includes("تحويل") ||
      method.includes("bank") || method === "3"
    ) {
      transfer += paid;
    } else if (
      method.includes("deferred") || method.includes("credit") ||
      method.includes("آجل")      || method.includes("account") ||
      method.includes("بالحساب") || method.includes("حساب") ||
      method.includes("on account") || method.includes("tab") ||
      method === "4" || method === "5"
    ) {
      deferred += paid;
    } else if (method === "mixed") {
      // دفع مختلط: نوزّع على كاش وشبكة حسب التفاصيل المحفوظة
      const mCash = Math.abs(Number(row.mixed_cash_amount ?? 0));
      const mNet  = Math.abs(Number(row.mixed_network_amount ?? 0));
      if (mCash > 0 || mNet > 0) {
        cash    += mCash;
        network += mNet;
        // ما تبقى (transfer أو deferred داخل المختلط) يضاف كـ mixed
        const remainder = paid - mCash - mNet;
        if (remainder > 0) mixed += remainder;
      } else {
        // لم تُحفظ التفاصيل بعد (بيانات قديمة) — نحتفظ كمختلط
        mixed += paid;
      }
    } else {
      // ⚠️ طريقة دفع غير معروفة — لا تُضاف للكاش بل تُحفظ كـ unknown
      unknownPay += paid;
    }
  }

  // تجميع الأصناف حسب الفئة ─ فقط لفواتير عادية (ليست مرتجعات)
  const productStats: Record<string, { qty: number; amount: number; category: string }> = {};
  for (const item of saleItems) {
    // ✅ تجاهل أصناف فواتير المرتجعات
    if (!normalSaleIds.has(item.sale_id)) continue;

    const name = item.product_name || "غير معروف";
    const cat  = mappings[name] || "other";
    const qty  = Number(item.quantity || 0);
    const amt  = Number(item.total    || 0);

    byCategory[cat as keyof typeof byCategory].qty    += qty;
    byCategory[cat as keyof typeof byCategory].amount += amt;
    if (!productStats[name]) productStats[name] = { qty: 0, amount: 0, category: cat };
    productStats[name].qty    += qty;
    productStats[name].amount += amt;
  }

  // ترتيب المنتجات حسب المبلغ
  const topProducts = Object.entries(productStats)
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);

  const round = (n: number) => Math.round(n * 100) / 100;

  return NextResponse.json({
    branch: { id: branch.id, name: branch.name, slug: branch.slug, code: branch.code },
    period: { from: fromDate, to: toDate },
    summary: {
      totalSales:   round(totalSales),
      totalReturns: round(totalReturns),
      netSales:     round(totalSales - totalReturns),
      invoiceCount,
      cash:         round(cash),
      network:      round(network),
      transfer:     round(transfer),
      deferred:     round(deferred),
      mixed:        round(mixed),
      unknownPay:   round(unknownPay),
    },
    // معلومات للتشخيص — تساعد في معرفة طرق الدفع الموجودة في قاعدة البيانات
    debug: {
      uniquePayMethods: [...uniquePayMethods],
    },
    byCategory: {
      hashi: { qty: round(byCategory.hashi.qty), amount: round(byCategory.hashi.amount) },
      sheep: { qty: round(byCategory.sheep.qty), amount: round(byCategory.sheep.amount) },
      beef:  { qty: round(byCategory.beef.qty),  amount: round(byCategory.beef.amount)  },
      offal: { qty: round(byCategory.offal.qty), amount: round(byCategory.offal.amount) },
      other: { qty: round(byCategory.other.qty), amount: round(byCategory.other.amount) },
    },
    topProducts,
    invoices: sales.slice(0, 50).map((s: any) => ({
      id: s.id,
      invoice_number:       s.invoice_number,
      total:                round(Math.abs(Number(s.total))),
      payment_method:       s.payment_method,
      mixed_cash_amount:    round(Math.abs(Number(s.mixed_cash_amount ?? 0))),
      mixed_network_amount: round(Math.abs(Number(s.mixed_network_amount ?? 0))),
      document_type:        s.document_type,
      sale_date:            s.sale_date,
      cashier_name:         s.cashier_name,
    })),
  });
}
