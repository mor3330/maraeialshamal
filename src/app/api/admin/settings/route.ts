import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/admin/settings?type=meat_types|payment_methods
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const type = new URL(request.url).searchParams.get("type");

  if (type === "meat_types") {
    const { data, error } = await supabase
      .from("meat_types")
      .select("id, name, category, unit, has_count, sort_order, is_active")
      .order("sort_order");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  if (type === "payment_methods") {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("id, name, code, sort_order, is_active")
      .order("sort_order");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "type required" }, { status: 400 });
}

// POST /api/admin/settings?type=meat_types|payment_methods
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const type = new URL(request.url).searchParams.get("type");
  const body = await request.json();

  if (type === "meat_types") {
    const { data, error } = await supabase
      .from("meat_types")
      .insert({ name: body.name, category: body.category ?? "other", unit: "kg", has_count: body.has_count ?? false, sort_order: body.sort_order ?? 99, is_active: true } as any)
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  if (type === "payment_methods") {
    const { data, error } = await supabase
      .from("payment_methods")
      .insert({ name: body.name, code: body.code ?? body.name, sort_order: body.sort_order ?? 99, is_active: true } as any)
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "type required" }, { status: 400 });
}

// PATCH /api/admin/settings?type=...&id=...
export async function PATCH(request: NextRequest) {
  const supabase = createServiceClient();
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  const body = await request.json();

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (type === "meat_types") {
    const { data, error } = await supabase.from("meat_types").update(body as never).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  if (type === "payment_methods") {
    const { data, error } = await supabase.from("payment_methods").update(body as never).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "type required" }, { status: 400 });
}

// DELETE /api/admin/settings?type=...&id=...
export async function DELETE(request: NextRequest) {
  const supabase = createServiceClient();
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const table = type === "meat_types" ? "meat_types" : type === "payment_methods" ? "payment_methods" : null;
  if (!table) return NextResponse.json({ error: "type required" }, { status: 400 });

  const { error } = await supabase.from(table as "meat_types").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
