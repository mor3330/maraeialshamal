// Client-side report draft store using sessionStorage
// Data persists across steps until submission

export interface ReportDraft {
  branchId: string;
  branchName: string;
  branchSlug: string;
  reportDate: string;
  requestId?: string; // معرف الطلب إذا كان التقرير مطلوبًا من الإدارة

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

const KEY = "marai_report_draft";

export function getDraft(): ReportDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveDraft(data: Partial<ReportDraft>): ReportDraft {
  const existing = getDraft() ?? ({} as ReportDraft);
  const updated = { ...existing, ...data };
  sessionStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
}

export function clearDraft() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(KEY);
  }
}

export function getSession(): { branchId: string; branchName: string; branchSlug: string } | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("cashier_session");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
