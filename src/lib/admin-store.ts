// الجلسة محمية بـ httpOnly cookie يضعها /api/admin/verify-pin
// هذا الملف يحتفظ بحالة UI المحلية + بيانات المستخدم

export const ADMIN_SESSION_KEY = "marai_admin_ui";

export interface AdminSession {
  loggedIn: boolean;
  loginAt: number;
  role: "superadmin" | "user";
  name: string;
  userId?: string;
  permissions: Record<string, boolean>; // {} = كل الصلاحيات لـ superadmin
  allowed_branches: string[] | null;    // null = كل الفروع
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
    // إذا الجلسة قديمة وما فيها role — نعاملها كسوبر أدمن
    if (!session.role) {
      session.role = "superadmin";
      session.permissions = {};
      session.allowed_branches = null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveAdminSession(data?: {
  role?: "superadmin" | "user";
  name?: string;
  userId?: string;
  permissions?: Record<string, boolean>;
  allowed_branches?: string[] | null;
}) {
  const session: AdminSession = {
    loggedIn: true,
    loginAt: Date.now(),
    role: data?.role ?? "superadmin",
    name: data?.name ?? "المدير",
    userId: data?.userId,
    permissions: data?.permissions ?? {},
    allowed_branches: data?.allowed_branches ?? null,
  };
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    document.cookie = "admin_token=; max-age=0; path=/";
  }
}
