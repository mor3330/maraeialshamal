import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// استخدام any لتجاوز TypeScript type checking للجداول الجديدة
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
) as any;

/* ── توليد رقم القيد ── */
async function generateEntryNumber(): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("next_entry_number");
    if (!error && data) return data as string;
  } catch {}

  const year = new Date().getFullYear().toString().slice(-2);
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  const candidate = `JE-${year}-${ts}-${rand}`;

  try {
    const { data: existing } = await supabase
      .from("journal_entries")
      .select("id")
      .eq("entry_number", candidate)
      .maybeSingle();
    if (existing) {
      await new Promise(r => setTimeout(r, 2));
      return `JE-${year}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
    }
  } catch {}

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
      .select("*")
      .eq("id", supplierId)
      .single();

    if (sErr || !supplier) {
      return NextResponse.json({ error: "المورد غير موجود — " + (sErr?.message ?? "no data") }, { status: 404 });
    }

    // 2) جلب سطور القيود للمورد
    const { data: rawLines, error: lErr } = await supabase
      .from("journal_lines")
      .select("*")
      .eq("supplier_id", supplierId);

    if (lErr) {
      console.error("ledger lines error:", lErr);
      return NextResponse.json({
        supplier,
        transactions: [],
        summary: { openingBalance: supplier.opening_balance ?? 0, totalDebit: 0, totalCredit: 0, balance: supplier.opening_balance ?? 0 }
      });
    }

    // 3) جلب القيود المرتبطة
    const entryIds = [...new Set((rawLines ?? []).map((l: any) => l.journal_entry_id).filter(Boolean))];
    let lines: any[] = [];

    if (entryIds.length > 0) {
      let entQ = supabase
        .from("journal_entries")
        .select("*")
        .in("id", entryIds)
        .neq("status", "voided");

      if (from) entQ = entQ.gte("entry_date", from);
      if (to)   entQ = entQ.lte("entry_date", to);

      const { data: entries, error: entErr } = await entQ
        .order("entry_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (entErr) {
        console.error("entries query error:", entErr);
      }

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

    // 4) حساب الرصيد الجاري
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

    const totalDebit  = transactions.reduce((s: number, t: any) => s + t.debit,  0);
    const totalCredit = transactions.reduce((s: number, t: any) => s + t.credit, 0);

    return NextResponse.json({
      supplier,
      transactions,
      summary: { openingBalance: opening, totalDebit, totalCredit, balance: opening + totalDebit - totalCredit }
    });
  } catch (err) {
    console.error("ledger GET error:", err);
    return NextResponse.json({ error: "خطأ في الخادم: " + String(err) }, { status: 500 });
  }
}

/* ══════════════════════════════════════════════
   POST /api/suppliers/[id]/ledger
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
      direction,
      supplier_invoice_number,
      supplier_invoice_date,
      due_date,
      includes_vat,
      amount_before_vat,
      vat_amount,
      line_items,
      payment_method,
      bank_name,
      transaction_reference,
      check_number,
      check_date,
      check_status,
      received_by,
      adjustment_reason,
      cost_center,
      notes,
      reference_number,
      document_urls = [],
      quantity,
      unit_price,
      item_type,
    } = body;

    if (!entry_date)         return NextResponse.json({ error: "التاريخ مطلوب" },           { status: 400 });
    if (!description?.trim()) return NextResponse.json({ error: "البيان مطلوب" },           { status: 400 });
    if (!amount)              return NextResponse.json({ error: "المبلغ مطلوب" },            { status: 400 });
    if (!direction)           return NextResponse.json({ error: "اتجاه القيد مطلوب" },      { status: 400 });

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 });

    const entryNumber = await generateEntryNumber();

    // بناء payload الأساسي (مضمون الوجود في كل النسخ)
    const basePayload: Record<string, any> = {
      entry_number: entryNumber,
      entry_date,
      entry_type,
      source_type:  "manual",
      description,
      notes:        notes || null,
      total_debit:  amt,
      total_credit: amt,
      status:       "posted",
      posted_at:    new Date().toISOString(),
      created_by:   "admin",
    };

    // حقول إضافية — حسب النوع
    const extraPayload: Record<string, any> = {
      hijri_date:              hijri_date || null,
      document_urls:           document_urls || [],
      cost_center:             cost_center || null,
    };

    if (entry_type === "purchase") {
      extraPayload.supplier_invoice_number = supplier_invoice_number || null;
      extraPayload.supplier_invoice_date   = supplier_invoice_date   || null;
      extraPayload.due_date                = due_date                || null;
      extraPayload.includes_vat            = includes_vat            ?? false;
      extraPayload.amount_before_vat       = amount_before_vat       || null;
      extraPayload.vat_amount              = vat_amount              || null;
      extraPayload.line_items              = line_items              || null;
      extraPayload.reference_number        = supplier_invoice_number || reference_number || null;
    } else if (entry_type === "payment") {
      extraPayload.payment_method          = payment_method          || null;
      extraPayload.bank_name               = bank_name               || null;
      extraPayload.transaction_reference   = transaction_reference   || null;
      extraPayload.check_number            = check_number            || null;
      extraPayload.check_date              = check_date              || null;
      extraPayload.check_status            = check_status            || null;
      extraPayload.received_by             = received_by             || null;
    } else if (entry_type === "adjustment") {
      extraPayload.adjustment_reason       = adjustment_reason       || null;
    } else {
      extraPayload.reference_number        = reference_number        || null;
    }

    // محاولة 1: الـ payload الكامل
    let entry: any = null;
    let eErr: any  = null;

    ({ data: entry, error: eErr } = await supabase
      .from("journal_entries")
      .insert({ ...basePayload, ...extraPayload })
      .select()
      .single());

    // محاولة 2: الـ payload الأساسي فقط (احتياط إن كانت أعمدة مفقودة)
    if (eErr) {
      console.warn("Full insert failed, retrying with base payload:", eErr.message);
      ({ data: entry, error: eErr } = await supabase
        .from("journal_entries")
        .insert(basePayload)
        .select()
        .single());
    }

    if (eErr || !entry) {
      console.error("journal entry insert error:", eErr);
      return NextResponse.json({ error: "فشل إنشاء القيد: " + (eErr?.message ?? "خطأ غير معروف") }, { status: 500 });
    }

    // سطر المورد
    const supplierLine: Record<string, any> = {
      journal_entry_id: entry.id,
      line_number:      1,
      supplier_id:      supplierId,
      debit:            direction === "debit"  ? amt : 0,
      credit:           direction === "credit" ? amt : 0,
      description,
      quantity:   quantity   ? Number(quantity)   : null,
      unit_price: unit_price ? Number(unit_price) : null,
      item_type:  item_type  || null,
    };

    // سطر المقابل
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
      // تراجع: احذف القيد
      await supabase.from("journal_entries").delete().eq("id", entry.id);
      console.error("journal lines error:", lErr);
      return NextResponse.json({ error: "فشل إنشاء سطور القيد: " + lErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, entryNumber, entryId: entry.id });
  } catch (err) {
    console.error("ledger POST error:", err);
    return NextResponse.json({ error: "خطأ في الخادم: " + String(err) }, { status: 500 });
  }
}

/* ══════════════════════════════════════════════
   PATCH /api/suppliers/[id]/ledger — إلغاء قيد
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
        status:      "voided",
        voided_at:   new Date().toISOString(),
        voided_by:   "admin",
        void_reason: voidReason || "ألغي من قِبل المدير",
      })
      .eq("id", entryId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
