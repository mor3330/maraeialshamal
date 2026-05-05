// @ts-nocheck
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET: جلب الأصناف
export async function GET() {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from("item_types")
    .select("*")
    .eq("is_active", true)
    .order("display_order")
    .order("name");
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ itemTypes: data ?? [] });
}

// POST: إضافة صنف
export async function POST(request: Request) {
  const supabase = createServiceClient();
  
  try {
    const body = await request.json();
    const { name, display_order, pricing_method, meat_category } = body;
    
    if (!name) {
      return NextResponse.json({ error: "اسم الصنف مطلوب" }, { status: 400 });
    }
    
    const targetOrder = display_order || 1;
    
    // دفع الأصناف الأخرى التي ترتيبها >= الترتيب الجديد
    await supabase.rpc('increment_item_type_orders', { 
      start_order: targetOrder 
    });
    
    const { data, error } = await supabase
      .from("item_types")
      .insert([{ 
        name, 
        display_order: targetOrder,
        pricing_method: pricing_method || 'quantity',
        meat_category: meat_category || null,
      }])
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ itemType: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "خطأ في معالجة الطلب" }, { status: 500 });
  }
}

// PUT: تعديل صنف
export async function PUT(request: Request) {
  const supabase = createServiceClient();
  
  try {
    const body = await request.json();
    const { id, name, display_order, pricing_method, meat_category } = body;
    
    if (!id || !name) {
      return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
    }
    
    // جلب الترتيب القديم
    const { data: oldData } = await supabase
      .from("item_types")
      .select("display_order")
      .eq("id", id)
      .single();
    
    const oldOrder = oldData?.display_order || 0;
    const newOrder = display_order || oldOrder;
    
    // إذا تغير الترتيب، دفع الأصناف الأخرى
    if (newOrder !== oldOrder) {
      await supabase.rpc('increment_item_type_orders', { 
        start_order: newOrder 
      });
    }
    
    const { data, error } = await supabase
      .from("item_types")
      .update({ 
        name, 
        display_order: newOrder,
        pricing_method: pricing_method || 'quantity',
        meat_category: meat_category || null,
      })
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ itemType: data });
  } catch (err) {
    return NextResponse.json({ error: "خطأ في معالجة الطلب" }, { status: 500 });
  }
}

// DELETE: حذف صنف
export async function DELETE(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  
  if (!id) {
    return NextResponse.json({ error: "معرف الصنف مطلوب" }, { status: 400 });
  }
  
  // Soft delete
  const { error } = await supabase
    .from("item_types")
    .update({ is_active: false })
    .eq("id", id);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true });
}
