"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAdminSession, getAdminSession } from "@/lib/admin-store";

function IconUsers() { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>; }

// ── أيقونات SVG ──────────────────────────────────────────
function IconHome()     { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h4a1 1 0 001-1v-3h2v3a1 1 0 001 1h4a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>; }
function IconBranch()   { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h2v2H7V5zm0 4h2v2H7V9zm0 4h2v2H7v-2zm4-8h2v2h-2V5zm0 4h2v2h-2V9zm0 4h2v2h-2v-2z" clipRule="evenodd"/></svg>; }
function IconReport()   { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>; }
function IconSend()     { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>; }
function IconMonitor()  { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd"/></svg>; }
function IconTag()      { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>; }
function IconExport()   { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>; }
function IconScale()    { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 14a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 5.82V16h2a1 1 0 110 2H7a1 1 0 110-2h2V5.82L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd"/></svg>; }
function IconCart()     { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>; }
function IconList()     { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>; }
function IconExchange() { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z"/></svg>; }
function IconPrinter()  { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4zm2-4a1 1 0 110 2 1 1 0 010-2z" clipRule="evenodd"/></svg>; }
function IconChart()    { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>; }
function IconVAT()      { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>; }
function IconSettings() { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/></svg>; }
function IconKey()      { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd"/></svg>; }
function IconLogout()   { return <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd"/></svg>; }

type NavItem = {
  href: string;
  label: string;
  Icon: () => JSX.Element;
  permKey: string; // مفتاح الصلاحية
};

const NAV: NavItem[] = [
  { href: "/dashboard",                    label: "الرئيسية",               Icon: IconHome,     permKey: "dashboard"          },
  { href: "/dashboard/branches",           label: "الفروع",                 Icon: IconBranch,   permKey: "branches"           },
  { href: "/dashboard/reports",            label: "التقارير",               Icon: IconReport,   permKey: "reports"            },
  { href: "/dashboard/request-report",     label: "طلب تقرير",              Icon: IconSend,     permKey: "request-report"     },
  { href: "/dashboard/pos-sales",          label: "مبيعات POS",             Icon: IconMonitor,  permKey: "pos-sales"          },
  { href: "/dashboard/products",           label: "تصنيف المنتجات",         Icon: IconTag,      permKey: "products"           },
  { href: "/dashboard/exports",            label: "الصادرات",               Icon: IconExport,   permKey: "exports"            },
  { href: "/dashboard/waste-comparison",   label: "مقارنة المخلفات",        Icon: IconScale,    permKey: "waste-comparison"   },
  { href: "/dashboard/purchases",          label: "المشتريات",              Icon: IconCart,     permKey: "purchases"          },
  { href: "/dashboard/purchases-log",        label: "سجل المشتريات",          Icon: IconList,     permKey: "purchases-log"        },
  { href: "/dashboard/purchases-comparison", label: "مقارنة المشتريات",       Icon: IconScale,    permKey: "purchases-comparison" },
  { href: "/dashboard/external-sales",     label: "المبيعات الخارجية",      Icon: IconExchange, permKey: "external-sales"     },
  { href: "/dashboard/external-sales-log", label: "سجل المبيعات الخارجية", Icon: IconReport,   permKey: "external-sales-log" },
  { href: "/dashboard/print",              label: "طباعة التقرير",          Icon: IconPrinter,  permKey: "print"              },
  { href: "/dashboard/vat-report",         label: "تقرير الضريبة (VAT)",    Icon: IconVAT,      permKey: "vat-report"         },
  { href: "/dashboard/stats",              label: "الإحصائيات",             Icon: IconChart,    permKey: "stats"              },
  { href: "/dashboard/settings",           label: "الإعدادات",              Icon: IconSettings, permKey: "settings"           },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [showPinModal, setShowPinModal] = useState(false);

  // ── قراءة جلسة المستخدم من sessionStorage ────────────
  const [session, setSession] = useState<ReturnType<typeof getAdminSession>>(null);
  useEffect(() => { setSession(getAdminSession()); }, []);

  // ── تحديد العناصر المسموح بعرضها ─────────────────────
  const isSuperAdmin = !session || !session.role || session.role === "superadmin";
  const visibleNav = isSuperAdmin
    ? NAV
    : NAV.filter(item => session.permissions?.[item.permKey] === true);

  // اسم المستخدم للعرض
  const userName = session?.name ?? "المدير";
  const [current,  setCurrent]  = useState("");
  const [next1,    setNext1]    = useState("");
  const [next2,    setNext2]    = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);
  const [saving,   setSaving]   = useState(false);
  // قائمة محمد طه — تفتح تلقائياً إذا كنا في الصفحات المرتبطة
  const [mtOpen, setMtOpen]     = useState(
    () =>
      pathname.startsWith("/dashboard/purchases-review") ||
      pathname.startsWith("/dashboard/suppliers") ||
      pathname.startsWith("/dashboard/mt-ledger")
  );

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
          {session && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green flex-shrink-0" />
              <span className="text-xs text-cream font-medium truncate">{userName}</span>
              {session.role === "superadmin" && (
                <span className="text-[10px] bg-green/20 text-green rounded-full px-1.5 py-0.5">مدير</span>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(item => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-green/15 text-green border border-green/20"
                    : "text-muted hover:text-cream hover:bg-card-hi"
                }`}>
                <span className="flex-shrink-0 opacity-80">
                  <item.Icon />
                </span>
                {item.label}
              </Link>
            );
          })}

          {/* ── قسم محمد طه ── */}
          <div className="pt-3 mt-2 border-t border-line space-y-0.5">
            {/* زر التوسّع */}
            <button
              onClick={() => setMtOpen(o => !o)}
              className={`w-full flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-all group text-right ${
                pathname.startsWith("/dashboard/purchases-review") || pathname.startsWith("/dashboard/suppliers")
                  ? "bg-amber/15 text-amber border border-amber/20"
                  : "text-muted hover:text-cream hover:bg-card-hi"
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-amber/20 flex items-center justify-center text-xs font-black text-amber flex-shrink-0">م</div>
              <div className="flex-1 text-right">
                <p className="text-sm font-bold">محمد طه</p>
                <p className="text-xs text-muted">المورد الرئيسي</p>
              </div>
              <span className={`text-[10px] text-muted transition-transform duration-200 ${mtOpen ? "rotate-90" : ""}`}>▶</span>
            </button>

            {/* القائمة الفرعية */}
            {mtOpen && (
              <div className="mr-4 border-r border-line/40 pr-2 space-y-0.5">
                <Link
                  href="/dashboard/purchases-review"
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-all ${
                    pathname.startsWith("/dashboard/purchases-review")
                      ? "bg-amber/10 text-amber"
                      : "text-muted hover:text-cream hover:bg-card-hi"
                  }`}
                >
                  <div>
                    <p className="font-medium text-xs">مراجعة المشتريات</p>
                    <p className="text-[10px] text-muted">فواتير الشراء الشهرية</p>
                  </div>
                </Link>
                <Link
                  href="/dashboard/mt-ledger"
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-all ${
                    pathname.startsWith("/dashboard/mt-ledger") || pathname.startsWith("/dashboard/suppliers/")
                      ? "bg-green/10 text-green"
                      : "text-muted hover:text-cream hover:bg-card-hi"
                  }`}
                >
                  <div>
                    <p className="font-medium text-xs">النظام المحاسبي</p>
                    <p className="text-[10px] text-muted">دفتر الأستاذ والحسابات</p>
                  </div>
                </Link>
              </div>
            )}

            {/* ── قسم المحصلين ── */}
            <Link
              href="/dashboard/collectors"
              className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all ${
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
        <div className="p-3 border-t border-line space-y-0.5">
          <Link
            href="/dashboard/settings/users"
            className={`w-full flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors text-right ${
              pathname.startsWith("/dashboard/settings/users")
                ? "bg-green/15 text-green border border-green/20"
                : "text-muted hover:text-cream hover:bg-card-hi"
            }`}
          >
            <span className="flex-shrink-0 opacity-80"><IconUsers /></span>
            إضافة مستخدم
          </Link>
          <button
            onClick={() => { setShowPinModal(true); setPinError(""); setPinSuccess(false); }}
            className="w-full flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-muted hover:text-cream hover:bg-card-hi transition-colors text-right"
          >
            <span className="flex-shrink-0 opacity-80"><IconKey /></span>
            تغيير رمز الدخول
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-red hover:bg-red/10 transition-colors text-right"
          >
            <span className="flex-shrink-0 opacity-80"><IconLogout /></span>
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
                    value={current} onChange={e => setCurrent(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                </div>
                <div>
                  <label className="text-muted text-sm block mb-1">الرمز الجديد (6 أرقام)</label>
                  <input type="password" inputMode="numeric" maxLength={6}
                    className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-cream focus:outline-none focus:border-green/50"
                    value={next1} onChange={e => setNext1(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                </div>
                <div>
                  <label className="text-muted text-sm block mb-1">تأكيد الرمز الجديد</label>
                  <input type="password" inputMode="numeric" maxLength={6}
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
