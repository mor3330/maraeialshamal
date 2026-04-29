// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  
  try {
    const body = await request.json();
    const branchId = body.branchId;
    const reportDate = body.reportDate;

    if (!branchId || !reportDate) {
      return NextResponse.json({ error: "branchId and reportDate required" }, { status: 400 });
    }

    // التحقق أن الفرع موجود ونشط
    const { data: branch, error: branchErr } = await supabase
      .from("branches")
      .select("id, is_active")
      .eq("id", branchId)
      .maybeSingle();

    if (branchErr || !branch) {
      const { data: branchBySlug } = await supabase
        .from("branches")
        .select("id, is_active")
        .eq("slug", body.branchSlug || "")
        .maybeSingle();

      if (!branchBySlug) {
        return NextResponse.json({ 
          error: `الفرع غير موجود. branchId: ${branchId}` 
        }, { status: 400 });
      }
      // التحقق من المزامنة بعد إيجاد الفرع بالـ slug
      if ((branchBySlug as any).is_active === false) {
        return NextResponse.json({
          error: "🔴 تم إيقاف المزامنة لهذا الفرع. تواصل مع الإدارة."
        }, { status: 403 });
      }
      body.branchId = (branchBySlug as any).id;
    } else if ((branch as any).is_active === false) {
      // الفرع موجود لكن مزامنته معطلة
      return NextResponse.json({
        error: "🔴 تم إيقاف المزامنة لهذا الفرع. تواصل مع الإدارة."
      }, { status: 403 });
    }

    const actualBranchId = body.branchId;

    // التحقق من وجود تقرير سابق
    const { data: existing } = await supabase
      .from("daily_reports" as any)
      .select("id")
      .eq("branch_id", actualBranchId)
      .eq("report_date", reportDate)
      .maybeSingle();

    // أداة تحويل القيم إلى أرقام
    const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

    // قراءة القيم من step named values كـ fallback
    const step2Named = body.step2Named || {};
    const step6Named = body.step6Named || {};

    // === استخراج المبيعات ===
    // الأولوية: 1) القيمة المباشرة في body 2) step2Named 
    const totalSales    = toN(body.totalSales) || toN(step2Named.total_sales);
    const invoiceCount  = toN(body.invoiceCount) || toN(step2Named.invoice_count);
    const returnsValue  = toN(body.returnsValue) || toN(step2Named.returns_value);
    const discountsValue = toN(body.discountsValue);

    // === استخراج الأموال ===
    // الأولوية: 1) من payments array 2) من القيم المباشرة 3) من step6Named
    const payments: Array<{ methodCode: string; amount: number }> = body.payments || [];
    const cashPayment    = toN(payments.find((p: any) => p.methodCode === "cash")?.amount)     || toN(body.cashActual) || toN(step6Named.cash_amount);
    const networkPayment = toN(payments.find((p: any) => p.methodCode === "network")?.amount)  || toN(step6Named.network_amount);
    const transferPayment = toN(payments.find((p: any) => p.methodCode === "transfer")?.amount) || toN(step6Named.transfer_amount);
    const deferredPayment = toN(payments.find((p: any) => p.methodCode === "deferred")?.amount) || toN(step6Named.deferred_amount);
    
    const expenseTotal   = (body.expenses || []).reduce((s: number, e: any) => s + toN(e.amount), 0);

    // === حساب الكاش ===
    // cashExpected = الكاش المتوقع في الصندوق (كاش - مصروفات)
    // cashActual = الكاش الفعلي المدخل من الكاشير
    // إذا كان body.cashExpected موجود (محسوب من ReviewWithShortage) نستخدمه
    // وإلا نحسبه: كاش - مصروفات
    const cashExpected = toN(body.cashExpected) !== 0 ? toN(body.cashExpected) : (cashPayment - expenseTotal);
    const cashActual   = toN(body.cashActual) !== 0 ? toN(body.cashActual) : cashPayment;

    // حفظ كل البيانات كـ JSON في notes
    const notesData: Record<string, any> = {
      payments: payments.length > 0 ? payments : [
        { methodCode: "cash", amount: cashPayment },
        { methodCode: "network", amount: networkPayment },
        { methodCode: "transfer", amount: transferPayment },
        { methodCode: "deferred", amount: deferredPayment },
      ].filter(p => p.amount > 0),
      meatSales: body.meatSales || [],
      inventory: body.inventory || [],
      expenses: body.expenses || [],
      returnsValue, discountsValue,
      cashier_notes: body.notes || null,
    };

    // حفظ بيانات الخطوات الكاملة في الملاحظات
    for (let i = 1; i <= 7; i++) {
      if (body[`step${i}Named`] && Object.keys(body[`step${i}Named`]).length > 0) {
        notesData[`step${i}Named`] = body[`step${i}Named`];
      }
      if (body[`step${i}Values`] && Object.keys(body[`step${i}Values`]).length > 0) {
        notesData[`step${i}Values`] = body[`step${i}Values`];
      }
    }

    // تسجيل البيانات للتشخيص
    console.log("=== [Submit] Report Data ===");
    console.log("[Submit] branchId:", actualBranchId, "reportDate:", reportDate);
    console.log("[Submit] totalSales:", totalSales, "(body:", body.totalSales, "step2Named:", step2Named.total_sales, ")");
    console.log("[Submit] cashPayment:", cashPayment, "cashExpected:", cashExpected, "cashActual:", cashActual);
    console.log("[Submit] expenseTotal:", expenseTotal);
    console.log("[Submit] step2Named present:", !!body.step2Named, "step6Named present:", !!body.step6Named);
    console.log("[Submit] all step named present:", [1,2,3,4,5,6,7].map(i => `step${i}Named:${!!body[`step${i}Named`]}`).join(", "));
    console.log("=== [Submit] End ===");

    // بيانات التقرير الأساسية في الأعمدة الحقيقية
    // ملاحظة: cash_difference هو GENERATED ALWAYS AS لا يُكتب يدوياً
    const reportData: any = {
      branch_id: actualBranchId,
      report_date: reportDate,
      total_sales: totalSales,
      invoice_count: invoiceCount || null,
      returns_value: returnsValue,
      cash_expected: cashExpected,
      cash_actual: cashActual,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      notes: JSON.stringify(notesData),
    };

    let reportId: string;

    if (existing) {
      const { data: updated, error } = await supabase
        .from("daily_reports" as any)
        .update(reportData as never)
        .eq("id", (existing as any).id)
        .select()
        .single();
      if (error) throw error;
      reportId = (updated as any).id;
    } else {
      const { data: created, error } = await supabase
        .from("daily_reports" as any)
        .insert(reportData as never)
        .select()
        .single();
      if (error) throw error;
      reportId = (created as any).id;
    }

    // حفظ المصروفات في جدول report_expenses
    if (body.expenses && body.expenses.length > 0) {
      await supabase.from("report_expenses" as any).delete().eq("report_id", reportId);
      
      const expenseRows = body.expenses.map((exp: any) => ({
        report_id: reportId,
        category: "general",
        description: exp.description,
        amount: exp.amount,
      }));
      await supabase.from("report_expenses" as any).insert(expenseRows as never);
    }

    // تحديث حالة طلب التقرير إذا كان موجوداً
    if (body.requestId) {
      await supabase
        .from("report_requests" as any)
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq("id", body.requestId);
    }

    return NextResponse.json({ success: true, reportId, message: "تم إرسال التقرير بنجاح" });

  } catch (err: any) {
    console.error("Submit error:", err);
    return NextResponse.json({ error: err.message || "حدث خطأ" }, { status: 500 });
  }
}
