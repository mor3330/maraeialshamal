import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET: جلب جميع طلبات التقارير
export async function GET(request: Request) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("report_requests")
      .select(`
        *,
        branches (
          id,
          name,
          slug
        )
      `)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching report requests:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Error in GET /api/report-requests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: إنشاء طلب تقرير جديد
export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const { branch_id, requested_date, notes, requested_by } = body;

    if (!branch_id || !requested_date) {
      return NextResponse.json(
        { error: "Branch ID and requested date are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("report_requests")
      .insert({
        branch_id,
        requested_date,
        notes,
        requested_by,
        status: "pending",
      })
      .select(`
        *,
        branches (
          id,
          name,
          slug
        )
      `)
      .single();

    if (error) {
      console.error("Error creating report request:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/report-requests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: تحديث حالة طلب التقرير
export async function PATCH(request: Request) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "ID and status are required" },
        { status: 400 }
      );
    }

    const updateData: any = { status };
    if (status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("report_requests")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        branches (
          id,
          name,
          slug
        )
      `)
      .single();

    if (error) {
      console.error("Error updating report request:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in PATCH /api/report-requests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
