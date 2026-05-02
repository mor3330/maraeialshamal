import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

const ADMIN_PIN    = process.env.ADMIN_PIN    ?? "123456";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "marai-admin-secret-change-me";

// Rate limiting بسيط في الذاكرة
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function getIP(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
) as any;

export async function POST(request: NextRequest) {
  const ip  = getIP(request);
  const now = Date.now();

  // rate limit
  const rec = attempts.get(ip);
  if (rec) {
    if (now < rec.resetAt && rec.count >= MAX_ATTEMPTS) {
      const wait = Math.ceil((rec.resetAt - now) / 60000);
      return NextResponse.json({ error: `محاولات كثيرة، انتظر ${wait} دقيقة` }, { status: 429 });
    }
    if (now >= rec.resetAt) attempts.delete(ip);
  }

  let pin: string;
  try { ({ pin } = await request.json()); }
  catch { return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 }); }

  // ── 1) تحقق من رمز السوبر أدمن ──────────────────────────
  if (pin && pin === ADMIN_PIN) {
    attempts.delete(ip);
    const res = NextResponse.json({ ok: true, role: "superadmin", name: "المدير" });
    res.cookies.set("admin_token", ADMIN_SECRET, {
      httpOnly: true, sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60, path: "/",
    });
    return res;
  }

  // ── 2) تحقق من جدول المستخدمين ──────────────────────────
  try {
    const { data: users, error } = await sb
      .from("admin_users")
      .select("id, name, pin_hash, is_active, permissions, allowed_branches")
      .eq("is_active", true);

    if (!error && users && users.length > 0) {
      for (const u of users) {
        const match = await bcrypt.compare(String(pin), u.pin_hash);
        if (match) {
          attempts.delete(ip);
          const res = NextResponse.json({
            ok: true,
            role: "user",
            userId: u.id,
            name: u.name,
            permissions: u.permissions,
            allowed_branches: u.allowed_branches,
          });
          res.cookies.set("admin_token", ADMIN_SECRET, {
            httpOnly: true, sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 8 * 60 * 60, path: "/",
          });
          return res;
        }
      }
    }
  } catch {
    // إذا الجدول غير موجود بعد، نكمل بدون خطأ
  }

  // ── خاطئ ────────────────────────────────────────────────
  const cur = attempts.get(ip) ?? { count: 0, resetAt: now + WINDOW_MS };
  cur.count += 1;
  attempts.set(ip, cur);
  return NextResponse.json({ error: "رمز الدخول غير صحيح" }, { status: 401 });
}
