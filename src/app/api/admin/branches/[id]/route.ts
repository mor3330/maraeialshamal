import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const body = await request.json();

  const updateData: any = {};
  if (body.name) updateData.name = body.name;
  if (body.code) updateData.code = body.code.toUpperCase();
  if (body.slug) updateData.slug = body.slug.toLowerCase();
  if (typeof body.is_active       === 'boolean') updateData.is_active       = body.is_active;
  if (typeof body.pos_sync_enabled === 'boolean') updateData.pos_sync_enabled = body.pos_sync_enabled;

  if (body.pin) {
    const bcrypt = await import("bcryptjs");
    updateData.pin_hash = await bcrypt.hash(body.pin, 10);
  }

  const { data, error } = await supabase
    .from("branches")
    .update(updateData as never)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/branches");

  return NextResponse.json({ data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("branches")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/branches");

  return NextResponse.json({ success: true });
}
