// @ts-nocheck
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET: جلب المشتريات — يدعم pagination لجلب كل السجلات
export async function GET(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);

  const branchId   = searchParams.get("branchId");
  const date       = searchParams.get("date");
  const dateFrom   = searchParams.get("dateFrom");
  const dateTo     = searchParams.get("dateTo");
  const supplierId = searchParams.get("supplierId");
  const itemTypeId = searchParams.get("itemTypeId");
  // دعم all=true لجلب كل السجلات بدون حد (pagination تلقائي)
  const fetchAll   = searchParams.get("all") === "true";

  function buildQuery() {
    let q = supabase
      .from("purchases")
      .select(`
        *,
        branches:branch_id(id, name),
        suppliers:supplier_id(id, name),
        item_types:item_type_id(id, name, name_en, meat_category)
      `)
      .order("purchase_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (branchId)  q = q.eq("branch_id", branchId);
    if (date && date !== "undefined") q = q.eq("purchase_date", date);
    if (dateFrom)  q = q.gte("purchase_date", dateFrom);
    if (dateTo)    q = q.lte("purchase_date", dateTo);
    if (supplierId) q = q.eq("supplier_id", supplierId);
    if (itemTypeId) q = q.eq("item_type_id", itemTypeId);

    return q;
  }

  try {
    if (fetchAll) {
      // جلب كل السجلات عبر pagination (1000 سجل في كل مرة)
      const PAGE = 1000;
      let all: any[] = [];
      let page = 0;
      while (true) {
        const { data, error } = await buildQuery().range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        all = all.concat(data ?? []);
        if (!data || data.length < PAGE) break;
        page++;
      }
      return NextResponse.json({ purchases: all });
    } else {
      // الوضع الاعتيادي مع حد قابل للتعديل
      const limitParam = searchParams.get("limit");
      const limitVal   = limitParam ? Math.min(parseInt(limitParam) || 2000, 100000) : 2000;
      const { data, error } = await buildQuery().range(0, limitVal - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ purchases: data ?? [] });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "خطأ في الخادم" }, { status: 500 });
  }
}

// POST: إضافة مشترى
export async function POST(request: Request) {
  const supabase = createServiceClient();

  try {
    const body = await request.json();
    const { branch_id, supplier_id, purchase_date, item_type_id, quantity, weight, price, notes } = body;

    if (!branch_id || !item_type_id) {
      return NextResponse.json({ error: "الفرع والصنف مطلوبان" }, { status: 400 });
    }
    if (!quantity && quantity !== 0) {
      return NextResponse.json({ error: "العدد مطلوب" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("purchases")
      .insert([{
        branch_id,
        supplier_id: supplier_id || null,
        purchase_date: purchase_date || new Date().toISOString().split("T")[0],
        item_type_id,
        quantity: parseFloat(quantity),
        weight: parseFloat(weight),
        price: parseFloat(price),
        notes: notes || null,
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ purchase: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "خطأ في معالجة الطلب" }, { status: 500 });
  }
}

// PATCH: تعديل مشترى
export async function PATCH(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "معرف المشترى مطلوب" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { supplier_id, item_type_id, quantity, weight, price } = body;

    const { data, error } = await supabase
      .from("purchases")
      .update({
        supplier_id: supplier_id || null,
        item_type_id,
        quantity: parseFloat(quantity),
        weight: parseFloat(weight),
        price: parseFloat(price),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ purchase: data });
  } catch (err) {
    return NextResponse.json({ error: "خطأ في معالجة الطلب" }, { status: 500 });
  }
}

// DELETE: حذف مشترى
export async function DELETE(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "معرف المشترى مطلوب" }, { status: 400 });
  }

  const { error } = await supabase
    .from("purchases")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
