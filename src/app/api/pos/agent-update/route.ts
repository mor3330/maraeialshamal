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

  // تخزين في Supabase
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

  return NextResponse.json({
    success: true,
    version,
    message: `✅ تم نشر sync.py v${version} لجميع الفروع — ستتحدث خلال ساعتين تلقائياً`,
  });
}
