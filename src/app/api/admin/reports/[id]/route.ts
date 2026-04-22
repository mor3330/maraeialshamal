import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient();

  const [reportRes, paymentsRes, meatRes, expensesRes] = await Promise.all([
    supabase
      .from("daily_reports")
      .select("*, branches(name, slug)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("report_payments")
      .select("*, payment_methods(name, code)")
      .eq("report_id", params.id),
    supabase
      .from("report_meat_movements")
      .select("*, meat_types(name, category)")
      .eq("report_id", params.id),
    supabase
      .from("report_expenses")
      .select("*")
      .eq("report_id", params.id),
  ]);

  if (reportRes.error) return NextResponse.json({ error: reportRes.error.message }, { status: 404 });

  // استخراج بيانات الخطوات من notes
  let stepData = null;
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
    } catch {
      // ignore parse errors
    }
  }

  return NextResponse.json({
    report: reportRes.data,
    payments: paymentsRes.data ?? [],
    meatMovements: meatRes.data ?? [],
    expenses: expensesRes.data ?? [],
    stepData,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { data, error } = await supabase
    .from("daily_reports")
    .update(body as never)
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
