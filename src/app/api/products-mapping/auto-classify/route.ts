import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ── قواعد التصنيف التلقائي بالكلمات المفتاحية العربية ──
// الترتيب مهم: مخلفات أولاً قبل حاشي/غنم/عجل لأن "كبدة حاشي" → مخلفات وليس حاشي
const RULES: { cat: string; keywords: string[] }[] = [
  {
    // مخلفات أولاً لأن "كبدة حاشي" يجب أن يكون مخلفات لا حاشي
    cat: "offal",
    keywords: [
      "كبد", "كبدة", "كبده", "كراع", "كوارع", "اكارع", "أكارع",
      "مخلفات", "رقبة", "رقبه", "رقاب", "نخاع", "طحال", "قلب",
      "كرش", "مصران", "مصارين", "ركس", "ذنب", "رأس", "راس", "لسان",
      "مفاصل", "بوز", "رئة", "رئه", "كلاوي", "عصبان", "مراق",
      "فشة", "فشه", "بطين", "جلد", "معاصيب", "معصوب", "خد",
    ],
  },
  {
    cat: "hashi",
    keywords: [
      "حاشي", "حاشى", "هجين", "جمل", "جمال", "جزور", "ناقة", "ناقه",
      "ابل", "إبل", "فحل", "جذع", "حوار", "قعود", "لقاح", "جمله",
      "بكرة", "بكره", "حواره",
    ],
  },
  {
    cat: "sheep",
    keywords: [
      "غنم", "غنمي", "غنمية", "خروف", "خراف", "ضأن", "ضاني", "حمل",
      "حملان", "نعجة", "نعجه", "نعاج", "كبش", "كباش", "حولي",
      "حوليات", "شياه", "خرفان", "ربع", "أغنام", "اغنام",
      // أنواع الغنم الشائعة في السعودية
      "نعيمي", "نعيمية", "سواكني", "سواكنية", "نجدي", "نجدية",
      "هري", "هرية", "عربي", "عربية", "صخمي", "صخمية",
      "مهجن", "مهجنة", "بربري", "عواسي", "حجازي",
      // ذبيحة غنم
      "ذبيحة", "نص ذبيحة",
    ],
  },
  {
    cat: "beef",
    keywords: [
      "عجل", "عجول", "بقر", "بقرة", "بقره", "بتلو", "ثور", "تلو",
      "كدين", "رضيع", "هولشتاين",
    ],
  },
];

function autoClassify(productName: string): string | null {
  const name = productName.trim();
  // لا نستخدم toLowerCase() لأن العربية لا تتأثر به — نقارن مباشرة
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (name.includes(kw)) return rule.cat;
    }
  }
  return null;
}

// ── جلب كل أسماء المنتجات الفريدة (مع Pagination لتجاوز حد الـ 1000) ──
async function getAllProductNames(supabase: any): Promise<string[]> {
  // حاول أولاً عبر RPC
  const { data: rpcData, error: rpcErr } = await supabase.rpc("get_distinct_product_names");
  if (!rpcErr && rpcData && rpcData.length > 0) {
    return (rpcData as any[])
      .map((r: any) => (r.product_name || "")?.trim())
      .filter(Boolean);
  }

  // Fallback: صفحات 1000 × 1000
  const nameSet = new Set<string>();
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data: chunk } = await supabase
      .from("sale_items")
      .select("product_name")
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (!chunk || chunk.length === 0) break;
    for (const r of chunk) {
      const n = r.product_name?.trim();
      if (n) nameSet.add(n);
    }
    if (chunk.length < pageSize) break;
    page++;
  }
  return [...nameSet];
}

// POST: تصنيف تلقائي لكل المنتجات غير المصنّفة
export async function POST(_req: NextRequest) {
  const supabase = createServiceClient();

  // جلب كل الأسماء
  const allNames = await getAllProductNames(supabase);

  // جلب التصنيفات الحالية
  const { data: rawMappings } = await (supabase as any)
    .from("product_mappings")
    .select("aronium_name, category");

  const existing = new Set<string>(
    (rawMappings || []).map((m: any) => m.aronium_name)
  );

  // تصنيف غير المصنّفة
  const toInsert: { aronium_name: string; category: string }[] = [];
  const results: { name: string; category: string }[] = [];
  const skipped: string[] = [];

  for (const name of allNames) {
    if (existing.has(name)) continue; // مصنّفة مسبقاً
    const cat = autoClassify(name);
    if (cat) {
      toInsert.push({ aronium_name: name, category: cat });
      results.push({ name, category: cat });
    } else {
      skipped.push(name);
    }
  }

  // حفظ الدفعة
  if (toInsert.length > 0) {
    const { error } = await (supabase as any)
      .from("product_mappings")
      .upsert(toInsert, { onConflict: "aronium_name" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    classified: results.length,
    skipped: skipped.length,
    results,
    skippedNames: skipped,
  });
}
