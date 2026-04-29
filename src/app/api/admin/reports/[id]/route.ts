// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const [reportRes, paymentsRes, meatRes, expensesRes] = await Promise.all([
    supabase
      .from("daily_reports")
      .select("*, branches(name, slug)")
      .eq("id", id)
      .single(),
    supabase
      .from("report_payments")
      .select("*, payment_methods(name, code)")
      .eq("report_id", id),
    supabase
      .from("report_meat_movements")
      .select("*, meat_types(name, category)")
      .eq("report_id", id),
    supabase
      .from("report_expenses")
      .select("*")
      .eq("report_id", id),
  ]);

  if (reportRes.error) return NextResponse.json({ error: reportRes.error.message }, { status: 404 });

  let stepData = null;
  let editHistory: any[] = [];
  let extraFields: any = {};

  const report = reportRes.data as any;
  if (report.notes && typeof report.notes === "string") {
    try {
      const notesObj = JSON.parse(report.notes);
      stepData = {
        step1: notesObj.step1Named || null,
        step2: notesObj.step2Named || null,
        step3: notesObj.step3Named || null,
        step4: notesObj.step4Named || null,
        step5: notesObj.step5Named || null,
        step6: notesObj.step6Named || null,
        step7: notesObj.step7Named || null,
      };
      // سجل التعديلات
      editHistory = notesObj.editHistory || [];
      // الحقول الإضافية المخزّنة في notes
      extraFields = {
        returns_value:   notesObj._returns_value   ?? report.returns_value   ?? 0,
        discounts_value: notesObj._discounts_value ?? report.discounts_value ?? 0,
      };
    } catch {
      // ignore parse errors
    }
  }

  return NextResponse.json({
    report: { ...reportRes.data, ...extraFields },
    payments: paymentsRes.data ?? [],
    meatMovements: meatRes.data ?? [],
    expenses: expensesRes.data ?? [],
    stepData,
    editHistory,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const body = await request.json();

  const { payments: paymentsUpdate, stepDataUpdate, returns_value, discounts_value, network_settlement, ...rest } = body as any;

  // الحقول المسموح تحديثها مباشرة في جدول daily_reports
  const SAFE_DB_FIELDS = ["total_sales", "invoice_count", "status", "notes"];
  const directFields: any = {};
  for (const key of SAFE_DB_FIELDS) {
    if (key !== "notes" && rest[key] !== undefined) directFields[key] = rest[key];
  }

  // جلب التقرير الحالي للنوتس
  const { data: currentReport } = await supabase
    .from("daily_reports")
    .select("notes, total_sales, invoice_count")
    .eq("id", id)
    .single();

  let notesObj: any = {};
  try { notesObj = JSON.parse(currentReport?.notes || "{}"); } catch {}

  // سجل التعديلات
  const changes: Record<string, { old: any; new: any }> = {};

  // تتبع تغيير total_sales
  if (directFields.total_sales !== undefined && directFields.total_sales !== toN(currentReport?.total_sales)) {
    changes.total_sales = { old: toN(currentReport?.total_sales), new: directFields.total_sales };
  }
  if (directFields.invoice_count !== undefined && directFields.invoice_count !== toN(currentReport?.invoice_count)) {
    changes.invoice_count = { old: toN(currentReport?.invoice_count), new: directFields.invoice_count };
  }
  if (returns_value !== undefined && returns_value !== toN(notesObj._returns_value)) {
    changes.returns_value = { old: toN(notesObj._returns_value), new: returns_value };
    notesObj._returns_value = returns_value;
  }
  if (discounts_value !== undefined && discounts_value !== toN(notesObj._discounts_value)) {
    changes.discounts_value = { old: toN(notesObj._discounts_value), new: discounts_value };
    notesObj._discounts_value = discounts_value;
  }
  // موازنة الشبكة — تُخزَّن في notes كـ _network_settlement
  if (network_settlement !== undefined) {
    notesObj._network_settlement = Number(network_settlement) || 0;
  }

  // دمج stepData في notes — نقارن الحقول المُعدَّلة فقط
  if (stepDataUpdate) {
    const { step1Named, step3Named, step4Named, step5Named } = stepDataUpdate;

    if (step1Named) {
      const ex1 = notesObj.step1Named || {};
      // حقول الوارد التي نعدّلها فقط
      const diffFields1 = ["hashi_weight", "sheep_weight", "beef_weight"];
      const oldSlice1: any = {}, newSlice1: any = {};
      let changed1 = false;
      for (const k of diffFields1) {
        const oldV = toN(ex1[k]), newV = toN(step1Named[k]);
        oldSlice1[k] = oldV; newSlice1[k] = newV;
        if (Math.abs(oldV - newV) > 0.001) changed1 = true;
      }
      notesObj.step1Named = { ...ex1, ...step1Named };
      if (changed1) changes.step1_incoming = { old: oldSlice1, new: newSlice1 };
    }

    if (step3Named) {
      const ex3 = notesObj.step3Named || {};
      const diffFields3 = ["hashi_weight", "sheep_weight", "beef_weight"];
      const oldSlice3: any = {}, newSlice3: any = {};
      let changed3 = false;
      for (const k of diffFields3) {
        const oldV = toN(ex3[k]), newV = toN(step3Named[k]);
        oldSlice3[k] = oldV; newSlice3[k] = newV;
        if (Math.abs(oldV - newV) > 0.001) changed3 = true;
      }
      notesObj.step3Named = { ...ex3, ...step3Named };
      if (changed3) changes.step3_sales = { old: oldSlice3, new: newSlice3 };
    }

    if (step4Named) {
      const ex4 = notesObj.step4Named || {};
      const numFields4 = ["hashi_outgoing", "sheep_outgoing_weight", "beef_outgoing"];
      const txtFields4 = ["hashi_export_to", "sheep_export_to", "beef_export_to"];
      const oldSlice4: any = {}, newSlice4: any = {};
      let changed4 = false;
      for (const k of numFields4) {
        const oldV = toN(ex4[k]), newV = toN(step4Named[k]);
        oldSlice4[k] = oldV; newSlice4[k] = newV;
        if (Math.abs(oldV - newV) > 0.001) changed4 = true;
      }
      for (const k of txtFields4) {
        const oldV = (ex4[k] || "").trim(), newV = (step4Named[k] || "").trim();
        oldSlice4[k] = oldV; newSlice4[k] = newV;
        if (oldV !== newV) changed4 = true;
      }
      notesObj.step4Named = { ...ex4, ...step4Named };
      if (changed4) changes.step4_outgoing = { old: oldSlice4, new: newSlice4 };
    }

    if (step5Named) {
      const ex5 = notesObj.step5Named || {};
      const diffFields5 = ["hashi_offal", "hashi_remaining", "sheep_offal", "sheep_remaining", "beef_offal", "beef_remaining"];
      const oldSlice5: any = {}, newSlice5: any = {};
      let changed5 = false;
      for (const k of diffFields5) {
        const oldV = toN(ex5[k]), newV = toN(step5Named[k]);
        oldSlice5[k] = oldV; newSlice5[k] = newV;
        if (Math.abs(oldV - newV) > 0.001) changed5 = true;
      }
      notesObj.step5Named = { ...ex5, ...step5Named };
      if (changed5) changes.step5_remaining = { old: oldSlice5, new: newSlice5 };
    }
  }

  // دمج notes النص العادي إن وُجد
  if (rest.notes !== undefined && !stepDataUpdate) {
    notesObj._adminNotes = rest.notes || null;
  }

  // سجّل التعديل إن وُجدت تغييرات
  if (Object.keys(changes).length > 0) {
    if (!notesObj.editHistory) notesObj.editHistory = [];
    notesObj.editHistory.push({
      timestamp: new Date().toISOString(),
      changes,
    });
  }

  directFields.notes = JSON.stringify(notesObj);

  // تحديث التقرير
  const { error } = await supabase
    .from("daily_reports")
    .update(directFields)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // تحديث المدفوعات
  if (paymentsUpdate && Array.isArray(paymentsUpdate)) {
    for (const p of paymentsUpdate) {
      if (p.id) {
        const { error: pe } = await supabase
          .from("report_payments")
          .update({ amount: p.amount })
          .eq("id", p.id);
        if (pe) console.error("payment update error:", pe.message);
      }
    }
  }

  const { data, error: fe } = await supabase
    .from("daily_reports")
    .select("*, branches(name, slug)")
    .eq("id", id)
    .single();

  if (fe) return NextResponse.json({ error: fe.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  await supabase.from("report_payments").delete().eq("report_id", id);
  await supabase.from("report_expenses").delete().eq("report_id", id);
  await supabase.from("report_meat_movements").delete().eq("report_id", id);

  const { error } = await supabase.from("daily_reports").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

function toN(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
