// @ts-nocheck
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET: جلب المشترين
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("buyers")
    .select("*")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ buyers: data ?? [] });
}

// POST: إضافة مشترٍ
export async function POST(request: Request) {
  const supabase = createServiceClient();
  try {
    const { name, phone, notes } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "اسم المشترٍ مطلوب" }, { status: 400 });

    const { data, error } = await supabase
      .from("buyers")
      .insert([{ name: name.trim(), phone: phone?.trim() || null, notes: notes?.trim() || null }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ buyer: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطأ في معالجة الطلب" }, { status: 500 });
  }
}

// PATCH: تعديل مشترٍ
export async function PATCH(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "معرف المشترٍ مطلوب" }, { status: 400 });

  try {
    const { name, phone, notes } = await request.json();
    const { data, error } = await supabase
      .from("buyers")
      .update({ name: name?.trim(), phone: phone?.trim() || null, notes: notes?.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ buyer: data });
  } catch {
    return NextResponse.json({ error: "خطأ في معالجة الطلب" }, { status: 500 });
  }
}

// DELETE: حذف مشترٍ
export async function DELETE(request: Request) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "معرف المشترٍ مطلوب" }, { status: 400 });

  const { error } = await supabase.from("buyers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
