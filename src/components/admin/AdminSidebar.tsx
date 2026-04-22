"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { clearAdminSession } from "@/lib/admin-store";

const NAV = [
  { href: "/dashboard",            label: "الرئيسية",    icon: "◈" },
  { href: "/dashboard/branches",   label: "الفروع",      icon: "🏪" },
  { href: "/dashboard/reports",    label: "التقارير",   icon: "📋" },
  { href: "/dashboard/request-report", label: "طلب تقرير", icon: "📤" },
  { href: "/dashboard/pos-sales",  label: "مبيعات POS",  icon: "🖥️" },
  { href: "/dashboard/exports",            label: "الصادرات",               icon: "↗" },
  { href: "/dashboard/waste-comparison",   label: "مقارنة المخلفات",        icon: "⚖" },
  { href: "/dashboard/purchases",          label: "المشتريات",              icon: "🛒" },
  { href: "/dashboard/purchases-log",      label: "سجل المشتريات",          icon: "📦" },
  { href: "/dashboard/external-sales",     label: "المبيعات الخارجية",      icon: "🔄" },
  { href: "/dashboard/external-sales-log", label: "سجل المبيعات الخارجية", icon: "📋" },
  { href: "/dashboard/print",              label: "طباعة التقرير",           icon: "🖨️" },
  { href: "/dashboard/stats",      label: "الإحصائيات", icon: "📊" },
  { href: "/dashboard/settings",   label: "الإعدادات",  icon: "⚙️" },
];

// روابط قسم محمد طه (مسؤول المشتريات)
const MOHAMMED_NAV = [
  { href: "/dashboard/purchases-review", label: "مراجعة المشتريات", icon: "📊" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [showPinModal, setShowPinModal] = useState(false);
  const [current, setCurrent] = useState("");
  const [next1, setNext1] = useState("");
  const [next2, setNext2] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  function handleLogout() {
    clearAdminSession();
    router.push("/dashboard");
    router.refresh();
  }

  async function changePin() {
    setPinError(""); setPinSuccess(false);
    if (next1 !== next2) { setPinError("الرمزان الجديدان لا يتطابقان"); return; }
    if (next1.length < 4) { setPinError("الرمز الجديد يجب أن يكون 4 أرقام على الأقل"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin: current, newPin: next1 }),
      });
      const json = await res.json();
      if (!res.ok) { setPinError(json.error ?? "خطأ"); return; }
      setPinSuccess(true);
      setCurrent(""); setNext1(""); setNext2("");
      // Show success then close
      setTimeout(() => { setShowPinModal(false); setPinSuccess(false); }, 2000);
    } finally { setSaving(false); }
  }

  return (
    <>
      <aside className="w-60 min-h-screen bg-card border-l border-line flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-line">
          <div className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/10 px-3 py-1 text-xs text-green mb-3">
            <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
            Admin
          </div>
          <h2 className="text-base font-black text-cream">مراعي الشمال</h2>
          <p className="text-muted text-xs mt-0.5">لوحة الإدارة</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${active ? "bg-green/15 text-green border border-green/20" : "text-muted hover:text-cream hover:bg-card-hi"}`}>
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}

          {/* ── قسم محمد طه ── */}
          <div className="pt-3 mt-2 border-t border-line space-y-1">
            <Link
              href="/dashboard/purchases-review"
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all group ${
                pathname.startsWith("/dashboard/purchases-review")
                  ? "bg-amber/15 text-amber border border-amber/20"
                  : "text-muted hover:text-cream hover:bg-card-hi"
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-amber/20 flex items-center justify-center text-xs font-black text-amber flex-shrink-0">م</div>
              <div className="flex-1">
                <p className="text-sm font-bold">محمد طه</p>
                <p className="text-xs text-muted group-hover:text-muted">مراجعة المشتريات</p>
              </div>
            </Link>

            {/* ── قسم المحصلين ── */}
            <Link
              href="/dashboard/collectors"
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                pathname.startsWith("/dashboard/collectors")
                  ? "bg-green/15 text-green border border-green/20"
                  : "text-muted hover:text-cream hover:bg-card-hi"
              }`}
            >
              <span className="text-base">◎</span>
              المحصلين
            </Link>
          </div>
        </nav>

        {/* User settings + logout */}
        <div className="p-3 border-t border-line space-y-1">
          <button
            onClick={() => { setShowPinModal(true); setPinError(""); setPinSuccess(false); }}
            className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted hover:text-cream hover:bg-card-hi transition-colors text-right"
          >
            <span>🔑</span>
            تغيير رمز الدخول
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-red hover:bg-red/10 transition-colors text-right"
          >
            <span>↩</span>
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Change PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-3xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-cream mb-5">تغيير رمز الدخول</h2>

            {pinSuccess ? (
              <div className="rounded-2xl border border-green/20 bg-green/10 p-5 text-center">
                <div className="text-3xl mb-2">✓</div>
                <p className="text-green font-bold">تم تغيير الرمز</p>
                <p className="text-muted text-xs mt-1">حدّث ملف .env.local بالرمز الجديد لتفعيله نهائياً</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-muted text-sm block mb-1">الرمز الحالي</label>
                  <input type="password" inputMode="numeric" maxLength={8}
                    className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream focus:outline-none focus:border-green/50"
                    value={current} onChange={e => setCurrent(e.target.value)} />
                </div>
                <div>
                  <label className="text-muted text-sm block mb-1">الرمز الجديد</label>
                  <input type="password" inputMode="numeric" maxLength={8}
                    className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream focus:outline-none focus:border-green/50"
                    value={next1} onChange={e => setNext1(e.target.value)} />
                </div>
                <div>
                  <label className="text-muted text-sm block mb-1">تأكيد الرمز الجديد</label>
                  <input type="password" inputMode="numeric" maxLength={8}
                    className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream focus:outline-none focus:border-green/50"
                    value={next2} onChange={e => setNext2(e.target.value)} />
                </div>
                {pinError && <p className="text-red text-sm">{pinError}</p>}
                <div className="rounded-2xl border border-amber/20 bg-amber/10 p-3 text-amber text-xs">
                  ملاحظة: بعد التغيير حدّث قيمة ADMIN_PIN في ملف .env.local وأعد تشغيل السيرفر
                </div>
              </div>
            )}

            {!pinSuccess && (
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowPinModal(false)} className="flex-1 bg-card-hi border border-line text-cream rounded-2xl py-3 text-sm">إلغاء</button>
                <button onClick={changePin} disabled={saving || !current || !next1 || !next2}
                  className="flex-[2] bg-green hover:bg-green-dark disabled:opacity-50 text-white rounded-2xl py-3 font-bold text-sm">
                  {saving ? "جاري الحفظ..." : "تغيير الرمز"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
