// @ts-nocheck
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET: جلب المشتريات
export async function GET(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);

  const branchId = searchParams.get("branchId");
  const date = searchParams.get("date");
  const supplierId = searchParams.get("supplierId");
  const itemTypeId = searchParams.get("itemTypeId");

  let query = supabase
    .from("purchases")
    .select(`
      *,
      branches:branch_id(id, name),
      suppliers:supplier_id(id, name),
      item_types:item_type_id(id, name, name_en)
    `)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
  if (date && date !== 'undefined') query = query.eq("purchase_date", date);
  if (supplierId) query = query.eq("supplier_id", supplierId);
  if (itemTypeId) query = query.eq("item_type_id", itemTypeId);

  const { data, error } = await query.limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ purchases: data ?? [] });
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
        purchase_date: purchase_date || new Date().toISOString().split('T')[0],
        item_type_id,
        quantity: parseInt(quantity),
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
        quantity: parseInt(quantity),
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
