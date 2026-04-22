"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Branch { id: string; name: string; slug: string; is_active: boolean; }
interface MeatData {
  incoming: { hashi: number; sheep: number; beef: number };
  sold: {
    hashi: { bone_weight: number; bone_price: number; clean_weight: number; clean_price: number };
    sheep: { weight: number; price: number };
    beef: { bone_weight: number; bone_price: number; clean_weight: number; clean_price: number };
  };
  exports?: { hashi: number; sheep: number; beef: number };
  waste?: { hashi: number; sheep: number; beef: number };
  remaining?: { hashi: number; sheep: number; beef: number };
  previous?: { hashi: number; sheep: number; beef: number };
}
interface PaymentMethods {
  cash: number;
  card: number;
  transfer: number;
  credit: number;
}
interface Report {
  id: string; branch_id: string; report_date: string;
  status: "draft" | "submitted" | "approved" | "flagged" | null;
  total_sales: number | null; cash_expected: number | null;
  cash_actual: number | null; cash_difference: number | null;
  submitted_at: string; meatData: MeatData | null;
  paymentMethods?: PaymentMethods | null;
}
interface DashData {
  todayISO: string; yesterdayISO: string; twoDaysAgoISO: string; todayLong: string;
  branches: Branch[]; reports: Report[];
  purchasesByDate: Record<string, { hashi: { weight: number; price: number }; sheep: { weight: number; price: number }; beef: { weight: number; price: number } }>;
}

