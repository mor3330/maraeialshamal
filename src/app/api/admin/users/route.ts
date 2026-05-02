import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
) as any;

/* GET — جلب كل المستخدمين */
export async function GET() {
  const { data, error } = await sb
    .from("admin_users")
    .select("id, name, phone, is_active, permissions, allowed_branches, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

/* POST — إضافة مستخدم جديد */
export async function POST(req: NextRequest) {
  try {
    const { name, phone, pin, permissions, allowed_branches } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
    if (!pin || pin.length < 4) return NextResponse.json({ error: "رمز الدخول يجب أن يكون 4 أرقام على الأقل" }, { status: 400 });

    const pin_hash = await bcrypt.hash(String(pin), 10);

    const { data, error } = await sb
      .from("admin_users")
      .insert({ name: name.trim(), phone: phone || null, pin_hash, permissions: permissions ?? {}, allowed_branches: allowed_branches ?? null })
      .select("id, name, phone, is_active, permissions, allowed_branches, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ user: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
