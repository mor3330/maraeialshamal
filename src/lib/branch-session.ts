// ✅ FIX: جلسة فرع موقّعة (HMAC) عبر HTTP-only cookie
// السبب: قبل هذا الإصلاح، الـ client كان يقدر يرسل أي branchId في الـ body
//        بدون أي تحقق من جهة الخادم → ممكن أحد يزور تقرير لفرع ثاني
// الآن: بعد PIN صحيح، نصدر cookie موقّع. كل طلب submit يتحقق من توافق
//       الـ branchId في الـ cookie مع branchId في الـ body
//
// نستخدم Node crypto (موجود بالـ runtime) بدون أي مكتبة خارجية

import crypto from "crypto";

const COOKIE_NAME = "marai_branch_session";
// مدة الصلاحية: 24 ساعة (كافية لإكمال تقرير اليوم)
const MAX_AGE_SECONDS = 24 * 60 * 60;

function getSecret(): string {
  const s =
    process.env.SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "marai-alshamal-fallback-secret-CHANGE-ME";
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

export interface BranchSessionPayload {
  branchId: string;
  branchSlug: string;
  iat: number; // issued at (seconds)
  exp: number; // expiry (seconds)
}

export function signBranchSession(branchId: string, branchSlug: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: BranchSessionPayload = {
    branchId,
    branchSlug,
    iat: now,
    exp: now + MAX_AGE_SECONDS,
  };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest();
  return `${payloadB64}.${b64url(sig)}`;
}

export function verifyBranchSession(token: string | undefined | null): BranchSessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest();
  const givenSig = b64urlDecode(sigB64);
  if (expectedSig.length !== givenSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, givenSig)) return null;
  try {
    const payload: BranchSessionPayload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildSetCookieHeader(token: string): string {
  // HttpOnly: غير قابل للقراءة من JS  (يمنع XSS)
  // SameSite=Lax: يُرسل مع الـ navigation العادي ولكن ليس CSRF
  // Secure: HTTPS only (لكن نسمح بـ http في dev)
  const isProd = process.env.NODE_ENV === "production";
  const flags = [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${MAX_AGE_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isProd) flags.push("Secure");
  return flags.join("; ");
}

export function getSessionCookieName(): string {
  return COOKIE_NAME;
}
