import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ── supabase as any لتجاوز TypeScript للجداول الجديدة ── */
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
) as any;

/* ── توليد رقم القيد ── */
async function nextEntryNum(): Promise<string> {
  try {
    const { data, error } = await sb.rpc("next_entry_number");
    if (!error && data) return String(data);
  } catch {}
  const y = new Date().getFullYear();
  const { data: rows } = await sb
    .from("journal_entries")
    .select("entry_number")
    .like("entry_number", `JE-${y}-%`);
  const nums = (rows ?? []).map((r: any) => {
    const m = String(r.entry_number).match(/(\d+)$/);
    return m ? parseInt(m[1]) : 0;
  });
  const next = (Math.max(0, ...nums) + 1).toString().padStart(5, "0");
  return `JE-${y}-${next}`;
}

/* ══════════════════════════════════════════════════════
   GET /api/suppliers/[id]/ledger
══════════════════════════════════════════════════════ */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: supplierId } = await params;
  const url  = new URL(req.url);
  const from = url.searchParams.get("from") || "2000-01-01";
  const to   = url.searchParams.get("to")   || "2099-12-31";

  try {
    /* 1. بيانات المورد */
    const { data: supplier, error: sErr } = await sb
      .from("suppliers")
      .select("*")
      .eq("id", supplierId)
      .single();

    if (sErr || !supplier) {
      return NextResponse.json(
        { error: "المورد غير موجود — " + (sErr?.message ?? "لا بيانات") },
        { status: 404 }
      );
    }

    /* 2. جلب سطور المورد — السطر الذي فيه قيمة فقط (debit>0 أو credit>0) */
    const { data: lines, error: lErr } = await sb
      .from("journal_lines")
      .select("*")
      .eq("supplier_id", supplierId)
      .or("debit.gt.0,credit.gt.0");

    let rows: any[] = [];

    if (lErr) {
      console.error("journal_lines fetch error:", lErr.message);
    } else if (lines && lines.length > 0) {
      const entryIds = [...new Set(lines.map((l: any) => l.journal_entry_id).filter(Boolean))];

      const { data: entries } = await sb
        .from("journal_entries")
        .select("*")
        .in("id", entryIds)
        .neq("status", "voided")
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date", { ascending: true })
        .order("entry_number", { ascending: true });

      const entryMap = new Map<string, any>((entries ?? []).map((e: any) => [e.id, e]));

      /* نأخذ سطر المورد فقط (debit > 0 أو credit > 0)، نتجاهل سطر المقابل */
      const seenEntries = new Set<string>();
      rows = lines
        .filter((l: any) => {
          if (!entryMap.has(l.journal_entry_id)) return false;
          /* إذا شفنا هذا القيد من قبل، تجاهل السطر المكرر */
          if (seenEntries.has(l.journal_entry_id)) return false;
          seenEntries.add(l.journal_entry_id);
          return true;
        })
        .map((l: any) => {
          const e: any = entryMap.get(l.journal_entry_id);
          return {
            entry_id:         l.journal_entry_id,
            entry_number:     e?.entry_number,
            entry_date:       e?.entry_date,
            hijri_date:       e?.hijri_date,
            description:      e?.description || l.description,
            reference_number: e?.supplier_invoice_number || e?.reference_number,
            entry_type:       e?.entry_type,
            status:           e?.status,
            source_type:      e?.source_type,
            source_id:        e?.source_id,
            created_at:       e?.created_at,
            supplier_id:      l.supplier_id,
            debit:            Number(l.debit  ?? 0),
            credit:           Number(l.credit ?? 0),
            line_description: l.description,
            quantity:         l.quantity,
            unit_price:       l.unit_price,
            item_type:        l.item_type,
          };
        })
        .sort((a: any, b: any) => {
          const da = a.entry_date ?? "";
          const db = b.entry_date ?? "";
          return da < db ? -1 : da > db ? 1 : 0;
        });

      /* حساب running_balance */
      let running = Number(supplier.opening_balance ?? 0);
      rows = rows.map((r: any) => {
        running += r.debit - r.credit;
        return { ...r, running_balance: running };
      });
    }

    /* 3. تحويل إلى تنسيق الصفحة */
    const opening = Number(supplier.opening_balance ?? 0);

    const transactions = rows.map((r: any) => ({
      id:              r.entry_id,
      entryId:         r.entry_id,
      entryNumber:     r.entry_number,
      entryDate:       r.entry_date,
      hijriDate:       r.hijri_date,
      description:     r.description,
      lineDescription: r.line_description,
      referenceNumber: r.reference_number,
      entryType:       r.entry_type,
      sourceType:      r.source_type,
      notes:           r.notes,
      debit:           Number(r.debit  ?? 0),
      credit:          Number(r.credit ?? 0),
      quantity:        r.quantity,
      unitPrice:       r.unit_price,
      itemType:        r.item_type,
      runningBalance:  Number(r.running_balance ?? 0),
    }));

    const totalDebit  = transactions.reduce((s, t) => s + t.debit,  0);
    const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);
    const balance     = opening + totalDebit - totalCredit;

    return NextResponse.json({
      supplier,
      transactions,
      summary: { openingBalance: opening, totalDebit, totalCredit, balance },
    });

  } catch (err) {
    console.error("ledger GET error:", err);
    return NextResponse.json(
      { error: "خطأ في الخادم: " + String(err) },
      { status: 500 }
    );
  }
}

