import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* POST /api/purchases/bulk-update-price
   Body: {
     dateFrom: "2026-04-01",
     dateTo:   "2026-04-30",
     supplier_id:   string | null,   // null = كل الموردين
     item_type_id:  string,
     price_per_unit: number,          // السعر لكل وحدة (رأس أو كجم)
     pricing_method: "quantity" | "weight"
   }
   يعيد: { updated: number }
*/
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dateFrom, dateTo, branch_id, supplier_id, item_type_id, price_per_unit, pricing_method } = body;

    if (!dateFrom || !dateTo || !item_type_id || !price_per_unit || !pricing_method) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const pricePerUnit = Number(price_per_unit);
    if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
      return NextResponse.json({ error: "السعر غير صالح" }, { status: 400 });
    }

    // 1️⃣ جلب السجلات المطابقة للمعايير
    let query = supabase
      .from("purchases")
      .select("id, quantity, weight")
      .eq("item_type_id", item_type_id)
      .gte("purchase_date", dateFrom)
      .lte("purchase_date", dateTo);

    if (branch_id)   query = query.eq("branch_id",   branch_id);
    if (supplier_id) query = query.eq("supplier_id", supplier_id);

    const { data: rows, error: fetchErr } = await query;
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!rows || rows.length === 0) {
      return NextResponse.json({ updated: 0, message: "لا توجد سجلات تطابق المعايير" });
    }

    // 2️⃣ حساب السعر الجديد لكل سجل وتحديثه
    let updatedCount = 0;
    const updates = rows.map(row => {
      const qty = Number(row.quantity) || 0;
      const wt  = Number(row.weight)   || 0;
      const newPrice = pricing_method === "weight"
        ? pricePerUnit * wt
        : pricePerUnit * qty;
      return { id: row.id, price: Math.round(newPrice * 100) / 100 };
    });

    // تحديث دفعات (Supabase لا يدعم UPDATE IN الحقيقية)
    // نستخدم Promise.all مع PATCH فردي
    const batchSize = 50;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(u =>
          supabase.from("purchases").update({ price: u.price }).eq("id", u.id)
        )
      );
      for (const r of results) {
        if (!r.error) updatedCount++;
      }
    }

    return NextResponse.json({ updated: updatedCount, total: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "خطأ غير متوقع" }, { status: 500 });
  }
}

/* GET /api/purchases/bulk-update-price — معاينة عدد السجلات قبل التحديث */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom      = searchParams.get("dateFrom");
    const dateTo        = searchParams.get("dateTo");
    const branch_id     = searchParams.get("branch_id");
    const supplier_id   = searchParams.get("supplier_id");
    const item_type_id  = searchParams.get("item_type_id");

    if (!dateFrom || !dateTo || !item_type_id) {
      return NextResponse.json({ count: 0 });
    }

    let query = supabase
      .from("purchases")
      .select("id, quantity, weight, purchase_date, price, branches(name), suppliers(name)", { count: "exact" })
      .eq("item_type_id", item_type_id)
      .gte("purchase_date", dateFrom)
      .lte("purchase_date", dateTo);

    if (branch_id)   query = query.eq("branch_id",   branch_id);
    if (supplier_id) query = query.eq("supplier_id", supplier_id);

    const { count, data, error } = await query;
    if (error) return NextResponse.json({ count: 0, error: error.message });

    return NextResponse.json({ count: count ?? 0, rows: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ count: 0, error: err.message });
  }
}
