import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const step = new URL(request.url).searchParams.get("step");
  const query = supabase
    .from("step_fields" as never)
    .select("*")
    .order("sort_order");
  if (step) (query as ReturnType<typeof supabase.from>).eq("step", Number(step));
  const { data, error } = await (step
    ? supabase.from("step_fields" as never).select("*").eq("step", Number(step)).order("sort_order")
    : supabase.from("step_fields" as never).select("*").order("step").order("sort_order"));
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { data, error } = await supabase
    .from("step_fields" as never)
    .insert(body as never)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  const supabase = createServiceClient();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const body = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data, error } = await supabase
    .from("step_fields" as never)
    .update(body as never)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServiceClient();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("step_fields" as never).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
