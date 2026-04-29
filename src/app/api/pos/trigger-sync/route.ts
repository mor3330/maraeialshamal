import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST: طلب مزامنة لفرع معين (عادية أو مخصصة بتاريخ)
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const body = await request.json().catch(() => ({}));
  const { branchId, note, dateFrom, dateTo } = body;

  if (!branchId) {
    return NextResponse.json({ error: "branchId مطلوب" }, { status: 400 });
  }

  // نوع المزامنة
  const isCustomDate = !!(dateFrom && dateTo);
  const syncType = isCustomDate ? "custom_date" : "normal";

  // تحقق من الفرع ومزامنة POS
  const { data: branch, error: branchErr } = await (supabase as any)
    .from("branches")
    .select("id, name, pos_sync_enabled")
    .eq("id", branchId)
    .single();

  if (branchErr || !branch) {
    return NextResponse.json({ error: "الفرع غير موجود" }, { status: 404 });
  }

  // منع المزامنة إذا كانت معطلة لهذا الفرع
  if (branch.pos_sync_enabled === false) {
    return NextResponse.json({
      error: "🔴 مزامنة POS متوقفة لهذا الفرع. فعّلها من صفحة مبيعات POS."
    }, { status: 403 });
  }

  // إلغاء أي طلبات pending قديمة لنفس الفرع (أكثر من 15 دقيقة)
  await (supabase as any)
    .from("sync_triggers")
    .update({ status: "failed", note: "استُبدل بطلب جديد" })
    .eq("branch_id", branchId)
    .eq("status", "pending")
    .lt("requested_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

  // بناء سجل الطلب
  const triggerRecord: Record<string, any> = {
    branch_id: branchId,
    status: "pending",
    sync_type: syncType,
    note: note || (isCustomDate
      ? `مزامنة مخصصة: ${dateFrom} → ${dateTo} - ${new Date().toLocaleString("ar-SA")}`
      : `طلب يدوي - ${new Date().toLocaleString("ar-SA")}`),
  };

  if (isCustomDate) {
    triggerRecord.date_from = dateFrom;
    triggerRecord.date_to   = dateTo;
  }

  // إضافة الطلب
  const { data: trigger, error: triggerErr } = await (supabase as any)
    .from("sync_triggers")
    .insert(triggerRecord)
    .select()
    .single();

  if (triggerErr) {
    return NextResponse.json({ error: triggerErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    triggerId: trigger.id,
    branchName: branch.name,
    syncType,
    dateFrom: dateFrom || null,
    dateTo:   dateTo   || null,
    message: isCustomDate
      ? `تم إرسال طلب المزامنة المخصصة (${dateFrom} → ${dateTo}). سيتم التنفيذ خلال دقيقة.`
      : "تم إرسال طلب المزامنة. سيتم التنفيذ خلال دقيقة.",
  });
}

// GET: فحص حالة آخر طلب مزامنة لفرع
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const branchId  = url.searchParams.get("branchId");
  const triggerId = url.searchParams.get("triggerId");

  if (!branchId) return NextResponse.json({ error: "branchId مطلوب" }, { status: 400 });

  const supabase = createServiceClient();

  let query = (supabase as any)
    .from("sync_triggers")
    .select("id, status, requested_at, executed_at, note, sync_type, date_from, date_to")
    .eq("branch_id", branchId)
    .order("requested_at", { ascending: false })
    .limit(1);

  // إذا عندنا triggerId نفحص الطلب المحدد
  if (triggerId) {
    query = (supabase as any)
      .from("sync_triggers")
      .select("id, status, requested_at, executed_at, note, sync_type, date_from, date_to")
      .eq("id", triggerId)
      .single();
  }

  const { data: trigger } = await query.maybeSingle ? query.maybeSingle() : query;

  if (!trigger) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({ found: true, trigger });
}
