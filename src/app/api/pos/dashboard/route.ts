import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface SaleRow {
  branch_id: string;
  total: number | null;
  paid_amount: number | null;
  payment_method: string | null;
  document_type: string | null;
  sale_date: string | null;
}

interface SyncLogRow {
  branch_id: string;
  sync_end: string | null;
  sales_count: number | null;
  status: string | null;
  error_message: string | null;
  agent_version: string | null;
}

function getRiyadhDateRange(period: string) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  if (period === "today") {
    const t = fmt(now);
    return { from: t, to: t };
  }
  if (period === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const t = fmt(y);
    return { from: t, to: t };
  }
  if (period === "week") {
    const start = new Date(now); start.setDate(start.getDate() - 6);
    return { from: fmt(start), to: fmt(now) };
  }
  if (period === "month") {
    const start = new Date(now); start.setDate(1);
    return { from: fmt(start), to: fmt(now) };
  }
  // default: today
  const t = fmt(now);
  return { from: t, to: t };
}

const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? "today";

  const supabase = createServiceClient();
  const range = getRiyadhDateRange(period);

  const fromUTC = `${range.from}T00:00:00+03:00`;
  const toUTC   = `${range.to}T23:59:59+03:00`;

  interface BranchRow { id: string; name: string; code: string; slug: string; is_active: boolean; pos_sync_enabled: boolean; }

  // ─── جلب الفروع ───
  const { data: rawBranches } = await supabase
    .from("branches")
    .select("id, name, code, slug, is_active, pos_sync_enabled")
    .order("name");
  const branches = (rawBranches ?? []) as BranchRow[];

  // ─── جلب المبيعات ───
  const { data: rawSales } = await (supabase as any)
    .from("sales")
    .select("branch_id, total, paid_amount, payment_method, document_type, sale_date")
    .gte("sale_date", fromUTC)
    .lte("sale_date", toUTC);
  const sales = (rawSales ?? []) as SaleRow[];

  // ─── آخر مزامنة لكل فرع (فقط السجلات المكتملة، بدون running) ───
  const { data: rawLogs } = await (supabase as any)
    .from("sync_logs")
    .select("branch_id, sync_end, sync_start, sales_count, status, error_message, agent_version")
    .not("sync_end", "is", null)
    .order("sync_end", { ascending: false });
  const logs = (rawLogs ?? []) as SyncLogRow[];

  // آخر سجل لكل فرع
  const lastSyncPerBranch: Record<string, SyncLogRow> = {};
  for (const log of logs) {
    if (!lastSyncPerBranch[log.branch_id]) {
      lastSyncPerBranch[log.branch_id] = log;
    }
  }

  // ─── تجميع لكل فرع ───
  type BranchStat = {
    id: string; name: string; slug: string; code: string; is_active: boolean; pos_sync_enabled: boolean;
    totalSales: number; invoiceCount: number; refundCount: number;
    cash: number; network: number; transfer: number; deferred: number;
    lastSync: string | null; lastSyncStatus: string | null;
    lastSyncError: string | null; syncedToday: boolean;
    agentVersion: string | null;
  };

  const branchMap: Record<string, BranchStat> = {};
  for (const b of (branches ?? [])) {
    branchMap[b.id] = {
      id: b.id, name: b.name, slug: b.slug, code: b.code, is_active: b.is_active, pos_sync_enabled: b.pos_sync_enabled !== false,
      totalSales: 0, invoiceCount: 0, refundCount: 0,
      cash: 0, network: 0, transfer: 0, deferred: 0,
      lastSync: lastSyncPerBranch[b.id]?.sync_end ?? null,
      lastSyncStatus: lastSyncPerBranch[b.id]?.status ?? null,
      lastSyncError:  lastSyncPerBranch[b.id]?.error_message ?? null,
      syncedToday: false,
      agentVersion: lastSyncPerBranch[b.id]?.agent_version ?? null,
    };
  }

  const now = new Date();
  const riyadhToday = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  const todayStr = `${riyadhToday.getFullYear()}-${String(riyadhToday.getMonth()+1).padStart(2,"0")}-${String(riyadhToday.getDate()).padStart(2,"0")}`;

  for (const s of sales) {
    const bs = branchMap[s.branch_id];
    if (!bs) continue;

    const amount = toN(s.total);
    const isRefund = (s.document_type ?? "").toLowerCase().includes("refund");

    if (isRefund) {
      bs.refundCount++;
    } else {
      bs.totalSales   += amount;
      bs.invoiceCount++;
    }

    const method = (s.payment_method ?? "").toLowerCase();
    const paid   = toN(s.paid_amount ?? s.total);

    if (method === "cash" || method.includes("نقد") || method.includes("كاش"))
      bs.cash += paid;
    else if (method === "network" || method.includes("card") || method.includes("شبكة"))
      bs.network += paid;
    else if (method === "transfer" || method.includes("تحويل"))
      bs.transfer += paid;
    else if (method === "deferred" || method.includes("آجل"))
      bs.deferred += paid;
    else
      bs.cash += paid; // fallback
  }

  // تحديد فروع زامنت اليوم
  for (const [bId, ls] of Object.entries(lastSyncPerBranch)) {
    if (ls.sync_end && ls.sync_end.startsWith(todayStr.slice(0, 10))) {
      if (branchMap[bId]) branchMap[bId].syncedToday = true;
    }
  }

  const branchStats = Object.values(branchMap);
  const r = (n: number) => Math.round(n * 100) / 100;

  // ─── الإصدار الأخير من sync_agent ───
  const { data: agentRow } = await (supabase as any)
    .from("sync_agent")
    .select("version")
    .eq("id", "main")
    .maybeSingle();
  const latestVersion: string = agentRow?.version ?? "2.3";

  const summary = {
    totalSales:    r(branchStats.reduce((a, b) => a + b.totalSales, 0)),
    invoiceCount:  branchStats.reduce((a, b) => a + b.invoiceCount, 0),
    totalCash:     r(branchStats.reduce((a, b) => a + b.cash, 0)),
    totalNetwork:  r(branchStats.reduce((a, b) => a + b.network, 0)),
    totalTransfer: r(branchStats.reduce((a, b) => a + b.transfer, 0)),
    totalDeferred: r(branchStats.reduce((a, b) => a + b.deferred, 0)),
    branchesWithData:  branchStats.filter(b => b.invoiceCount > 0).length,
    branchesTotal:     branchStats.length,
    syncedBranches:    branchStats.filter(b => b.syncedToday).length,
    updatedBranches:   branchStats.filter(b => b.pos_sync_enabled && b.agentVersion === latestVersion).length,
    latestVersion,
  };

  return NextResponse.json({ range, period, summary, branches: branchStats });
}
