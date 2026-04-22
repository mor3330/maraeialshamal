import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const url = new URL(request.url);
  const requested = parseInt(url.searchParams.get("limit") ?? "200");
  const limit = Math.min(requested, 500); // حد أقصى 500

  const { data, error } = await supabase
    .from("daily_reports")
    .select("id, branch_id, report_date, status, total_sales, invoice_count, cash_expected, cash_actual, cash_difference, submitted_at")
    .order("report_date", { ascending: false })
    .order("submitted_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

type ReportStatus = Database["public"]["Tables"]["daily_reports"]["Row"]["status"];
type ReportInsert = Database["public"]["Tables"]["daily_reports"]["Insert"];

interface SubmissionPayload {
  report: {
    branchId: string;
    reportDate: string;
    totalSales?: number;
    invoiceCount?: number;
    returnsValue?: number;
    discountsValue?: number;
    cashExpected?: number;
    cashActual?: number;
    salesPdfUrl?: string;
    status?: ReportStatus;
    notes?: string | null;
  };
  payments?: { methodId: string; amount: number }[];
  meatSales?: { meatTypeId: string; count: number; weightKg: number }[];
  inventory?: {
    meatTypeId: string;
    openingStock: number;
    incoming: number;
    outgoing: number;
    remainingActual: number;
    shortage?: number;
  }[];
  expenses?: { category: string; description: string; amount: number }[];
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isStatus(value: unknown): value is ReportStatus {
  return value === "draft" || value === "submitted" || value === "approved" || value === "flagged";
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const body = await request.json();

  if (!body?.report) {
    const { data, error } = await supabase
      .from("daily_reports")
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  }

  const payload = body as SubmissionPayload;

  if (!payload.report.branchId || !payload.report.reportDate) {
    return NextResponse.json({ error: "Missing branchId or reportDate" }, { status: 400 });
  }

  const reportValues: ReportInsert = {
    branch_id: payload.report.branchId,
    report_date: payload.report.reportDate,
    cashier_id: null,
    total_sales:
      payload.report.totalSales === undefined ? null : toNumber(payload.report.totalSales, 0),
    invoice_count:
      payload.report.invoiceCount === undefined ? null : toNumber(payload.report.invoiceCount, 0),
    returns_value: toNumber(payload.report.returnsValue, 0),
    discounts_value: toNumber(payload.report.discountsValue, 0),
    cash_expected:
      payload.report.cashExpected === undefined ? null : toNumber(payload.report.cashExpected, 0),
    cash_actual:
      payload.report.cashActual === undefined ? null : toNumber(payload.report.cashActual, 0),
    sales_pdf_url: payload.report.salesPdfUrl ?? null,
    fridge_photo_url: null,
    cash_photo_url: null,
    status: isStatus(payload.report.status) ? payload.report.status : "submitted",
    notes: payload.report.notes?.trim() || null,
    synced_to_excel: false,
    synced_at: null,
  };

  const existingResult = await supabase
    .from("daily_reports")
    .select("id")
    .eq("branch_id", payload.report.branchId)
    .eq("report_date", payload.report.reportDate)
    .maybeSingle();

  if (existingResult.error) {
    return NextResponse.json({ error: existingResult.error.message }, { status: 400 });
  }

  const existingReport = (existingResult.data ?? null) as { id: string } | null;

  const reportMutationRaw = existingReport
    ? await supabase
        .from("daily_reports")
        .update(reportValues as never)
        .eq("id", existingReport.id)
        .select()
        .single()
    : await supabase.from("daily_reports").insert(reportValues as never).select().single();

  const reportMutation = reportMutationRaw as {
    data: Database["public"]["Tables"]["daily_reports"]["Row"] | null;
    error: { message: string } | null;
  };

  if (reportMutation.error || !reportMutation.data) {
    return NextResponse.json(
      { error: reportMutation.error?.message || "Unable to save report" },
      { status: 400 }
    );
  }

  const reportId = reportMutation.data.id;

  const cleanupResults = await Promise.all([
    supabase.from("report_payments").delete().eq("report_id", reportId),
    supabase.from("report_meat_movements").delete().eq("report_id", reportId),
    supabase.from("report_expenses").delete().eq("report_id", reportId),
  ]);

  const cleanupError = cleanupResults.find((result) => result.error)?.error;

  if (cleanupError) {
    return NextResponse.json({ error: cleanupError.message }, { status: 400 });
  }

  const paymentRows = (payload.payments ?? [])
    .filter((payment) => toNumber(payment.amount, 0) !== 0)
    .map((payment) => ({
      report_id: reportId,
      payment_method_id: payment.methodId,
      amount: toNumber(payment.amount, 0),
    }));

  const meatRows = (payload.meatSales ?? []).map((item) => ({
    report_id: reportId,
    meat_type_id: item.meatTypeId,
    movement_type: "sales" as const,
    count: toNumber(item.count, 0),
    weight_kg: toNumber(item.weightKg, 0),
    notes: null,
  }));

  const inventoryRows = (payload.inventory ?? []).flatMap((item) => [
    {
      report_id: reportId,
      meat_type_id: item.meatTypeId,
      movement_type: "opening" as const,
      count: 0,
      weight_kg: toNumber(item.openingStock, 0),
      notes: null,
    },
    {
      report_id: reportId,
      meat_type_id: item.meatTypeId,
      movement_type: "incoming" as const,
      count: 0,
      weight_kg: toNumber(item.incoming, 0),
      notes: null,
    },
    {
      report_id: reportId,
      meat_type_id: item.meatTypeId,
      movement_type: "outgoing" as const,
      count: 0,
      weight_kg: toNumber(item.outgoing, 0),
      notes: null,
    },
    {
      report_id: reportId,
      meat_type_id: item.meatTypeId,
      movement_type: "remaining" as const,
      count: 0,
      weight_kg: toNumber(item.remainingActual, 0),
      notes:
        item.shortage === undefined
          ? null
          : `shortage:${toNumber(item.shortage, 0).toFixed(3)}`,
    },
  ]);

  const expenseRows = (payload.expenses ?? [])
    .filter((expense) => toNumber(expense.amount, 0) > 0)
    .map((expense) => ({
      report_id: reportId,
      category: expense.category?.trim() || null,
      description: expense.description?.trim() || null,
      amount: toNumber(expense.amount, 0),
    }));

  const childOperations = [];

  if (paymentRows.length > 0) {
    childOperations.push(supabase.from("report_payments").insert(paymentRows as never));
  }

  if (meatRows.length + inventoryRows.length > 0) {
    childOperations.push(
      supabase.from("report_meat_movements").insert([...meatRows, ...inventoryRows] as never)
    );
  }

  if (expenseRows.length > 0) {
    childOperations.push(supabase.from("report_expenses").insert(expenseRows as never));
  }

  const childResults = await Promise.all(childOperations);
  const childError = childResults.find((result) => result.error)?.error;

  if (childError) {
    return NextResponse.json({ error: childError.message }, { status: 400 });
  }

  return NextResponse.json({ data: reportMutation.data });
}
