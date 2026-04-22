import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id, name, code, slug, is_active, created_at")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  
  // إضافة headers لمنع الـ cache
  return NextResponse.json(
    { branches: data || [] },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { name, code, slug, pin } = body;

  if (!name || !code || !slug || !pin) {
    return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 });
  }

  const bcrypt = await import("bcryptjs");
  const pin_hash = await bcrypt.hash(pin, 10);

  const { data, error } = await supabase
    .from("branches")
    .insert({ name, code: code.toUpperCase(), slug: slug.toLowerCase(), pin_hash, is_active: true } as any)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/branches");
  return NextResponse.json({ data });
}

export async function PUT(request: NextRequest) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { id, name, code, slug, is_active } = body;

  if (!id || !name) {
    return NextResponse.json({ error: "ID والاسم مطلوبان" }, { status: 400 });
  }

  const updateData: any = { name };
  if (code) updateData.code = code.toUpperCase();
  if (slug) updateData.slug = slug.toLowerCase();
  if (typeof is_active === 'boolean') updateData.is_active = is_active;

  const { data, error } = await supabase
    .from("branches")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/branches");
  return NextResponse.json({ data });
}
