import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent";

export interface ScannedProduct {
  code: string;
  name: string;
  quantity: number;
  total: number;
  category: "hashi" | "sheep" | "beef" | "offal" | "other";
}

export interface SalesScanResult {
  products: ScannedProduct[];
  /** مجاميع حسب الفئة */
  totals: {
    hashi: { qty: number; amount: number };
    sheep: { qty: number; amount: number };
    beef: { qty: number; amount: number };
    offal: { qty: number; amount: number };
    other: { qty: number; amount: number };
  };
  grand_total: number;
  raw_text?: string;
}

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "مفتاح Gemini غير مُضبوط في الخادم" },
      { status: 500 }
    );
  }

  let body: { imageBase64: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { imageBase64, mimeType = "image/jpeg" } = body;
  if (!imageBase64) {
    return NextResponse.json({ error: "لم يتم إرسال الصورة" }, { status: 400 });
  }

  const base64Data = imageBase64.includes(",")
    ? imageBase64.split(",")[1]
    : imageBase64;

  const prompt = `أنت نظام OCR متخصص في نسخ جداول المبيعات. مهمتك: انسخ الأرقام بالضبط كما تراها في الجدول — لا تُقرّب، لا تحسب، لا تخترع.

الصورة تحتوي تقرير "مبيعات حسب المنتج" من جهاز POS.

⚠️ قاعدة صارمة: انسخ كل رقم حرفياً كما يظهر في الجدول. إذا مكتوب 377.00 اكتب 377.00 وليس 377.

لكل صف في الجدول استخرج:
- name: اسم المنتج كما هو مكتوب بالضبط
- code: رمز المنتج إذا موجود (وإلا "")
- quantity: الكمية كما هي (عشري أو صحيح)
- total: الإجمالي كما هو — انسخ الرقم حرفياً

تصنيف كل منتج:
- "hashi": يحتوي على: حاشي، هجين، جمل، ناقة، جزور، قعود، بكرة
- "sheep": يحتوي على: غنم، غنمي، خروف، ضأن، حمل، نعجة، خراف، نعيمي، سواكني، نجدي، هري، عربي، صخمي، ذبيحة
- "beef": يحتوي على: عجل، بقر، بتلو، ثور، تلو
- "offal": يحتوي على: كبدة، كبد، كراع، كوارع، رأس، راس، مخلفات، رقبة، نخاع، طحال، قلب، كرش، مصران، ذنب، لسان، معاصيب
- "other": أي شيء آخر

أجب بـ JSON خام فقط:
{"products": [{"code": "00012", "name": "اسم المنتج", "quantity": 5.155, "total": 377.00, "category": "hashi"}]}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048,
    },
  };

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[sales-scanner] Gemini error:", errText);
      if (geminiRes.status === 429) {
        return NextResponse.json(
          { error: "تم تجاوز الحد المسموح مؤقتاً، انتظر دقيقة وحاول مجدداً" },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "فشل الاتصال بخدمة الذكاء الاصطناعي", details: errText },
        { status: 502 }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    console.log("[sales-scanner] Gemini raw:", rawText);

    // Parse JSON
    let parsed: { products: ScannedProduct[] };
    try {
      const cleaned = rawText
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("[sales-scanner] Parse error:", e);
      return NextResponse.json(
        { error: "فشلت قراءة الجدول. جرب صورة أوضح مع إضاءة أفضل.", raw_text: rawText },
        { status: 422 }
      );
    }

    // Normalize products
    const products: ScannedProduct[] = (parsed.products || []).map((p) => ({
      code: String(p.code || ""),
      name: String(p.name || "").trim(),
      quantity: Math.max(0, Number(p.quantity) || 0),
      total: Math.max(0, Number(p.total) || 0),
      category: (["hashi", "sheep", "beef", "offal", "other"].includes(p.category)
        ? p.category
        : "other") as ScannedProduct["category"],
    })).filter((p) => p.name && (p.quantity > 0 || p.total > 0));

    // Calculate totals by category
    const totals: SalesScanResult["totals"] = {
      hashi: { qty: 0, amount: 0 },
      sheep: { qty: 0, amount: 0 },
      beef:  { qty: 0, amount: 0 },
      offal: { qty: 0, amount: 0 },
      other: { qty: 0, amount: 0 },
    };

    let grand_total = 0;
    for (const p of products) {
      totals[p.category].qty += p.quantity;
      totals[p.category].amount += p.total;
      grand_total += p.total;
    }

    // Round
    for (const cat of Object.keys(totals) as Array<keyof typeof totals>) {
      totals[cat].qty = Math.round(totals[cat].qty * 1000) / 1000;
      totals[cat].amount = Math.round(totals[cat].amount * 100) / 100;
    }
    grand_total = Math.round(grand_total * 100) / 100;

    const result: SalesScanResult = {
      products,
      totals,
      grand_total,
      raw_text: rawText,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[sales-scanner] Unexpected:", err);
    return NextResponse.json({ error: "خطأ غير متوقع في الخادم" }, { status: 500 });
  }
}
