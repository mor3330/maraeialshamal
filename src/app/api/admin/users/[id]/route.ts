import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
) as any;

/* PATCH — تعديل مستخدم */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const update: Record<string, any> = { updated_at: new Date().toISOString() };

    if (body.name !== undefined)             update.name             = body.name.trim();
    if (body.phone !== undefined)            update.phone            = body.phone || null;
    if (body.is_active !== undefined)        update.is_active        = body.is_active;
    if (body.permissions !== undefined)      update.permissions      = body.permissions;
    if (body.allowed_branches !== undefined) update.allowed_branches = body.allowed_branches;
    if (body.pin && body.pin.length >= 4)    update.pin_hash         = await bcrypt.hash(String(body.pin), 10);

    const { data, error } = await sb
      .from("admin_users")
      .update(update)
      .eq("id", params.id)
      .select("id, name, phone, is_active, permissions, allowed_branches, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ user: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/* DELETE — حذف مستخدم */
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await sb.from("admin_users").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
