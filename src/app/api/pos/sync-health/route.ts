import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url      = new URL(request.url);
  const branchId = url.searchParams.get("branchId");

  if (!branchId) return NextResponse.json({ error: "branchId مطلوب" }, { status: 400 });

  const supabase = createServiceClient();

  // آخر سجل مزامنة ناجح
  const { data: lastLog } = await (supabase as any)
    .from("sync_logs")
    .select("id, status, sync_start, sync_end, sales_count, error_message")
    .eq("branch_id", branchId)
    .order("sync_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  // آخر trigger (بأي حالة)
  const { data: lastTrigger } = await (supabase as any)
    .from("sync_triggers")
    .select("id, status, requested_at, executed_at, sync_type, date_from, date_to, note")
    .eq("branch_id", branchId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // عدد الـ triggers العالقة (pending أكثر من 5 دقائق)
  const { count: stuckCount } = await (supabase as any)
    .from("sync_triggers")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", branchId)
    .eq("status", "pending")
    .lt("requested_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

  // حساب كم مضى على آخر مزامنة
  const now = Date.now();
  let lastSyncMinutesAgo: number | null = null;
  if (lastLog?.sync_end) {
    lastSyncMinutesAgo = Math.round((now - new Date(lastLog.sync_end).getTime()) / 60000);
  } else if (lastLog?.sync_start) {
    lastSyncMinutesAgo = Math.round((now - new Date(lastLog.sync_start).getTime()) / 60000);
  }

  // تحديد حالة السكريبت
  let scriptStatus: "healthy" | "warning" | "dead" | "unknown";
  if (lastSyncMinutesAgo === null) {
    scriptStatus = "unknown";
  } else if (lastSyncMinutesAgo <= 10) {
    scriptStatus = "healthy";
  } else if (lastSyncMinutesAgo <= 30) {
    scriptStatus = "warning";
  } else {
    scriptStatus = "dead";
  }

  // إذا كان آخر trigger عالقاً (pending > 3 دقائق) → مشكلة
  if (lastTrigger?.status === "pending") {
    const triggerAge = Math.round((now - new Date(lastTrigger.requested_at).getTime()) / 60000);
    if (triggerAge >= 3) {
      scriptStatus = "dead";
    }
  }

  return NextResponse.json({
    scriptStatus,
    lastSync: lastLog ? {
      status:     lastLog.status,
      syncStart:  lastLog.sync_start,
      syncEnd:    lastLog.sync_end,
      salesCount: lastLog.sales_count,
      errorMsg:   lastLog.error_message,
      minutesAgo: lastSyncMinutesAgo,
    } : null,
    lastTrigger: lastTrigger ? {
      id:          lastTrigger.id,
      status:      lastTrigger.status,
      requestedAt: lastTrigger.requested_at,
      executedAt:  lastTrigger.executed_at,
      syncType:    lastTrigger.sync_type,
      dateFrom:    lastTrigger.date_from,
      dateTo:      lastTrigger.date_to,
      minutesAgo:  Math.round((now - new Date(lastTrigger.requested_at).getTime()) / 60000),
    } : null,
    stuckTriggers: stuckCount || 0,
  });
}
