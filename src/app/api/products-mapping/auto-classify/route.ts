import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ── قواعد التصنيف التلقائي بالكلمات المفتاحية العربية ──
const RULES: { cat: string; keywords: string[] }[] = [
  {
    cat: "hashi",
    keywords: [
      "حاشي", "حاشى", "هجين", "جمل", "جمال", "جزور", "ناقة", "ناقه",
      "ابل", "إبل", "فحل", "جذع", "حوار", "قعود", "لقاح", "جمله",
    ],
  },
  {
    cat: "sheep",
    keywords: [
      "غنم", "خروف", "خراف", "ضأن", "ضاني", "حمل", "حملان", "نعجة",
      "نعجه", "نعاج", "كبش", "كباش", "حولي", "حوليات", "شياه", "خرفان",
      "ربع", "أغنام", "اغنام",
    ],
  },
  {
    cat: "beef",
    keywords: [
      "عجل", "عجول", "بقر", "بقرة", "بقره", "بتلو", "ثور", "تلو",
      "كدين", "لحم بقر", "لحم عجل", "رضيع",
    ],
  },
  {
    cat: "offal",
    keywords: [
      "كبد", "كبدة", "كبده", "كراع", "كوارع", "اكارع", "أكارع",
      "مخلفات", "رقبة", "رقبه", "رقاب", "نخاع", "طحال", "قلب",
      "كرش", "مصران", "مصارين", "ركس", "ذنب", "رأس", "راس", "لسان",
      "مفاصل", "بوز", "رئة", "رئه", "كلاوي", "عصبان", "مراق",
      "فشة", "فشه", "بطين", "جلد",
    ],
  },
];

function autoClassify(productName: string): string | null {
  const name = productName.trim().toLowerCase();
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (name.includes(kw)) return rule.cat;
    }
  }
  return null;
}

// POST: تصنيف تلقائي لكل المنتجات غير المصنّفة
export async function POST(_req: NextRequest) {
  const supabase = createServiceClient();

  // جلب كل أسماء المنتجات من sale_items
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

  const existing = new Set<string>(
    (rawMappings || []).map((m: any) => m.aronium_name)
  );

  // فلترة غير المصنّفة فقط وتصنيفها
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

  // حفظ الدفعة في قاعدة البيانات
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
