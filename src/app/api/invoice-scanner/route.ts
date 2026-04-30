import { NextRequest, NextResponse } from "next/server";

// زيادة مدة الانتظار لـ 60 ثانية (مهم لـ Vercel)
export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent";

export interface InvoiceScanResult {
  total_sales: number;
  cash_amount: number;
  network_amount: number;
  transfer_amount: number;
  deferred_amount: number;
  invoice_count: number;
  returns_value: number;
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

  // Remove data URL prefix if present
  const base64Data = imageBase64.includes(",")
    ? imageBase64.split(",")[1]
    : imageBase64;

  const prompt = `أنت نظام OCR متخصص فقط في نسخ الأرقام من تقارير المبيعات. مهمتك الوحيدة: انسخ الرقم الموجود بجانب كل تسمية بالضبط كما يظهر في الصورة. لا تُقرّب، لا تحسب، لا تخترع.

══════════════════════════════════════════
⚠️ قواعد صارمة جداً — لا استثناء:
══════════════════════════════════════════

1. انسخ الرقم كما هو بالضبط: إذا مكتوب 5680 اكتب 5680، إذا مكتوب 424.90 اكتب 424.90
2. لا تُقرّب أي رقم مهما كان
3. لا تعكس الأرقام بين الحقول أبداً
4. الرقم المجاور لكلمة "كاش" يذهب إلى cash_amount فقط
5. الرقم المجاور لكلمة "شبكة" يذهب إلى network_amount فقط
6. إذا لم تجد قيمة واضحة → اجعلها 0

══════════════════════════════════════════
كيف تقرأ الفاتورة:
══════════════════════════════════════════

ابحث عن هذه التسميات وانسخ الرقم بجانب كل واحدة:

cash_amount → التسمية: "كاش" أو "نقداً" أو "Cash" أو "نقد"
network_amount → التسمية: "شبكة" أو "مدى" أو "Mada" أو "Visa" أو "بطاقة" أو "Card"
transfer_amount → التسمية: "تحويل" أو "تحويل بنكي" أو "Transfer"
deferred_amount → التسمية: "آجل" أو "مؤجل" أو "Deferred" أو "آجل"
total_sales → التسمية: "إجمالي المبيعات" أو "المجموع" أو "Total" أو "الإجمالي"
invoice_count → التسمية: "عدد الفواتير" أو "عدد الطلبات" أو "Orders"
returns_value → التسمية: "مرتجعات" أو "Returns" أو "Refunds"

══════════════════════════════════════════
تحقق ذاتي قبل الإجابة:
══════════════════════════════════════════
- هل الرقم بجانب "كاش" هو cash_amount؟ ✓
- هل الرقم بجانب "شبكة" هو network_amount؟ ✓
- هل النسخ حرفي 100% بدون تقريب؟ ✓

أجب بـ JSON خام فقط بدون markdown بدون شرح:
{"total_sales": X, "cash_amount": X, "network_amount": X, "transfer_amount": X, "deferred_amount": X, "invoice_count": X, "returns_value": X}`;

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
      maxOutputTokens: 256,
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
      console.error("[invoice-scanner] Gemini error:", errText);
      // رسالة مخصصة للحد المجاني
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

    console.log("[invoice-scanner] Gemini raw response:", rawText);

    // Extract JSON from response
    let parsed: InvoiceScanResult;
    try {
      // Clean up the response - remove markdown if present
      const cleaned = rawText
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      // Find JSON object
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");

      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("[invoice-scanner] Parse error:", parseErr, "Raw:", rawText);
      return NextResponse.json(
        {
          error: "لم أتمكن من قراءة بيانات الفاتورة بدقة. جرب صورة أوضح.",
          raw_text: rawText,
        },
        { status: 422 }
      );
    }

    // Ensure all fields are numbers and non-negative
    const result: InvoiceScanResult = {
      total_sales: Math.max(0, Number(parsed.total_sales) || 0),
      cash_amount: Math.max(0, Number(parsed.cash_amount) || 0),
      network_amount: Math.max(0, Number(parsed.network_amount) || 0),
      transfer_amount: Math.max(0, Number(parsed.transfer_amount) || 0),
      deferred_amount: Math.max(0, Number(parsed.deferred_amount) || 0),
      invoice_count: Math.max(0, Math.round(Number(parsed.invoice_count) || 0)),
      returns_value: Math.max(0, Number(parsed.returns_value) || 0),
      raw_text: rawText,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[invoice-scanner] Unexpected error:", err);
    return NextResponse.json(
      { error: "خطأ غير متوقع في الخادم" },
      { status: 500 }
    );
  }
}
