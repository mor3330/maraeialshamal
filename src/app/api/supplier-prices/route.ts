// @ts-nocheck
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET: جلب الأسعار
export async function GET() {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from("supplier_item_prices")
    .select(`
      *,
      suppliers(id, name),
      item_types(id, name)
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ prices: data ?? [] });
}

// POST: إضافة سعر
export async function POST(request: Request) {
  const supabase = createServiceClient();
  
  try {
    const body = await request.json();
    const { supplier_id, item_type_id, price_per_unit, pricing_method } = body;
    
    if (!supplier_id || !item_type_id || !price_per_unit) {
      return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from("supplier_item_prices")
      .insert([{ 
        supplier_id,
        item_type_id,
        price_per_unit: parseFloat(price_per_unit),
        pricing_method: pricing_method || 'quantity'
      }])
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ price: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "خطأ في معالجة الطلب" }, { status: 500 });
  }
}

// PUT: تعديل سعر
export async function PUT(request: Request) {
  const supabase = createServiceClient();
  
  try {
    const body = await request.json();
    const { id, price_per_unit } = body;
    
    if (!id || !price_per_unit) {
      return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from("supplier_item_prices")
      .update({ 
        price_per_unit: parseFloat(price_per_unit),
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ price: data });
  } catch (err) {
    return NextResponse.json({ error: "خطأ في معالجة الطلب" }, { status: 500 });
  }
}

// DELETE: حذف سعر
export async function DELETE(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  
  if (!id) {
    return NextResponse.json({ error: "معرف السعر مطلوب" }, { status: 400 });
  }
  
  const { error } = await supabase
    .from("supplier_item_prices")
    .update({ is_active: false })
    .eq("id", id);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true });
}
