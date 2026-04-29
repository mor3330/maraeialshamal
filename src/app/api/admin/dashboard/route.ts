import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function getRiyadhDates() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  const pad = (n: number) => String(n).padStart(2, "0");
  const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  const two  = new Date(now); two.setDate(two.getDate() - 2);
  const todayLong = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date());
  return { today: toISO(now), yesterday: toISO(yest), twoDaysAgo: toISO(two), todayLong };
}

const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function parseNotes(raw: string | null): any {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function GET() {
  const supabase = createServiceClient();
  const { today, yesterday, twoDaysAgo, todayLong } = getRiyadhDates();

  const [branchesRes, reportsRes, purchasesRes, itemTypesRes] = await Promise.all([
    supabase.from("branches").select("id, name, slug, is_active").order("name"),
    // جلب الأعمدة المحسوبة فقط + notes للتحليل، بدون limit لأن الفروع محدودة (<50)
    supabase.from("daily_reports")
      .select("id, branch_id, report_date, status, total_sales, cash_expected, cash_actual, cash_difference, submitted_at, notes")
      .gte("report_date", twoDaysAgo)
      .order("report_date", { ascending: false })
      .order("submitted_at", { ascending: false }),
    supabase.from("purchases")
      .select("item_type_id, purchase_date, weight, price, quantity")
      .gte("purchase_date", twoDaysAgo),
    supabase.from("item_types").select("id, name, name_en, meat_category").eq("is_active", true),
  ]);

  if (branchesRes.error) return NextResponse.json({ error: branchesRes.error.message }, { status: 500 });
  if (reportsRes.error)  return NextResponse.json({ error: reportsRes.error.message  }, { status: 500 });

  // ── تصنيف item_types ──
  // الأولوية: meat_category من قاعدة البيانات (المُحدَّد يدوياً)
  // الاحتياط: تطابق الاسم (للأصناف القديمة قبل إضافة العمود)
  const SHEEP_NAMES = ["سواكني","نعيمي","رفيدي","تيس","روماني","خروف","حري","غنم"];
  const OFFAL_NAMES = ["مخلفات","كبدة","كراعين","راس","معاصيب","كرشة"];
  const itemCatMap: Record<string, "hashi"|"sheep"|"beef"|"offal"> = {};
  (itemTypesRes.data ?? []).forEach((it: any) => {
    // ── 1. استخدم meat_category إذا كانت مُعيَّنة ──
    if (it.meat_category && ["hashi","sheep","beef","offal"].includes(it.meat_category)) {
      itemCatMap[it.id] = it.meat_category;
      return;
    }
    // ── 2. احتياط: تطابق الاسم العربي/الإنجليزي ──
    const ar = (it.name ?? "").trim();
    const en = (it.name_en ?? "").toLowerCase().trim();
    let cat: "hashi"|"sheep"|"beef"|"offal"|null = null;
    if (ar.includes("حاشي")) cat = "hashi";
    else if (SHEEP_NAMES.some(n => ar.includes(n))) cat = "sheep";
    else if (ar.includes("عجل") || ar === "لحم" || ar.startsWith("لحم ") || (ar.includes("بقر") && !ar.includes("كبدة") && !ar.includes("راس") && !ar.includes("كراعين"))) cat = "beef";
    else if (OFFAL_NAMES.some(n => ar.includes(n))) cat = "offal";
    else if (en === "hashi") cat = "hashi";
    else if (en === "sheep") cat = "sheep";
    else if (en === "beef")  cat = "beef";
    else if (en === "offal") cat = "offal";
    if (cat) itemCatMap[it.id] = cat;
  });

  // ── مشتريات مجمّعة حسب (date × category) ──
  const purchasesByDate: Record<string, Record<"hashi"|"sheep"|"beef", { weight: number; price: number; quantity: number }>> = {};
  (purchasesRes.data ?? []).forEach((p: any) => {
    const cat = itemCatMap[p.item_type_id];
    if (!cat || cat === "offal") return;
    const d = (p.purchase_date ?? "").substring(0, 10);
    if (!purchasesByDate[d]) purchasesByDate[d] = {
      hashi: { weight: 0, price: 0, quantity: 0 },
      sheep: { weight: 0, price: 0, quantity: 0 },
      beef:  { weight: 0, price: 0, quantity: 0 },
    };
    purchasesByDate[d][cat].weight   += toN(p.weight);
    purchasesByDate[d][cat].price    += toN(p.price);
    purchasesByDate[d][cat].quantity += toN(p.quantity);
  });

  // ── معالجة التقارير: parse notes مرة واحدة فقط ──
  const enrichedReports = (reportsRes.data ?? []).map((report: any) => {
    // parse مرة واحدة فقط
    const notesObj = parseNotes(report.notes);

    // إصلاح total_sales إذا كان فارغاً
    let totalSales = toN(report.total_sales);
    if (!totalSales && notesObj) {
      totalSales = toN(notesObj.step2Named?.total_sales);
      if (!totalSales && notesObj.step3Named) {
        const s3 = notesObj.step3Named;
        totalSales = toN(s3.hashi_bone_price) + toN(s3.hashi_clean_price)
                   + toN(s3.sheep_price) + toN(s3.beef_bone_price)
                   + toN(s3.beef_clean_price) + toN(s3.offal_total_price);
      }
    }

    // إصلاح الكاش إذا كان فارغاً
    let cashExpected = toN(report.cash_expected);
    let cashActual   = toN(report.cash_actual);
    if (!cashActual && notesObj) {
      const step6 = notesObj.step6Named;
      const expenseTotal = (notesObj.expenses ?? []).reduce((s: number, e: any) => s + toN(e.amount), 0);
      if (step6?.cash_amount && toN(step6.cash_amount) > 0) {
        cashActual   = toN(step6.cash_amount);
        cashExpected = cashActual - expenseTotal;
      } else {
        const cashPay = notesObj.payments?.find((p: any) => p.methodCode === "cash");
        if (cashPay && toN(cashPay.amount) > 0) {
          cashActual   = toN(cashPay.amount);
          cashExpected = cashActual - expenseTotal;
        }
      }
    }

    const cashDiff = cashActual - cashExpected;

    // بيانات اللحوم
    // ── مرن: step3Named يكفي (step1Named اختياري) ──
    let meatData = null;
    if (notesObj?.step3Named || notesObj?.step1Named) {
      const s1 = notesObj.step1Named ?? {};
      const s3 = notesObj.step3Named ?? {};
      const s4 = notesObj.step4Named ?? {};
      const s5 = notesObj.step5Named ?? {};

      // حاشي المباع: نجرب bone+clean أولاً ثم الإجمالي fallback
      const hashiBW  = toN(s3.hashi_bone_weight) + toN(s3.hashi_clean_weight);
      const hashiBP  = toN(s3.hashi_bone_price)  + toN(s3.hashi_clean_price);
      const hashiSoldW = hashiBW > 0 ? hashiBW : toN(s3.hashi_weight);
      const hashiSoldP = hashiBP > 0 ? hashiBP : toN(s3.hashi_price);

      // عجل المباع: نجرب bone+clean أولاً ثم الإجمالي fallback
      const beefBW   = toN(s3.beef_bone_weight) + toN(s3.beef_clean_weight);
      const beefBP   = toN(s3.beef_bone_price)  + toN(s3.beef_clean_price);
      const beefSoldW = beefBW > 0 ? beefBW : toN(s3.beef_weight);
      const beefSoldP = beefBP > 0 ? beefBP : toN(s3.beef_price);

      meatData = {
        incoming: {
          hashi: toN(s1.hashi_weight),
          sheep: toN(s1.sheep_weight),
          beef:  toN(s1.beef_weight),
        },
        sold: {
          hashi: {
            bone_weight:  toN(s3.hashi_bone_weight),
            bone_price:   toN(s3.hashi_bone_price),
            clean_weight: toN(s3.hashi_clean_weight),
            clean_price:  toN(s3.hashi_clean_price),
            // الإجمالي المرن (يُستخدم في ملخص الداشبورد)
            total_weight: hashiSoldW,
            total_price:  hashiSoldP,
          },
          sheep: { weight: toN(s3.sheep_weight), price: toN(s3.sheep_price) },
          beef:  {
            bone_weight:  toN(s3.beef_bone_weight),
            bone_price:   toN(s3.beef_bone_price),
            clean_weight: toN(s3.beef_clean_weight),
            clean_price:  toN(s3.beef_clean_price),
            total_weight: beefSoldW,
            total_price:  beefSoldP,
          },
        },
        exports:   { hashi: toN(s4.hashi_export),    sheep: toN(s4.sheep_export),    beef: toN(s4.beef_export) },
        waste:     { hashi: toN(s4.hashi_waste),     sheep: toN(s4.sheep_waste),     beef: toN(s4.beef_waste) },
        remaining: { hashi: toN(s5.hashi_remaining), sheep: toN(s5.sheep_remaining), beef: toN(s5.beef_remaining) },
        previous:  notesObj.previousBalance ?? { hashi: 0, sheep: 0, beef: 0 },
      };
    }

    // طرق الدفع
    let paymentMethods = null;
    if (notesObj?.payments?.length) {
      const pm = notesObj.payments;
      paymentMethods = {
        cash:     toN(pm.find((p: any) => p.methodCode === "cash")?.amount),
        card:     toN(pm.find((p: any) => p.methodCode === "card" || p.methodCode === "network")?.amount),
        transfer: toN(pm.find((p: any) => p.methodCode === "transfer" || p.methodCode === "bank_transfer")?.amount),
        credit:   toN(pm.find((p: any) => p.methodCode === "credit"  || p.methodCode === "deferred")?.amount),
      };
    }

    // إعادة البيانات بدون notes (توفير حجم الاستجابة)
    return {
      id: report.id,
      branch_id: report.branch_id,
      report_date: report.report_date,
      status: report.status,
      total_sales: totalSales,
      cash_expected: cashExpected,
      cash_actual: cashActual,
      cash_difference: cashDiff,
      submitted_at: report.submitted_at,
      meatData,
      paymentMethods,
    };
  });

  return NextResponse.json(
    { todayISO: today, yesterdayISO: yesterday, twoDaysAgoISO: twoDaysAgo, todayLong, branches: branchesRes.data ?? [], reports: enrichedReports, purchasesByDate },
    { headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } }
  );
}
