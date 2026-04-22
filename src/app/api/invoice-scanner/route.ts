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

  const prompt = `أنت نظام ذكاء اصطناعي متخصص في قراءة تقارير وفواتير المبيعات اليومية للمتاجر في المملكة العربية السعودية. تعمل مع صور مصوّرة بالجوال لشاشات أجهزة نقاط البيع (POS) مثل EZPOS وزد وغيرها.

**أنواع التقارير التي ستتعامل معها:**

**النوع الأول: تقرير ملخص المدفوعات (Payment Summary)**
يظهر فيه: كاش، شبكة، تحويل، آجل، إجمالي المبيعات
→ استخرج جميع الحقول مباشرة

**النوع الثاني: تقرير مبيعات حسب المنتج (Sales by Product)**
يظهر فيه جدول بأعمدة مثل: الإجمالي، إجمالي قبل الضريبة، الكمية، المنتج
→ اجمع كل قيم عمود "الإجمالي" للحصول على total_sales
→ اجعل باقي الحقول (كاش/شبكة/تحويل) = 0 لأنها غير موجودة

**التصنيفات المطلوبة:**

1. **total_sales**: إجمالي المبيعات الكلي
   - في تقرير الملخص: قد يظهر "إجمالي المبيعات"، "المجموع"، "Total"، رقم بعد علامة "="
   - في تقرير المنتجات: اجمع كل قيم عمود "الإجمالي" أو "Grand Total"

2. **cash_amount**: مبلغ الكاش / النقد فقط
   - يظهر: "كاش"، "نقداً"، "Cash"
   - ⚠️ إذا كان تقرير مبيعات حسب المنتج فقط → اجعله 0

3. **network_amount**: مبلغ الشبكة / البطاقة
   - يظهر: "شبكة"، "مدى"، "Mada"، "Visa"، "بطاقة"، "POS"، "Card"
   - ⚠️ إذا كان تقرير مبيعات حسب المنتج فقط → اجعله 0

4. **transfer_amount**: مبلغ التحويل البنكي فقط (غير آجل)
   - يظهر: "تحويل"، "تحويل بنكي"، "Transfer"، "Bank Transfer"

5. **deferred_amount**: مبلغ الآجل / المؤجل فقط (غير تحويل)
   - يظهر: "آجل"، "مؤجل"، "Deferred"، "Credit"

6. **invoice_count**: عدد الفواتير أو الطلبات (رقم صحيح)
   - في تقرير المنتجات: قد يكون عدد الصفوف أو موجود في رأس التقرير

7. **returns_value**: قيمة المرتجعات
   - يظهر: "مرتجعات"، "Returns"، "Refunds"

**قواعد:**
- اقرأ الأرقام بدقة حتى لو الصورة من شاشة كمبيوتر
- إذا لم تجد قيمة، اجعلها 0
- أجب بـ JSON خام فقط بدون markdown

أمثلة:
ملخص مدفوعات: {"total_sales": 10602.98, "cash_amount": 3435.99, "network_amount": 6178.99, "transfer_amount": 280.00, "deferred_amount": 710.00, "invoice_count": 84, "returns_value": 0}
مبيعات بالمنتج: {"total_sales": 11405.98, "cash_amount": 0, "network_amount": 0, "transfer_amount": 0, "deferred_amount": 0, "invoice_count": 0, "returns_value": 0}`;

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
      temperature: 0.1,
      topK: 1,
      topP: 1,
      maxOutputTokens: 512,
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
