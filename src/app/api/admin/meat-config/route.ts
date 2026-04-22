import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET all meat types with full config
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("meat_types")
    .select("id, name, category, unit, has_count, show_count, show_weight, count_label, weight_label, count_required, weight_required, sort_order, is_active")
    .order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

// PATCH single meat type config
export async function PATCH(request: NextRequest) {
  const supabase = createServiceClient();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const body = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data, error } = await supabase
    .from("meat_types")
    .update(body as never)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
