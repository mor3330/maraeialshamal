import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET: جلب كل أسماء المنتجات الفريدة مع تصنيفاتها الحالية
export async function GET(_req: NextRequest) {
  const supabase = createServiceClient();

  // ── جلب أسماء المنتجات الفريدة بـ RPC لتجنب حد الـ 1000 صف ──
  // نستخدم استعلام SQL مباشر عبر rpc أو نجلب بـ range
  // الحل: جلب مجمّع من قاعدة البيانات مباشرةً
  const { data: rawItems, error: itemsErr } = await (supabase as any)
    .rpc("get_distinct_product_names");

  let allNames: string[] = [];

  if (itemsErr || !rawItems) {
    // fallback: جلب بصفحات 1000 × 1000 حتى نحصل على كل الأسماء
    let page = 0;
    const pageSize = 1000;
    const nameSet = new Set<string>();
    while (true) {
      const { data: chunk } = await (supabase as any)
        .from("sale_items")
        .select("product_name")
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (!chunk || chunk.length === 0) break;
      for (const r of chunk) {
        const n = r.product_name?.trim();
        if (n) nameSet.add(n);
      }
      if (chunk.length < pageSize) break; // آخر صفحة
      page++;
    }
    allNames = [...nameSet];
  } else {
    allNames = (rawItems as any[])
      .map((r: any) => (r.product_name || r.name || "")?.trim())
      .filter(Boolean);
  }

  // ── جلب التصنيفات الحالية ──
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
