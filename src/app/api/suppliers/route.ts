// @ts-nocheck
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET: جلب الموردين
export async function GET() {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("is_active", true)
    .order("name");
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ suppliers: data ?? [] });
}

// POST: إضافة مورد
export async function POST(request: Request) {
  const supabase = createServiceClient();
  
  try {
    const body = await request.json();
    const { name, phone, notes } = body;
    
    if (!name) {
      return NextResponse.json({ error: "اسم المورد مطلوب" }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from("suppliers")
      .insert([{ name, phone: phone || null, notes: notes || null }])
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ supplier: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "خطأ في معالجة الطلب" }, { status: 500 });
  }
}

// PUT: تعديل مورد
export async function PUT(request: Request) {
  const supabase = createServiceClient();
  
  try {
    const body = await request.json();
    const { id, name, phone, notes } = body;
    
    if (!id || !name) {
      return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from("suppliers")
      .update({ name, phone: phone || null, notes: notes || null })
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ supplier: data });
  } catch (err) {
    return NextResponse.json({ error: "خطأ في معالجة الطلب" }, { status: 500 });
  }
}

// DELETE: حذف مورد
export async function DELETE(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  
  if (!id) {
    return NextResponse.json({ error: "معرف المورد مطلوب" }, { status: 400 });
  }
  
  // Soft delete
  const { error } = await supabase
    .from("suppliers")
    .update({ is_active: false })
    .eq("id", id);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true });
}
