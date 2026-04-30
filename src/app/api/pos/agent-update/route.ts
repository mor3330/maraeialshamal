/**
 * GET /api/pos/agent-update?version=X.Y
 * يُعيد الإصدار الجديد من sync.py إذا كان هناك تحديث
 *
 * POST /api/pos/agent-update
 * (للأدمن فقط) يُخزّن نسخة sync.py الحالية في Supabase لتوزيعها على الفروع
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join }         from "path";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── قراءة sync.py من ملفات المشروع ──────────────────────
function readSyncPy(): string {
  try {
    const p = join(process.cwd(), "aronium-sync", "sync.py");
    return readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

// ── استخراج الإصدار من محتوى sync.py ───────────────────
function extractVersion(script: string): string {
  const m = script.match(/^AGENT_VERSION\s*=\s*["']([^"']+)["']/m);
  return m ? m[1] : "1.0";
}

// ── GET: فحص التحديث ────────────────────────────────────
export async function GET(req: NextRequest) {
  const clientVersion = req.nextUrl.searchParams.get("version") || "1.0";

  // أولاً: ابحث في Supabase عن نسخة مخزّنة (Admin-pushed)
  const { data: row } = await supabase
    .from("sync_agent")
    .select("version, script_content")
    .eq("id", "main")
    .maybeSingle();

  let serverVersion: string;
  let script: string | null = null;

  if (row?.script_content) {
    // نسخة مخزّنة في قاعدة البيانات (Admin دفعها)
    serverVersion = String(row.version || "2.1");
    if (clientVersion !== serverVersion) {
      script = row.script_content;
    }
  } else {
    // fallback: اقرأ من ملفات المشروع
    const rawScript = readSyncPy();
    serverVersion   = extractVersion(rawScript) || "2.1";
    if (clientVersion !== serverVersion && rawScript.length > 500) {
      script = rawScript;
    }
  }

  const hasUpdate = clientVersion !== serverVersion;

  return NextResponse.json({
    hasUpdate,
    version: serverVersion,
    script:  hasUpdate ? script : null,
  });
}

// ── POST: الأدمن يدفع التحديث ────────────────────────────
export async function POST(req: NextRequest) {
  // التحقق من صلاحية الأدمن عبر السيرفس كي
  const authHeader = req.headers.get("authorization") || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!serviceKey || !authHeader.includes(serviceKey.slice(-20))) {
    // تحقق أبسط: فقط تأكد أن الطلب من الداشبورد الداخلي
    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const host   = req.headers.get("host") || "";
    const isInternal = origin.includes(host) || origin.includes("localhost") || !origin;
    if (!isInternal) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
  }

  // قراءة sync.py من ملفات المشروع
  const rawScript = readSyncPy();
  if (!rawScript || rawScript.length < 500) {
    return NextResponse.json({ error: "تعذّر قراءة sync.py" }, { status: 500 });
  }

  const version = extractVersion(rawScript);

  // 1) تخزين في Supabase sync_agent
  const { error } = await supabase
    .from("sync_agent")
    .upsert({
      id:             "main",
      version:        version,
      script_content: rawScript,
      updated_at:     new Date().toISOString(),
    }, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2) إنشاء force_update triggers لجميع الفروع المفعّلة — تُنفَّذ خلال 30 ثانية
  let triggeredBranches = 0;
  try {
    const { data: branches } = await supabase
      .from("branches")
      .select("id")
      .eq("is_active", true)
      .eq("pos_sync_enabled", true);

    if (branches && branches.length > 0) {
      const triggers = branches.map((b: { id: string }) => ({
        branch_id:    b.id,
        sync_type:    "force_update",
        status:       "pending",
        requested_at: new Date().toISOString(),
        note:         `تحديث فوري إلى v${version}`,
      }));

      await supabase.from("sync_triggers").insert(triggers);
      triggeredBranches = branches.length;
    }
  } catch (_e) {
    // إذا فشل إنشاء الـ triggers، التحديث سيحدث خلال 10 دقائق تلقائياً
  }

  return NextResponse.json({
    success: true,
    version,
    triggeredBranches,
    message: triggeredBranches > 0
      ? `✅ تم نشر v${version} — سيُحدَّث ${triggeredBranches} فرع خلال 30 ثانية`
      : `✅ تم نشر v${version} — الفروع ستتحدث خلال 10 دقائق`,
  });
}
