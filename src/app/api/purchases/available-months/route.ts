// @ts-nocheck
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("purchases")
    .select("purchase_date")
    .order("purchase_date", { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // استخراج الشهور الفريدة (YYYY-MM)
  const monthsSet = new Set<string>();
  (data ?? []).forEach((row: any) => {
    if (row.purchase_date) {
      const ym = row.purchase_date.substring(0, 7); // YYYY-MM
      monthsSet.add(ym);
    }
  });

  const months = Array.from(monthsSet).sort().reverse(); // من الأحدث

  // تجميع حسب السنة
  const byYear: Record<string, string[]> = {};
  months.forEach(m => {
    const y = m.split("-")[0];
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(m);
  });

  return NextResponse.json({
    months,
    byYear,
    years: Object.keys(byYear).sort().reverse(),
  });
}
