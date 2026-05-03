"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Branch {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface ReportRequest {
  id: string;
  branch_id: string;
  requested_date: string;
  notes: string | null;
  status: string;
  requested_by: string | null;
  requested_at: string | null;
  created_at: string | null;
  completed_at: string | null;
  branches: {
    id: string;
    name: string;
    slug: string;
  };
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("ar-SA");
}

export default function RequestReportPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [requests, setRequests] = useState<ReportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [branchId, setBranchId] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [requestedBy, setRequestedBy] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [branchesRes, requestsRes] = await Promise.all([
        fetch("/api/admin/branches", { cache: 'no-store' }),
        fetch("/api/report-requests", { cache: 'no-store' }),
      ]);

      if (branchesRes.ok) {
        const branchesData = await branchesRes.json();
        console.log("🔍 [Request Page] branchesData keys:", Object.keys(branchesData));
        const branchList = branchesData.branches || branchesData.data || branchesData;
        console.log("🔍 [Request Page] branchList count:", Array.isArray(branchList) ? branchList.length : typeof branchList);
        // عرض جميع الفروع (نشطة وغير نشطة)
        const allBranches = Array.isArray(branchList) ? branchList : [];
        console.log("🔍 [Request Page] allBranches:", allBranches.length);
        setBranches(allBranches);
      } else {
        console.error("🔍 [Request Page] branches API error:", branchesRes.status);
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        console.log("🔍 [Request Page] requestsData type:", typeof requestsData, Array.isArray(requestsData));
        // API يرجع مصفوفة مباشرة
        setRequests(Array.isArray(requestsData) ? requestsData : (requestsData.data || requestsData.requests || []));
      } else {
        console.error("🔍 [Request Page] requests API error:", requestsRes.status);
        setRequests([]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId || !requestedDate) return;

    try {
      setSubmitting(true);
      const response = await fetch("/api/report-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          requested_date: requestedDate,
          notes: notes || null,
          requested_by: requestedBy || "Admin",
        }),
      });

      const resData = await response.json().catch(() => ({}));

      if (response.ok) {
        // Reset form
        setBranchId("");
        setRequestedDate("");
        setNotes("");
        setRequestedBy("");
        // Reload requests
        await loadData();
        alert("✅ تم إرسال الطلب بنجاح! سيظهر للفرع فور دخوله.");
      } else {
        const errMsg = resData?.error || resData?.message || `خطأ ${response.status}`;
        alert(`❌ فشل إرسال الطلب:\n${errMsg}`);
        console.error("API error:", resData);
      }
    } catch (error) {
      console.error("Error submitting request:", error);
      alert("❌ حدث خطأ في الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      const response = await fetch("/api/report-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      const resData = await response.json().catch(() => ({}));

      if (response.ok) {
        await loadData();
      } else {
        const errMsg = resData?.error || resData?.message || `خطأ ${response.status}`;
        alert(`❌ فشل تحديث الحالة:\n${errMsg}`);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("❌ حدث خطأ في الاتصال بالخادم");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-green border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-muted text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-cream">
      <div className="absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(circle_at_top,_rgba(63,166,106,0.12),_transparent_50%)] pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="rounded-[32px] border border-line bg-card/95 backdrop-blur p-6 sm:p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl sm:text-4xl font-black">طلب تقرير</h1>
            <button
              onClick={() => router.back()}
              className="rounded-2xl border border-line bg-card-hi px-4 py-2 text-sm text-muted hover:text-cream hover:border-green/30 transition-all"
            >
              ← رجوع
            </button>
          </div>
          <p className="text-muted text-sm">
            اطلب من الكاشير إرسال تقرير معين
          </p>
        </div>

        {/* Form */}
        <div className="rounded-[28px] border border-line bg-card p-6 mb-6">
          <h2 className="text-2xl font-black mb-6">طلب تقرير جديد</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-sm font-medium mb-2">الفرع *</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-cream focus:border-green focus:outline-none"
              >
                <option value="">اختر الفرع</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">التاريخ المطلوب *</label>
              <input
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                required
                className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-cream focus:border-green focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">طالب التقرير</label>
              <input
                type="text"
                value={requestedBy}
                onChange={(e) => setRequestedBy(e.target.value)}
                placeholder="اسم طالب التقرير (اختياري)"
                className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-cream focus:border-green focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">ملاحظات</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات إضافية (اختياري)"
                rows={3}
                className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-cream focus:border-green focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-green px-6 py-3 font-bold text-bg hover:bg-green/90 transition-colors disabled:opacity-50"
            >
              {submitting ? "جاري الإرسال..." : "إرسال الطلب"}
            </button>
          </form>
        </div>

        {/* Requests List */}
        <div className="rounded-[28px] border border-line bg-card p-6">
          <h2 className="text-2xl font-black mb-6">الطلبات السابقة</h2>
          
          {requests.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <p>لا توجد طلبات حالياً</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-line bg-card-hi p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{request.branches.name}</h3>
                      <p className="text-sm text-muted">
                        التاريخ المطلوب: {new Date(request.requested_date).toLocaleDateString("ar-SA")}
                      </p>
                      {request.requested_by && (
                        <p className="text-xs text-muted">
                          طالب التقرير: {request.requested_by}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          request.status === "completed"
                            ? "bg-green/20 text-green"
                            : request.status === "cancelled"
                            ? "bg-red/20 text-red"
                            : "bg-amber/20 text-amber"
                        }`}
                      >
                        {request.status === "completed"
                          ? "مكتمل"
                          : request.status === "cancelled"
                          ? "ملغي"
                          : "قيد الانتظار"}
                      </span>
                      
                      {request.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateStatus(request.id, "completed")}
                            className="rounded-lg bg-green/20 px-3 py-1 text-xs text-green hover:bg-green/30 transition-colors"
                          >
                            إكمال
                          </button>
                          <button
                            onClick={() => updateStatus(request.id, "cancelled")}
                            className="rounded-lg bg-red/20 px-3 py-1 text-xs text-red hover:bg-red/30 transition-colors"
                          >
                            إلغاء
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {request.notes && (
                    <p className="text-sm text-muted bg-bg/60 rounded-lg p-3">
                      {request.notes}
                    </p>
                  )}
                  
                  <div className="mt-3 text-xs text-muted">
                    <p>تاريخ الطلب: {fmtDate(request.requested_at ?? request.created_at)}</p>
                    {request.completed_at && (
                      <p>تاريخ الإكمال: {fmtDate(request.completed_at)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