/* ══════════════════════════════════════════════════════
   POST /api/suppliers/[id]/ledger
══════════════════════════════════════════════════════ */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: supplierId } = await params;

  try {
    const body = await req.json();
    const {
      entry_date, entry_type = "purchase", description, hijri_date,
      amount, direction,
      supplier_invoice_number, supplier_invoice_date, due_date,
      includes_vat, amount_before_vat, vat_amount, line_items,
      payment_method, bank_name, transaction_reference,
      check_number, check_date, check_status, received_by,
      adjustment_reason, cost_center, notes, reference_number,
      document_urls = [], quantity, unit_price, item_type,
    } = body;

    if (!entry_date)           return NextResponse.json({ error: "التاريخ مطلوب" },      { status: 400 });
    if (!description?.trim())  return NextResponse.json({ error: "البيان مطلوب" },        { status: 400 });
    if (!amount)               return NextResponse.json({ error: "المبلغ مطلوب" },         { status: 400 });
    if (!direction)            return NextResponse.json({ error: "اتجاه القيد مطلوب" },   { status: 400 });

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 });

    const entryNumber = await nextEntryNum();

    /* ── payload القيد ── */
    const entryPayload: Record<string, any> = {
      entry_number: entryNumber,
      entry_date,
      entry_type,
      source_type:  "manual",
      description,
      notes:        notes    || null,
      total_debit:  amt,
      total_credit: amt,
      status:       "posted",
      created_by:   "admin",
    };

    /* حقول اختيارية: نضيفها فقط إذا كانت موجودة لتفادي FK violations */
    if (hijri_date)               entryPayload.hijri_date              = hijri_date;
    if (cost_center)              entryPayload.cost_center             = cost_center;
    if (document_urls?.length)    entryPayload.document_urls           = document_urls;
    if (entry_type === "purchase") {
      if (supplier_invoice_number) entryPayload.supplier_invoice_number = supplier_invoice_number;
      if (supplier_invoice_date)   entryPayload.supplier_invoice_date   = supplier_invoice_date;
      if (due_date)                entryPayload.due_date                = due_date;
      if (includes_vat)            entryPayload.includes_vat            = includes_vat;
      if (amount_before_vat)       entryPayload.amount_before_vat       = amount_before_vat;
      if (vat_amount)              entryPayload.vat_amount              = vat_amount;
      if (line_items?.length)      entryPayload.line_items              = line_items;
      if (supplier_invoice_number || reference_number)
        entryPayload.reference_number = supplier_invoice_number || reference_number;
    } else if (entry_type === "payment") {
      if (payment_method)          entryPayload.payment_method          = payment_method;
      if (bank_name)               entryPayload.bank_name               = bank_name;
      if (transaction_reference)   entryPayload.transaction_reference   = transaction_reference;
      if (check_number)            entryPayload.check_number            = check_number;
      if (check_date)              entryPayload.check_date              = check_date;
      if (check_status)            entryPayload.check_status            = check_status;
      if (received_by)             entryPayload.received_by             = received_by;
    } else if (entry_type === "adjustment") {
      if (adjustment_reason)       entryPayload.adjustment_reason       = adjustment_reason;
    } else if (reference_number) {
      entryPayload.reference_number = reference_number;
    }

    /* ── إدراج القيد ── */
    const { data: entry, error: eErr } = await sb
      .from("journal_entries")
      .insert(entryPayload)
      .select("id, entry_number")
      .single();

    if (eErr || !entry) {
      console.error("journal_entries insert error:", JSON.stringify(eErr));
      return NextResponse.json(
        { error: "فشل إنشاء القيد: " + (eErr?.message ?? "خطأ مجهول") },
        { status: 500 }
      );
    }

    /* ── سطر المورد ── */
    const supplierLine: Record<string, any> = {
      journal_entry_id: entry.id,
      line_number:      1,
      supplier_id:      supplierId,
      debit:            direction === "debit"  ? amt : 0,
      credit:           direction === "credit" ? amt : 0,
      description,
    };
    if (quantity)   supplierLine.quantity   = Number(quantity);
    if (unit_price) supplierLine.unit_price = Number(unit_price);
    if (item_type)  supplierLine.item_type  = item_type;

    /* ── سطر المقابل ── */
    const counterLine: Record<string, any> = {
      journal_entry_id: entry.id,
      line_number:      2,
      debit:            direction === "credit" ? amt : 0,
      credit:           direction === "debit"  ? amt : 0,
      description: direction === "debit" ? "ذمم الموردين — " + description : "سداد — " + description,
    };

    const { error: lErr } = await sb
      .from("journal_lines")
      .insert([supplierLine, counterLine]);

    if (lErr) {
      /* تراجع */
      await sb.from("journal_entries").delete().eq("id", entry.id);
      console.error("journal_lines insert error:", JSON.stringify(lErr));
      return NextResponse.json(
        { error: "فشل إنشاء سطور القيد: " + lErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, entryNumber: entry.entry_number, entryId: entry.id });

  } catch (err) {
    console.error("ledger POST error:", err);
    return NextResponse.json({ error: "خطأ في الخادم: " + String(err) }, { status: 500 });
  }
}

/* ══════════════════════════════════════════════════════
   PATCH /api/suppliers/[id]/ledger — إلغاء قيد
══════════════════════════════════════════════════════ */
export async function PATCH(
  req: NextRequest,
  _ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { entryId, voidReason } = await req.json();
    if (!entryId) return NextResponse.json({ error: "entryId مطلوب" }, { status: 400 });

    const { error } = await sb
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
    return NextResponse.json({ error: "خطأ في الخادم: " + String(err) }, { status: 500 });
  }
}
