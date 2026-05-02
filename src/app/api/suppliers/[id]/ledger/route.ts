import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ── توليد رقم القيد ── */
async function generateEntryNumber(): Promise<string> {
  // أولاً: حاول RPC من قاعدة البيانات
  try {
    const { data, error } = await supabase.rpc("next_entry_number");
    if (!error && data) return data as string;
  } catch {}

  // ثانياً: fallback آمن — timestamp بالمللي ثانية → base36 (فريد دائماً)
  const year = new Date().getFullYear().toString().slice(-2); // 26
  const ts   = Date.now().toString(36).toUpperCase();         // مثال: LHS7XAB
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase(); // 3 حروف عشوائية
  const candidate = `JE-${year}-${ts}-${rand}`;

  // تأكد من عدم التكرار (في حالة نادرة جداً)
  const { data: existing } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("entry_number", candidate)
    .maybeSingle();

  if (existing) {
    // إعادة توليد مع تأخير بسيط
    await new Promise(r => setTimeout(r, 2));
    return `JE-${year}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
  }

  return candidate;
}

/* ══════════════════════════════════════════════
   GET /api/suppliers/[id]/ledger
══════════════════════════════════════════════ */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supplierId = params.id;
  const url  = new URL(req.url);
  const from = url.searchParams.get("from");
  const to   = url.searchParams.get("to");

  try {
    // 1) بيانات المورد
    const { data: supplier, error: sErr } = await supabase
      .from("suppliers")
      .select("id,name,phone,notes,opening_balance,opening_balance_date,credit_limit,payment_terms_days,tax_number,bank_details")
      .eq("id", supplierId)
      .single();

    if (sErr || !supplier) {
      return NextResponse.json({ error: "المورد غير موجود" }, { status: 404 });
    }

    // 2) جلب سطور القيود للمورد — استعلام بسيط وموثوق
    const { data: rawLines, error: lErr } = await supabase
      .from("journal_lines")
      .select(`
        id, debit, credit, description, quantity, unit_price, item_type, line_number,
        journal_entry_id, supplier_id
      `)
      .eq("supplier_id", supplierId);

    if (lErr) {
      console.error("ledger lines error:", lErr);
      return NextResponse.json({
        supplier,
        transactions: [],
        summary: { openingBalance: supplier.opening_balance ?? 0, totalDebit: 0, totalCredit: 0, balance: supplier.opening_balance ?? 0 }
      });
    }

    // جلب القيود المرتبطة
    const entryIds = [...new Set((rawLines ?? []).map((l: any) => l.journal_entry_id))];
    let lines: any[] = [];

    if (entryIds.length > 0) {
      let entQ = supabase
        .from("journal_entries")
        .select(`
          id, entry_number, entry_date, hijri_date, description, reference_number,
          entry_type, source_type, status, notes, created_at,
          supplier_invoice_number, payment_method, adjustment_reason,
          includes_vat, vat_amount, document_urls, cost_center
        `)
        .in("id", entryIds)
        .neq("status", "voided");

      if (from) entQ = entQ.gte("entry_date", from);
      if (to)   entQ = entQ.lte("entry_date", to);

      const { data: entries } = await entQ
        .order("entry_date", { ascending: true })
        .order("created_at", { ascending: true });

      const entryMap = new Map((entries ?? []).map((e: any) => [e.id, e]));

      lines = (rawLines ?? [])
        .filter((l: any) => entryMap.has(l.journal_entry_id))
        .map((l: any) => ({ ...l, journal_entries: entryMap.get(l.journal_entry_id) }))
        .sort((a: any, b: any) => {
          const da = a.journal_entries?.entry_date ?? "";
          const db = b.journal_entries?.entry_date ?? "";
          return da < db ? -1 : da > db ? 1 : 0;
        });
    }

    // 3) حساب الرصيد الجاري
    const opening = Number(supplier.opening_balance ?? 0);
    let running   = opening;

    const transactions = (lines ?? []).map((line: any) => {
      const debit  = Number(line.debit  ?? 0);
      const credit = Number(line.credit ?? 0);
      running += debit - credit;
      return {
        id:              line.id,
        entryId:         line.journal_entry_id,
        entryNumber:     line.journal_entries?.entry_number,
        entryDate:       line.journal_entries?.entry_date,
        hijriDate:       line.journal_entries?.hijri_date,
        description:     line.journal_entries?.description || line.description,
        lineDescription: line.description,
        referenceNumber: line.journal_entries?.supplier_invoice_number || line.journal_entries?.reference_number,
        entryType:       line.journal_entries?.entry_type,
        sourceType:      line.journal_entries?.source_type,
        notes:           line.journal_entries?.notes,
        paymentMethod:   line.journal_entries?.payment_method,
        costCenter:      line.journal_entries?.cost_center,
        documentUrls:    line.journal_entries?.document_urls ?? [],
        debit, credit,
        quantity:        line.quantity,
        unitPrice:       line.unit_price,
        itemType:        line.item_type,
        runningBalance:  running,
      };
    });

    const totalDebit  = transactions.reduce((s, t) => s + t.debit,  0);
    const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);

    return NextResponse.json({
      supplier,
      transactions,
      summary: { openingBalance: opening, totalDebit, totalCredit, balance: opening + totalDebit - totalCredit }
    });
  } catch (err) {
    console.error("ledger GET error:", err);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}

/* ══════════════════════════════════════════════
   POST /api/suppliers/[id]/ledger
   إنشاء قيد يومية جديد مع دعم رفع الملفات
══════════════════════════════════════════════ */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supplierId = params.id;

  try {
    const body = await req.json();
    const {
      entry_date,
      entry_type = "standard",
      description,
      hijri_date,
      amount,
      direction,           // "debit" | "credit"
      // حقول الفاتورة
      supplier_invoice_number,
      supplier_invoice_date,
      due_date,
      includes_vat,
      amount_before_vat,
      vat_amount,
      line_items,
      // حقول الدفع
      payment_method,
      bank_name,
      transaction_reference,
      check_number,
      check_date,
      check_status,
      received_by,
      // حقول التسوية
      adjustment_reason,
      // حقول مشتركة
      cost_center,
      notes,
      reference_number,    // deprecated, use supplier_invoice_number
      // ملفات (URLs بعد الرفع)
      document_urls = [],
      // تفاصيل المشتريات (قديم)
      quantity,
      unit_price,
      item_type,
    } = body;

    // ── تحقق أساسي ──
    if (!entry_date) return NextResponse.json({ error: "التاريخ مطلوب" }, { status: 400 });
    if (!description?.trim()) return NextResponse.json({ error: "البيان مطلوب" }, { status: 400 });
    if (!amount) return NextResponse.json({ error: "المبلغ مطلوب" }, { status: 400 });
    if (!direction) return NextResponse.json({ error: "اتجاه القيد مطلوب" }, { status: 400 });

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 });

    // ── توليد رقم القيد ──
    const entryNumber = await generateEntryNumber();

    // ── إنشاء القيد الرئيسي ──
    const entryPayload: Record<string, any> = {
      entry_number:    entryNumber,
      entry_date,
      entry_type,
      source_type:     "manual",
      description,
      notes,
      hijri_date:      hijri_date || null,
      total_debit:     amt,
      total_credit:    amt,
      status:          "posted",
      posted_at:       new Date().toISOString(),
      created_by:      "admin",
      document_urls:   document_urls,
      cost_center:     cost_center || null,
    };

    // حقول حسب النوع
    if (entry_type === "purchase") {
      entryPayload.supplier_invoice_number = supplier_invoice_number || null;
      entryPayload.supplier_invoice_date   = supplier_invoice_date   || null;
      entryPayload.due_date                = due_date                || null;
      entryPayload.includes_vat            = includes_vat            ?? false;
      entryPayload.amount_before_vat       = amount_before_vat       || null;
      entryPayload.vat_amount              = vat_amount              || null;
      entryPayload.line_items              = line_items              || null;
      entryPayload.reference_number        = supplier_invoice_number || reference_number || null;
    } else if (entry_type === "payment") {
      entryPayload.payment_method          = payment_method          || null;
      entryPayload.bank_name               = bank_name               || null;
      entryPayload.transaction_reference   = transaction_reference   || null;
      entryPayload.check_number            = check_number            || null;
      entryPayload.check_date              = check_date              || null;
      entryPayload.check_status            = check_status            || null;
      entryPayload.received_by             = received_by             || null;
    } else if (entry_type === "adjustment") {
      entryPayload.adjustment_reason       = adjustment_reason       || null;
    } else {
      entryPayload.reference_number        = reference_number        || null;
    }

    const { data: entry, error: eErr } = await supabase
      .from("journal_entries")
      .insert(entryPayload)
      .select()
      .single();

    if (eErr || !entry) {
      console.error("journal entry insert error:", eErr);
      return NextResponse.json({ error: "فشل إنشاء القيد: " + (eErr?.message || "خطأ غير معروف") }, { status: 500 });
    }

    // ── سطر المورد ──
    const supplierLine: Record<string, any> = {
      journal_entry_id: entry.id,
      line_number:      1,
      supplier_id:      supplierId,
      debit:            direction === "debit"  ? amt : 0,
      credit:           direction === "credit" ? amt : 0,
      description,
      quantity:         quantity   || null,
      unit_price:       unit_price || null,
      item_type:        item_type  || null,
    };

    // ── سطر المقابل ──
    const counterLine: Record<string, any> = {
      journal_entry_id: entry.id,
      line_number:      2,
      supplier_id:      null,
      debit:            direction === "credit" ? amt : 0,
      credit:           direction === "debit"  ? amt : 0,
      description:      direction === "debit"
        ? "ذمم الموردين — " + description
        : "سداد — " + description,
    };

    const { error: lErr } = await supabase
      .from("journal_lines")
      .insert([supplierLine, counterLine]);

    if (lErr) {
      await supabase.from("journal_entries").delete().eq("id", entry.id);
      console.error("journal lines error:", lErr);
      return NextResponse.json({ error: "فشل إنشاء سطور القيد: " + lErr.message }, { status: 500 });
    }

    // ── تحديث المستندات بربطها بالقيد ──
    if (document_urls?.length > 0) {
      await supabase
        .from("supplier_documents")
        .update({ journal_entry_id: entry.id })
        .eq("supplier_id", supplierId)
        .is("journal_entry_id", null)
        .in("storage_url", document_urls);
    }

    return NextResponse.json({ success: true, entryNumber, entryId: entry.id });
  } catch (err) {
    console.error("ledger POST error:", err);
    return NextResponse.json({ error: "خطأ في الخادم: " + String(err) }, { status: 500 });
  }
}

/* ══════════════════════════════════════════════
   PATCH /api/suppliers/[id]/ledger
   إلغاء قيد
══════════════════════════════════════════════ */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { entryId, voidReason } = await req.json();
    if (!entryId) return NextResponse.json({ error: "entryId مطلوب" }, { status: 400 });

    const { error } = await supabase
      .from("journal_entries")
      .update({
        status:     "voided",
        voided_at:  new Date().toISOString(),
        voided_by:  "admin",
        void_reason: voidReason || "ألغي من قِبل المدير",
      })
      .eq("id", entryId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
