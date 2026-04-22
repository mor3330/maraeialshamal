// الجلسة محمية بـ httpOnly cookie يضعها /api/admin/verify-pin
// هذا الملف يحتفظ فقط بحالة UI المحلية (هل عرضنا PIN؟)
export const ADMIN_SESSION_KEY = "marai_admin_ui";

export interface AdminSession {
  loggedIn: boolean;
  loginAt: number;
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    if (Date.now() - session.loginAt > 8 * 60 * 60 * 1000) {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveAdminSession() {
  // الـ cookie تُضبط من الخادم — نخزن هنا فقط لإخفاء شاشة الـ PIN
  const session: AdminSession = { loggedIn: true, loginAt: Date.now() };
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    // احذف الـ cookie بعمر 0
    document.cookie = "admin_token=; max-age=0; path=/";
  }
}