const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmt = (v: number) => v.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/dashboard?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) { setError("تعذر تحميل البيانات"); return; }
      const json: DashData = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setError("");
      // اختر تلقائياً اليوم الذي فيه أكثر تقارير
      const dates = [json.yesterdayISO, json.twoDaysAgoISO, json.todayISO].filter(Boolean) as string[];
      const byDate = new Map<string, number>();
      json.reports.forEach(r => byDate.set(r.report_date, (byDate.get(r.report_date) ?? 0) + 1));
      const best = dates.find(d => (byDate.get(d) ?? 0) > 0) ?? json.yesterdayISO ?? json.todayISO ?? "";
      setSelectedDate(prev => prev || best); // لا تغير إذا المستخدم اختار يدوياً
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000); // كل دقيقة
    return () => clearInterval(interval);
  }, [load]);

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

  const { todayISO, yesterdayISO, twoDaysAgoISO, todayLong, branches = [], reports = [], purchasesByDate = {} } = data ?? {};
  const activeBranches = branches.filter(b => b.is_active);

  // الأيام المتاحة للتصفية — آخر 3 أيام مع عدد تقارير كل يوم
  const dateOptions = ([yesterdayISO, twoDaysAgoISO, todayISO].filter(Boolean) as string[])
    .map(d => ({ date: d, count: reports.filter(r => r.report_date === d).length }));
  const activeDate = selectedDate || dateOptions.find(d => d.count > 0)?.date || yesterdayISO || todayISO || "";

  const todaysReports = reports.filter(r => r.report_date === activeDate);
  const todaysReportsByBranch = new Map(todaysReports.map(r => [r.branch_id, r]));
  const missingBranches = activeBranches.filter(b => !todaysReportsByBranch.has(b.id));
  
  // حسابات اليوم
  const totalSalesToday = todaysReports.reduce((s, r) => s + toN(r.total_sales), 0);
  const totalCashToday = todaysReports.reduce((s, r) => s + toN(r.cash_actual), 0);
  
  // حساب المصروفات من notes
  let totalExpensesToday = 0;
  todaysReports.forEach(r => {
    if (r.meatData) {
      const expense = toN(r.cash_actual) - toN(r.cash_expected);
      if (expense > 0) totalExpensesToday += expense;
    }
  });

  // حساب اللحوم الإجمالية
  // السعر من purchasesByDate لليوم المحدد فقط
  const dayPurchases = purchasesByDate[activeDate] ?? {
    hashi: { weight: 0, price: 0 },
    sheep: { weight: 0, price: 0 },
    beef:  { weight: 0, price: 0 },
  };

  const meatTotals = {
    incoming: { hashi: 0, sheep: 0, beef: 0 },
    sold: {
      hashi: { weight: 0, price: 0 },
      sheep: { weight: 0, price: 0 },
      beef:  { weight: 0, price: 0 },
    },
  };

  todaysReports.forEach(r => {
    if (r.meatData) {
      meatTotals.incoming.hashi += r.meatData.incoming.hashi;
      meatTotals.incoming.sheep += r.meatData.incoming.sheep;
      meatTotals.incoming.beef  += r.meatData.incoming.beef;

      meatTotals.sold.hashi.weight += r.meatData.sold.hashi.bone_weight + r.meatData.sold.hashi.clean_weight;
      meatTotals.sold.hashi.price  += r.meatData.sold.hashi.bone_price  + r.meatData.sold.hashi.clean_price;
      meatTotals.sold.sheep.weight += r.meatData.sold.sheep.weight;
      meatTotals.sold.sheep.price  += r.meatData.sold.sheep.price;
      meatTotals.sold.beef.weight  += r.meatData.sold.beef.bone_weight  + r.meatData.sold.beef.clean_weight;
      meatTotals.sold.beef.price   += r.meatData.sold.beef.bone_price   + r.meatData.sold.beef.clean_price;
    }
  });

  // التنبيهات
  const alerts: Array<{ type: "warning" | "error"; text: string }> = [];
  if (missingBranches.length > 0) {
    missingBranches.forEach(b => {
      alerts.push({ type: "warning", text: `${b.name} لم يرسل تقريره بعد!` });
    });
  }

  // العجوزات (Shortages) - تطبيق المعادلة الصحيحة
  const shortages: Array<{ branchName: string; type: string; amount: number; unit: string }> = [];
  todaysReports.forEach(r => {
    const branch = branches.find(b => b.id === r.branch_id);
    
    if (r.meatData) {
      // المعادلة: رصيد أمس + وارد اليوم - المبيعات - الصادر - المخلفات = المفروض يتبقى
      // العجز = المتبقي الفعلي - المفروض يتبقى
      
      // حاشي
      const hashiPrevious = toN(r.meatData.previous?.hashi);
      const hashiIncoming = toN(r.meatData.incoming?.hashi);
      const hashiSold = toN(r.meatData.sold?.hashi?.bone_weight) + toN(r.meatData.sold?.hashi?.clean_weight);
      const hashiExport = toN(r.meatData.exports?.hashi);
      const hashiWaste = toN(r.meatData.waste?.hashi);
      const hashiRemaining = toN(r.meatData.remaining?.hashi);
      
      const hashiExpected = hashiPrevious + hashiIncoming - hashiSold - hashiExport - hashiWaste;
      const hashiShortage = hashiRemaining - hashiExpected;
      
      if (Math.abs(hashiShortage) > 4) {
        shortages.push({ 
          branchName: branch?.name || "فرع", 
          type: "حاشي", 
          amount: hashiShortage, 
          unit: "كجم" 
        });
      }
      
      // غنم
      const sheepPrevious = toN(r.meatData.previous?.sheep);
      const sheepIncoming = toN(r.meatData.incoming?.sheep);
      const sheepSold = toN(r.meatData.sold?.sheep?.weight);
      const sheepExport = toN(r.meatData.exports?.sheep);
      const sheepWaste = toN(r.meatData.waste?.sheep);
      const sheepRemaining = toN(r.meatData.remaining?.sheep);
      
      const sheepExpected = sheepPrevious + sheepIncoming - sheepSold - sheepExport - sheepWaste;
      const sheepShortage = sheepRemaining - sheepExpected;
      
      if (Math.abs(sheepShortage) > 3) {
        shortages.push({ 
          branchName: branch?.name || "فرع", 
          type: "غنم", 
          amount: sheepShortage, 
          unit: "كجم" 
        });
      }
      
      // عجل
      const beefPrevious = toN(r.meatData.previous?.beef);
      const beefIncoming = toN(r.meatData.incoming?.beef);
      const beefSold = toN(r.meatData.sold?.beef?.bone_weight) + toN(r.meatData.sold?.beef?.clean_weight);
      const beefExport = toN(r.meatData.exports?.beef);
      const beefWaste = toN(r.meatData.waste?.beef);
      const beefRemaining = toN(r.meatData.remaining?.beef);
      
      const beefExpected = beefPrevious + beefIncoming - beefSold - beefExport - beefWaste;
      const beefShortage = beefRemaining - beefExpected;
      
      if (Math.abs(beefShortage) > 4) {
        shortages.push({ 
          branchName: branch?.name || "فرع", 
          type: "عجل", 
          amount: beefShortage, 
          unit: "كجم" 
        });
      }
    }
    
    // عجز الكاش = المبيعات - إجمالي الصندوق (كاش + شبكة + تحويل + آجل)
    // لا نعرضه إذا كان الصندوق مطابقاً (الفرق < 1 ريال)
    if (r.paymentMethods) {
      const totalPayments = toN(r.paymentMethods.cash) + toN(r.paymentMethods.card) 
                          + toN(r.paymentMethods.transfer) + toN(r.paymentMethods.credit);
      const cashShortage = toN(r.total_sales) - totalPayments;
      
      // فقط نعرض إذا كان هناك عجز حقيقي >= 1 ريال
      if (Math.abs(cashShortage) >= 1) {
        shortages.push({ 
          branchName: branch?.name || "فرع", 
          type: "كاش", 
          amount: cashShortage, 
          unit: "ر" 
        });
        alerts.push({ 
          type: "error", 
          text: `${branch?.name || "فرع"}: عجز كاش ${fmt(Math.abs(cashShortage))} ر`
        });
      }
    } else {
      console.log(`[${branch?.name}] paymentMethods غير موجود!`, r);
    }
  });

  return (
    <div className="min-h-screen bg-bg text-cream">
      <div className="absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(circle_at_top,_rgba(63,166,106,0.12),_transparent_50%)] pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="rounded-[32px] border border-line bg-card/95 backdrop-blur p-6 sm:p-8 mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/10 px-3 py-1 text-xs text-green mb-3">
                <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
                Marai Alshamal Admin
              </div>
              <h1 className="text-3xl sm:text-4xl font-black">لوحة الإدارة</h1>
              <p className="text-muted mt-2 text-sm">{todayLong}</p>
              {/* تبديل التاريخ */}
              <div className="flex gap-2 mt-3">
                {dateOptions.map(({ date, count }) => (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                      activeDate === date
                        ? "bg-green text-white"
                        : "border border-line bg-card-hi text-muted hover:text-cream"
                    }`}
                  >
                    {date === yesterdayISO ? "أمس" : date === todayISO ? "اليوم" : "قبل أمس"}
                    {count > 0 && <span className="mr-1 opacity-70">({count})</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <p className="text-muted text-xs">
                  آخر تحديث: {lastUpdated.toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              )}
              
              {/* Bell Icon for Alerts */}
              <div className="relative">
                <button 
                  onClick={() => setShowAlerts(!showAlerts)}
                  className="relative rounded-2xl border border-line bg-card-hi px-4 py-2 text-muted hover:text-cream hover:border-green/30 transition-all"
                >
                  <span className="text-lg">🔔</span>
                  {alerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red text-white text-xs flex items-center justify-center font-bold">
                      {alerts.length}
                    </span>
                  )}
                </button>
                
                {/* Alerts Dropdown */}
                {showAlerts && alerts.length > 0 && (
                  <div className="absolute left-0 top-full mt-2 w-80 rounded-2xl border border-line bg-card shadow-2xl z-50 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-line">
                      <p className="font-bold text-sm">التنبيهات ({alerts.length})</p>
                    </div>
                    <div className="p-2">
                      {alerts.map((alert, i) => (
                        <div key={i} className={`rounded-xl p-3 mb-2 text-sm ${alert.type === "error" ? "bg-red/10 text-red" : "bg-amber/10 text-amber"}`}>
                          {alert.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <button onClick={load} className="rounded-2xl border border-line bg-card-hi px-4 py-2 text-sm text-muted hover:text-cream hover:border-green/30 transition-all">
                ↻ تحديث
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded-2xl border border-red/20 bg-red/10 px-4 py-3 text-sm text-red">{error}</div>
          )}
        </div>

        {/* KPIs */}
        <div className="grid gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4">
          <KPICard 
            label="التقارير المستلمة" 
            value={`${todaysReports.length}/${activeBranches.length}`} 
            color={missingBranches.length === 0 && activeBranches.length > 0 ? "green" : "amber"}
          />
          <KPICard 
            label="إجمالي المبيعات" 
            value={fmt(totalSalesToday)} 
            unit="ر"
            color="blue"
          />
          <KPICard 
            label="الكاش"
            value={fmt(totalCashToday)}
            unit="ر"
            color="green"
          />
          <KPICard 
            label="المصروفات" 
            value={fmt(totalExpensesToday)} 
            unit="ر"
            color="red"
          />
        </div>

        {/* Meat Summary */}
        <section className="rounded-[28px] border border-line bg-card p-6 mb-6">
          <h2 className="text-2xl font-black mb-6">ملخص اللحوم اليومي</h2>
          
          <div className="grid gap-4 lg:grid-cols-3">
            <MeatCard
              title="حاشي"
              incoming={{ weight: dayPurchases.hashi.weight, price: dayPurchases.hashi.price }}
              sold={{ weight: meatTotals.sold.hashi.weight, price: meatTotals.sold.hashi.price }}
            />
            <MeatCard
              title="غنم"
              incoming={{ weight: dayPurchases.sheep.weight, price: dayPurchases.sheep.price }}
              sold={{ weight: meatTotals.sold.sheep.weight, price: meatTotals.sold.sheep.price }}
            />
            <MeatCard
              title="عجل"
              incoming={{ weight: dayPurchases.beef.weight, price: dayPurchases.beef.price }}
              sold={{ weight: meatTotals.sold.beef.weight, price: meatTotals.sold.beef.price }}
            />
          </div>
        </section>

        {/* Branch Status */}
        <section className="rounded-[28px] border border-line bg-card p-6 mb-6">
          <h2 className="text-2xl font-black mb-6">حالة الفروع</h2>
          
          {branches.length === 0 ? (
            <div className="rounded-2xl border border-line bg-card-hi p-5 text-muted text-sm text-center">
              لا توجد فروع. <Link href="/dashboard/branches" className="text-green hover:underline">أضف فروعاً</Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {branches.map(branch => {
                const report = todaysReportsByBranch.get(branch.id);
                // الكاش الفعلي (بدون خصم المصروفات)
                const actualCash = report ? toN(report.cash_actual) : 0;
                const hasCash = report && Math.abs(actualCash) >= 0.01;
                return (
                  <button
                    key={branch.id}
                    onClick={() => router.push(`/branch/${branch.slug}`)}
                    className={`text-right rounded-2xl border p-4 transition-all hover:scale-[1.02] ${
                      !branch.is_active
                        ? "border-line/30 bg-card-hi/50 opacity-50"
                        : report
                          ? "border-green/20 bg-green/10"
                          : "border-line bg-card-hi"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-bold text-cream text-lg">{branch.name}</p>
                        <p className="text-xs text-muted mt-1">
                          {!branch.is_active ? "غير نشط 🔴" : report ? "مرفوع ✓" : "بانتظار ⏳"}
                        </p>
                      </div>
                    </div>
                    
                    {report && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-bg/60 border border-line p-3">
                            <p className="text-muted text-xs">المبيعات</p>
                            <p className="font-bold text-lg ltr-num" dir="ltr">{fmt(toN(report.total_sales))} <span className="text-xs">ر</span></p>
                          </div>
                          <div className="rounded-xl bg-bg/60 border border-line p-3">
                            <p className="text-muted text-xs">المشتريات</p>
                            <p className="text-muted text-sm">قريباً</p>
                          </div>
                        </div>
                        {hasCash && (
                          <div className="rounded-xl bg-green/20 border border-green/30 p-3">
                            <p className="text-green text-xs">الكاش</p>
                            <p className="font-bold text-green text-lg ltr-num" dir="ltr">{fmt(actualCash)} <span className="text-xs">ر</span></p>
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* العجوزات (Shortages) */}
        {shortages.length > 0 && (
          <section className="rounded-[28px] border border-amber/20 bg-amber/10 p-6">
            <h2 className="text-2xl font-black mb-6 text-amber">العجوزات</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shortages.map((shortage, i) => (
                <div key={i} className="rounded-2xl border border-amber/30 bg-card p-4">
                  <p className="text-sm text-muted mb-2">{shortage.branchName}</p>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-amber">{shortage.type}</p>
                    <p className="text-2xl font-black text-amber ltr-num" dir="ltr">
                      {shortage.amount > 0 ? "+" : ""}{fmt(shortage.amount)} 
                      <span className="text-sm mr-1">{shortage.unit}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── قسم محمد طه (مسؤول المشتريات) ── */}
        <section className="rounded-[28px] border border-amber/30 bg-gradient-to-l from-amber/5 to-transparent p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber/20 border border-amber/30 flex items-center justify-center">
                <span className="text-2xl font-black text-amber">م</span>
              </div>
              <div>
                <h2 className="text-xl font-black text-cream">محمد طه</h2>
                <p className="text-muted text-sm">مسؤول المشتريات</p>
              </div>
            </div>
            <Link
              href="/dashboard/purchases-review"
              className="flex items-center gap-3 bg-amber text-black rounded-2xl px-6 py-3 font-black hover:bg-amber/90 transition-all"
            >
              <span>📊</span>
              مراجعة المشتريات
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-card-hi border border-line p-4">
              <p className="text-muted text-xs mb-1">📅 هذا الشهر</p>
              <p className="text-cream font-bold text-sm">إجمالي مشتريات جميع الفروع</p>
              <p className="text-muted text-xs mt-1">مفصّلة حسب الصنف والفرع</p>
            </div>
            <div className="rounded-2xl bg-card-hi border border-line p-4">
              <p className="text-muted text-xs mb-1">🏪 الفروع</p>
              <p className="text-cream font-bold text-sm">كل فرع بمشترياته</p>
              <p className="text-muted text-xs mt-1">عدد + كيلو + سعر لكل صنف</p>
            </div>
            <div className="rounded-2xl bg-card-hi border border-line p-4">
              <p className="text-muted text-xs mb-1">🐑 الغنم</p>
              <p className="text-cream font-bold text-sm">تفصيل 8 أصناف</p>
              <p className="text-muted text-xs mt-1">سواكني · حري · نعيمي · خروف · روماني · رفيدي · تيس</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function KPICard({ label, value, unit, color }: { label: string; value: string; unit?: string; color: "green" | "amber" | "blue" | "red" }) {
  const colorClasses = {
    green: "border-green/20 bg-green/10",
    amber: "border-amber/20 bg-amber/10",
    blue: "border-sky-500/20 bg-sky-500/10",
    red: "border-red/20 bg-red/10",
  };
  
  return (
    <div className={`rounded-3xl border p-6 ${colorClasses[color]}`}>
      <p className="text-muted text-sm font-medium mb-4">{label}</p>
      <p className="text-4xl font-black text-cream ltr-num" dir="ltr">
        {value}
        {unit && <span className="text-xl text-muted mr-1">{unit}</span>}
      </p>
    </div>
  );
}

function MeatCard({ title, incoming, sold }: {
  title: string;
  incoming: { weight: number; price: number };
  sold: { weight: number; price: number };
}) {
  return (
    <div className="rounded-2xl border border-line bg-card-hi p-5">
      <h3 className="text-xl font-bold mb-4">{title}</h3>

      <div className="space-y-3">
        {/* Incoming */}
        <div className="rounded-xl border border-line bg-bg/60 p-4">
          <p className="text-muted text-xs mb-2">الوارد</p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-cream ltr-num" dir="ltr">{fmt(incoming.weight)}</p>
              <p className="text-xs text-muted">كجم</p>
            </div>
            <div className="text-left">
              <p className="text-xs text-muted/60">السعر</p>
              {incoming.price > 0
                ? <><p className="text-lg font-bold text-amber ltr-num" dir="ltr">{fmt(incoming.price)}</p><p className="text-xs text-amber/70">ريال</p></>
                : <p className="text-sm text-muted">—</p>
              }
            </div>
          </div>
        </div>
        
        {/* Sold */}
        <div className="rounded-xl border border-green/20 bg-green/10 p-4">
          <p className="text-green text-xs mb-2">المباع</p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-green ltr-num" dir="ltr">{fmt(sold.weight)}</p>
              <p className="text-xs text-green/80">كجم</p>
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-green ltr-num" dir="ltr">{fmt(sold.price)}</p>
              <p className="text-xs text-green/80">ريال</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
