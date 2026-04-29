import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH /api/item-types/[id]  — تحديث meat_category
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15: params هو Promise يجب await
    const { id } = await context.params;

    if (!id || id === "undefined") {
      return NextResponse.json({ error: "معرّف الصنف غير صالح" }, { status: 400 });
    }

    const body = await req.json();
    const { meat_category } = body;

    const validCategories = ["hashi", "sheep", "beef", "offal", null];
    if (!validCategories.includes(meat_category)) {
      return NextResponse.json(
        { error: "قيمة meat_category غير صالحة" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("item_types")
      .update({ meat_category: meat_category ?? null })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PATCH item-type error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
