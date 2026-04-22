"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/report-store";

interface Report {
  id: string;
  report_date: string;
  status: "draft" | "submitted" | "approved" | "flagged";
  total_sales: number | null;
  submitted_at: string;
}

interface ReportRequest {
  id: string;
  requested_date: string;
  notes: string | null;
  status: string;
  requested_by: string | null;
  requested_at: string;
}

export default function BranchHomeClient({ slug }: { slug: string }) {
  const router = useRouter();
  const [session, setSession] = useState<{ branchId: string; branchName: string } | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [todayReport, setTodayReport] = useState<Report | null>(null);
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ReportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s || s.branchSlug !== slug) {
      router.replace(`/branch/${slug}`);
      return;
    }
    setSession(s);

    // Calculate target date using Riyadh timezone (UTC+3)
    // Reports are always for the previous day
    const nowRiyadh = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    const yesterdayRiyadh = new Date(nowRiyadh);
    yesterdayRiyadh.setDate(yesterdayRiyadh.getDate() - 1);
    const y = yesterdayRiyadh.getFullYear();
    const m = String(yesterdayRiyadh.getMonth() + 1).padStart(2, "0");
    const d = String(yesterdayRiyadh.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    setTargetDate(dateStr);

    // Load today's report status
    loadReportStatus(s.branchId, dateStr);
    // Load recent reports
    loadRecentReports(s.branchId);
    // Load pending requests
    loadPendingRequests(s.branchId);
  }, [slug, router]);

  async function loadReportStatus(branchId: string, date: string) {
    try {
      const res = await fetch(`/api/reports/branch/${branchId}?date=${date}`);
      const data = await res.json();
      setTodayReport(data.data);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  async function loadRecentReports(branchId: string) {
    try {
      const res = await fetch(`/api/reports/branch/${branchId}?limit=7`);
      const data = await res.json();
      setRecentReports(data.data || []);
    } catch {
      setRecentReports([]);
    }
  }

  async function loadPendingRequests(branchId: string) {
    try {
      const res = await fetch(`/api/report-requests/branch/${branchId}?status=pending`);
      const data = await res.json();
      setPendingRequests(data || []);
    } catch {
      setPendingRequests([]);
    }
  }

  function handleStartReport() {
    router.push(`/branch/${slug}/report/step-1`);
  }

  if (!session || loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-muted">جاري التحميل...</p>
      </div>
    );
  }

  const targetDateFormatted = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Riyadh",
  }).format(new Date(targetDate + "T12:00:00"));

  const nowRiyadh = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  const isLate = nowRiyadh.getHours() >= 23; // بعد 11 مساءً بتوقيت الرياض

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-card border-b border-line p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-cream text-2xl font-bold mb-1">{session.branchName}</h1>
              <p className="text-muted text-sm">مراعي الشمال · الإقفال اليومي</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-green animate-pulse" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Pending Requests Alert */}
        {pendingRequests.length > 0 && (
          <div className="bg-amber/10 border-2 border-amber/30 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber/20 flex items-center justify-center flex-shrink-0">
                <span className="text-amber text-xl">📤</span>
              </div>
              <div className="flex-1">
                <h3 className="text-amber font-bold text-lg mb-1">
                  طلبات تقارير من الإدارة ({pendingRequests.length})
                </h3>
                <p className="text-amber/80 text-sm">
                  الإدارة طلبت تقارير لتواريخ محددة
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {pendingRequests.map((req) => (
                <div key={req.id} className="bg-bg/50 rounded-xl p-3 border border-amber/20">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-cream font-medium">
                      📅 تقرير يوم {new Date(req.requested_date).toLocaleDateString("ar-SA")}
                    </p>
                    {req.requested_by && (
                      <p className="text-muted text-xs">من: {req.requested_by}</p>
                    )}
                  </div>
                  {req.notes && (
                    <p className="text-muted text-sm mb-2">{req.notes}</p>
                  )}
                  <button
                    onClick={() => {
                      // حفظ التاريخ المطلوب ومعرف الطلب في session
                      sessionStorage.setItem('requested_report_date', req.requested_date);
                      sessionStorage.setItem('requested_report_id', req.id);
                      
                      // إزالة من القائمة مؤقتاً
                      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
                      
                      // الانتقال لبدء التقرير
                      router.push(`/branch/${slug}/report/step-1`);
                    }}
                    className="w-full bg-amber/20 hover:bg-amber/30 text-amber rounded-lg py-2 text-sm font-medium transition-colors"
                  >
                    إنشاء التقرير
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Target Date Card */}
        <div className="bg-card rounded-2xl border border-line overflow-hidden">
          <div className="bg-card-hi px-6 py-4 border-b border-line">
            <h2 className="text-cream font-bold text-lg">التقرير المطلوب</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-muted text-sm mb-1">التاريخ</p>
                <p className="text-cream text-2xl font-bold ltr-num" dir="ltr">
                  {targetDateFormatted}
                </p>
              </div>
              {isLate && (
                <div className="bg-amber/10 border border-amber/30 text-amber px-4 py-2 rounded-xl text-sm font-medium">
                  ⚠️ متأخر
                </div>
              )}
            </div>

            {todayReport ? (
              <div className="bg-green/10 border border-green/30 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green text-xl">✓</span>
                  <span className="text-green font-bold">تم الإرسال</span>
                </div>
                <p className="text-muted text-sm">
                  إجمالي المبيعات: {todayReport.total_sales?.toLocaleString('ar-SA')} ريال
                </p>
              </div>
            ) : (
              <button
                onClick={handleStartReport}
                className="w-full bg-green hover:bg-green-dark text-white rounded-2xl py-4 text-lg font-bold transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>بدء التقرير اليومي</span>
                <span>←</span>
              </button>
            )}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="bg-card rounded-2xl border border-line overflow-hidden">
          <div className="bg-card-hi px-6 py-4 border-b border-line">
            <h2 className="text-cream font-bold text-lg">سجل التقارير</h2>
          </div>
          <div className="p-6">
            {recentReports.length === 0 ? (
              <p className="text-muted text-center py-8">لا توجد تقارير سابقة</p>
            ) : (
              <div className="space-y-3">
                {recentReports.map(report => (
                  <button
                    key={report.id}
                    onClick={() => router.push(`/branch/${slug}/reports/${report.id}`)}
                    className="w-full bg-card-hi rounded-xl p-4 border border-line hover:border-green/30 transition-colors text-right"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-cream font-medium">{report.report_date}</p>
                        <p className="text-muted text-xs mt-1">
                          {report.total_sales?.toLocaleString('ar-SA')} ريال
                        </p>
                      </div>
                      <StatusBadge status={report.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => {
            sessionStorage.clear();
            router.replace(`/branch/${slug}`);
          }}
          className="w-full bg-card-hi border border-line text-muted rounded-2xl py-3 text-sm hover:text-cream transition-colors"
        >
          تسجيل خروج
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    draft: { label: "مسودة", bg: "bg-muted/20", text: "text-muted" },
    submitted: { label: "مرسل", bg: "bg-green/20", text: "text-green" },
    approved: { label: "معتمد", bg: "bg-green/20", text: "text-green" },
    flagged: { label: "منبّه", bg: "bg-amber/20", text: "text-amber" },
  };

  const c = config[status as keyof typeof config] || config.draft;

  return (
    <span className={`${c.bg} ${c.text} px-3 py-1 rounded-full text-xs font-medium`}>
      {c.label}
    </span>
  );
}
