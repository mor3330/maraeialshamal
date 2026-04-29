import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET: جلب كل أسماء المنتجات مع تصنيفاتها الحالية
export async function GET(_req: NextRequest) {
  const supabase = createServiceClient();

  // جلب كل الأسماء الفريدة من sale_items
  const { data: rawItems } = await (supabase as any)
    .from("sale_items")
    .select("product_name");

  const allNames = [...new Set(
    (rawItems || [])
      .map((r: any) => r.product_name?.trim())
      .filter(Boolean)
  )] as string[];

  // جلب التصنيفات الحالية
  const { data: rawMappings } = await (supabase as any)
    .from("product_mappings")
    .select("aronium_name, category");

  const mappings: Record<string, string> = {};
  for (const m of (rawMappings || [])) {
    mappings[m.aronium_name] = m.category;
  }

  const products = allNames.map(name => ({
    name,
    category: mappings[name] || null,
  })).sort((a, b) => {
    // غير مصنّفة أولاً
    if (!a.category && b.category) return -1;
    if (a.category && !b.category) return 1;
    return a.name.localeCompare(b.name, "ar");
  });

  return NextResponse.json({ products, total: products.length });
}

// POST: حفظ تصنيف منتج
export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const body = await req.json();
  const { name, category } = body;

  if (!name || !category) {
    return NextResponse.json({ error: "name و category مطلوبان" }, { status: 400 });
  }

  const validCategories = ["hashi", "sheep", "beef", "offal", "other"];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: "فئة غير صحيحة" }, { status: 400 });
  }

  const { error } = await (supabase as any)
    .from("product_mappings")
    .upsert({ aronium_name: name, category }, { onConflict: "aronium_name" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE: حذف تصنيف
export async function DELETE(req: NextRequest) {
  const supabase = createServiceClient();
  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name مطلوب" }, { status: 400 });

  await (supabase as any)
    .from("product_mappings")
    .delete()
    .eq("aronium_name", name);

  return NextResponse.json({ success: true });
}
