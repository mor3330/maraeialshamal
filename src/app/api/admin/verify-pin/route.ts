import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ADMIN_PIN = process.env.ADMIN_PIN ?? "123456";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "marai-admin-secret-change-me";

// Rate limiting بسيط في الذاكرة — يمنع brute-force
// max 5 محاولات خاطئة كل 15 دقيقة لكل IP
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

export async function POST(request: NextRequest) {
  const ip = getIP(request);
  const now = Date.now();

  // تحقق من rate limit
  const rec = attempts.get(ip);
  if (rec) {
    if (now < rec.resetAt && rec.count >= MAX_ATTEMPTS) {
      const wait = Math.ceil((rec.resetAt - now) / 60000);
      return NextResponse.json(
        { error: `محاولات كثيرة، انتظر ${wait} دقيقة` },
        { status: 429 }
      );
    }
    if (now >= rec.resetAt) attempts.delete(ip);
  }

  let pin: string;
  try {
    ({ pin } = await request.json());
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  if (!pin || pin !== ADMIN_PIN) {
    // سجّل المحاولة الخاطئة
    const cur = attempts.get(ip) ?? { count: 0, resetAt: now + WINDOW_MS };
    cur.count += 1;
    attempts.set(ip, cur);
    return NextResponse.json({ error: "رمز الدخول غير صحيح" }, { status: 401 });
  }

  // نجح — أعد ضبط المحاولات وضع الـ cookie
  attempts.delete(ip);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", ADMIN_SECRET, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60, // 8 ساعات
    path: "/",
  });
  return res;
}
