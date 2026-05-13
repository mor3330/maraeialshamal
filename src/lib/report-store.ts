// Client-side report draft store using sessionStorage
// ✅ FIX: المفاتيح الآن خاصة بكل فرع لمنع اختلاط البيانات بين الفروع
// عند فتح تبويب جديد من نفس المتصفح (Duplicate Tab أو Open in new tab)

export interface ReportDraft {
  branchId: string;
  branchName: string;
  branchSlug: string;
  reportDate: string;
  requestId?: string;

  // Step 1: Sales
  totalSales?: number;
  invoiceCount?: number;
  returnsValue?: number;
  discountsValue?: number;
  salesPdfUrl?: string;
  step1CustomFields?: Record<string, any>;

  // Step 2: Payment methods
  payments?: { methodId: string; methodName: string; methodCode: string; amount: number }[];

  // Step 3: Meat sales
  meatSales?: {
    meatTypeId: string;
    meatTypeName: string;
    category: string;
    hasCount: boolean;
    count: number;
    weightKg: number;
  }[];

  // Step 4: Inventory
  inventory?: {
    meatTypeId: string;
    meatTypeName: string;
    openingStock: number;
    incoming: number;
    outgoing: number;
    remainingActual: number;
    remainingExpected?: number;
    shortage?: number;
  }[];

  // Step 5: Cash & expenses
  cashActual?: number;
  expenses?: { category: string; description: string; amount: number }[];
  notes?: string;
  step7Values?: Record<string, any>;

  // Computed
  cashExpected?: number;
}

// ===== استخراج slug الفرع تلقائياً من الـ URL =====
function getCurrentBranchSlug(): string | null {
  if (typeof window === "undefined") return null;
  // URLs مثل: /branch/{slug}/home  أو  /branch/{slug}/report/step-1
  const m = window.location.pathname.match(/\/branch\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function draftKey(slug?: string | null): string {
  const s = slug ?? getCurrentBranchSlug();
  // إذا ما عرفنا الفرع من الـ URL، رجّع المفتاح القديم (للتوافق فقط)
  return s ? `marai_report_draft__${s}` : "marai_report_draft";
}

function sessionKey(slug?: string | null): string {
  const s = slug ?? getCurrentBranchSlug();
  return s ? `cashier_session__${s}` : "cashier_session";
}

// تنظيف لمرة واحدة: لو في مفاتيح قديمة عامة، احذفها لمنع التلوث
function cleanupLegacyKeys() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem("marai_report_draft");
    // ملاحظة: ما نحذف cashier_session القديم — يستخدمه PinLogin إذا ما اشتغل الفرع الجديد
  } catch {}
}

// ===== الدوال العامة (نفس الـ API السابق - backward compatible) =====

export function getDraft(): ReportDraft | null {
  if (typeof window === "undefined") return null;
  cleanupLegacyKeys();
  const slug = getCurrentBranchSlug();
  const raw = sessionStorage.getItem(draftKey(slug));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // التحقق الإضافي: لو الـ branchSlug في الـ draft لا يطابق slug الـ URL → امسحه
    if (slug && parsed.branchSlug && parsed.branchSlug !== slug) {
      sessionStorage.removeItem(draftKey(slug));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(data: Partial<ReportDraft>): ReportDraft {
  cleanupLegacyKeys();
  const slug = getCurrentBranchSlug() ?? data.branchSlug ?? null;
  const existing = getDraft() ?? ({} as ReportDraft);
  const updated = { ...existing, ...data };
  sessionStorage.setItem(draftKey(slug), JSON.stringify(updated));
  return updated;
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  const slug = getCurrentBranchSlug();
  sessionStorage.removeItem(draftKey(slug));
  // كمان نظّف القديم لو موجود
  sessionStorage.removeItem("marai_report_draft");
}

// مسح كل مسودات كل الفروع (يُستخدم في زر "تنظيف كامل")
export function clearAllDrafts() {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith("marai_report_draft") || k.startsWith("cashier_session"))) {
        keys.push(k);
      }
    }
    keys.forEach(k => sessionStorage.removeItem(k));
  } catch {}
}

export function getSession(): { branchId: string; branchName: string; branchSlug: string } | null {
  if (typeof window === "undefined") return null;
  const slug = getCurrentBranchSlug();
  // أولاً جرّب المفتاح الخاص بالفرع
  let raw = sessionStorage.getItem(sessionKey(slug));
  // fallback للمفتاح القديم (للتوافق مع جلسات ما زالت مفتوحة)
  if (!raw) raw = sessionStorage.getItem("cashier_session");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // التحقق الإضافي: الجلسة يجب أن تطابق فرع الـ URL
    if (slug && parsed.branchSlug && parsed.branchSlug !== slug) {
      return null; // الجلسة لفرع ثاني → ارجع null لإجبار إعادة تسجيل الدخول
    }
    return parsed;
  } catch {
    return null;
  }
}

// لاستخدام PinLoginClient (يكتب الجلسة الخاصة بالفرع الذي سجّل فيه)
export function saveSessionForBranch(branchId: string, branchName: string, branchSlug: string) {
  if (typeof window === "undefined") return;
  const data = JSON.stringify({
    branchId,
    branchName,
    branchSlug,
    loginAt: new Date().toISOString(),
  });
  sessionStorage.setItem(sessionKey(branchSlug), data);
  // كمان نحفظها في القديم للتوافق
  sessionStorage.setItem("cashier_session", data);
}
