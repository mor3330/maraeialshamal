"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Buyer    { id: string; name: string; phone?: string; }
interface Sale {
  id: string;
  buyer_id:    string | null;
  supplier_id: string | null;
  item_type_id: string;
  quantity:    number;
  weight:      number;
  price:       number;
  sale_date:   string;
  notes?:      string;
  buyers?:     { name: string; phone?: string } | null;
  suppliers?:  { name: string } | null;
  item_types?: { name: string } | null;
}

const toN = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmt = (v: number, dec = 2) =>
  v.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: dec });

function fmtDate(d: string) {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: "Asia/Riyadh",
    }).format(new Date(d + "T12:00:00"));
  } catch { return d; }
}

function PrintContent() {
  const params = useSearchParams();
  const dateParam = params.get("date") ?? new Date().toISOString().split("T")[0];

  const [sales, setSales]   = useState<Sale[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName] = useState("مراعي الشمال");

  useEffect(() => {
    Promise.all([
      fetch(`/api/external-sales?date=${dateParam}`).then(r => r.json()),
      fetch("/api/buyers").then(r => r.json()),
    ]).then(([sData, bData]) => {
      setSales(sData.sales ?? []);
      setBuyers(bData.buyers ?? []);
    }).finally(() => setLoading(false));
  }, [dateParam]);

  // تجميع حسب المشترٍ
  const byBuyer: Record<string, Sale[]> = {};
  sales.forEach(s => {
    const key = s.buyer_id ?? "__none__";
    if (!byBuyer[key]) byBuyer[key] = [];
    byBuyer[key].push(s);
  });

  const totalQty    = sales.reduce((a, s) => a + toN(s.quantity), 0);
  const totalWeight = sales.reduce((a, s) => a + toN(s.weight),   0);
  const totalPrice  = sales.reduce((a, s) => a + toN(s.price),    0);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-500">جاري التحميل...</p>
    </div>
  );

  return (
    <div dir="rtl" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", color: "#111", backgroundColor: "#fff", minHeight: "100vh", padding: "24px" }}>
      {/* ── شريط الطباعة (لا يظهر عند الطباعة) ── */}
      <div className="print:hidden mb-6 flex gap-3 items-center flex-wrap">
        <button
          onClick={() => window.print()}
          style={{ background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 12, padding: "10px 24px", fontWeight: "bold", fontSize: 15, cursor: "pointer" }}
        >
          🖨️ طباعة التقرير
        </button>
        <button
          onClick={() => window.history.back()}
          style={{ background: "#f0f0f0", color: "#333", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: "bold", fontSize: 15, cursor: "pointer" }}
        >
          ← رجوع
        </button>
        <span style={{ color: "#666", fontSize: 14 }}>تقرير المبيعات الخارجية · {fmtDate(dateParam)}</span>
      </div>

      {/* ── رأس التقرير ── */}
      <div style={{ borderBottom: "3px solid #2d6a4f", paddingBottom: 16, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, color: "#1a3c2f" }}>{companyName}</h1>
          <p style={{ fontSize: 13, color: "#555", margin: "4px 0 0" }}>تقرير المبيعات الخارجية</p>
        </div>
        <div style={{ textAlign: "left" }}>
          <p style={{ fontSize: 13, color: "#555", margin: 0 }}>التاريخ</p>
          <p style={{ fontSize: 15, fontWeight: "bold", margin: "2px 0 0" }}>{fmtDate(dateParam)}</p>
          <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0", direction: "ltr" }}>{dateParam}</p>
        </div>
      </div>

      {/* ── ملخص سريع ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "إجمالي العدد",  val: fmt(totalQty, 0),    unit: "رأس",  color: "#0077cc" },
          { label: "إجمالي الوزن", val: fmt(totalWeight, 2), unit: "كجم",  color: "#005f40" },
          { label: "إجمالي القيمة",val: fmt(totalPrice, 2),  unit: "ر.س", color: "#b45309" },
        ].map(item => (
          <div key={item.label} style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "#777", margin: "0 0 6px" }}>{item.label}</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: item.color, margin: 0, direction: "ltr" }}>
              {item.val} <span style={{ fontSize: 13, fontWeight: "normal", color: "#555" }}>{item.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* ── جداول حسب المشترٍ ── */}
      {Object.entries(byBuyer).map(([key, bSales]) => {
        const buyer = key === "__none__" ? null : (buyers.find(b => b.id === key) ?? bSales[0]?.buyers);
        const buyerName = (buyer as any)?.name ?? "بدون مشترٍ";
        const buyerPhone = (buyer as any)?.phone;
        const bTotal = bSales.reduce((a, s) => a + toN(s.price), 0);
        const bWeight = bSales.reduce((a, s) => a + toN(s.weight), 0);
        const bQty   = bSales.reduce((a, s) => a + toN(s.quantity), 0);

        return (
          <div key={key} style={{ marginBottom: 28, pageBreakInside: "avoid" }}>
            {/* رأس المشترٍ */}
            <div style={{ background: "#1a3c2f", color: "#fff", borderRadius: "8px 8px 0 0", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontWeight: "bold", fontSize: 15 }}>{buyerName}</span>
                {buyerPhone && <span style={{ fontSize: 12, marginRight: 10, opacity: 0.8, direction: "ltr" }}>{buyerPhone}</span>}
              </div>
              <span style={{ fontWeight: "bold", fontSize: 14, direction: "ltr" }}>
                {fmt(bTotal)} ر.س
              </span>
            </div>

            {/* جدول */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f0f7f4", borderBottom: "2px solid #d1e9de" }}>
                  <th style={{ padding: "8px 12px", textAlign: "right", color: "#555", fontWeight: 600 }}>المورد</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", color: "#555", fontWeight: 600 }}>النوع</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", color: "#555", fontWeight: 600 }}>العدد</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", color: "#555", fontWeight: 600 }}>الوزن (كجم)</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", color: "#555", fontWeight: 600 }}>السعر (ر.س)</th>
                </tr>
              </thead>
              <tbody>
                {bSales.map((s, idx) => (
                  <tr key={s.id} style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "8px 12px", color: "#666" }}>{s.suppliers?.name ?? "—"}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{s.item_types?.name ?? "—"}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", direction: "ltr", fontWeight: 700, color: "#0077cc" }}>{fmt(s.quantity, 0)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", direction: "ltr", fontWeight: 700, color: "#005f40" }}>{fmt(s.weight)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", direction: "ltr", fontWeight: 700, color: "#b45309" }}>{fmt(s.price)}</td>
                  </tr>
                ))}
                {/* صف الإجمالي */}
                <tr style={{ background: "#e8f5ee", borderTop: "2px solid #a8d5ba" }}>
                  <td colSpan={2} style={{ padding: "8px 12px", fontWeight: 800, color: "#1a3c2f", fontSize: 13 }}>إجمالي {buyerName}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800, color: "#0077cc", direction: "ltr" }}>{fmt(bQty, 0)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800, color: "#005f40", direction: "ltr" }}>{fmt(bWeight)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800, color: "#b45309", direction: "ltr" }}>{fmt(bTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {/* ── صف لا يوجد بيانات ── */}
      {sales.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#888" }}>
          <p style={{ fontSize: 18 }}>لا توجد مبيعات خارجية لهذا اليوم</p>
        </div>
      )}

      {/* ── الإجمالي الكلي ── */}
      {sales.length > 0 && (
        <div style={{ borderTop: "3px double #2d6a4f", paddingTop: 16, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 900, color: "#1a3c2f", margin: 0 }}>الإجمالي الكلي</p>
          <div style={{ display: "flex", gap: 32 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "#777", margin: "0 0 2px" }}>إجمالي العدد</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#0077cc", margin: 0, direction: "ltr" }}>{fmt(totalQty, 0)} <span style={{ fontSize: 12 }}>رأس</span></p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "#777", margin: "0 0 2px" }}>إجمالي الوزن</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#005f40", margin: 0, direction: "ltr" }}>{fmt(totalWeight)} <span style={{ fontSize: 12 }}>كجم</span></p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "#777", margin: "0 0 2px" }}>إجمالي القيمة</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#b45309", margin: 0, direction: "ltr" }}>{fmt(totalPrice)} <span style={{ fontSize: 12 }}>ر.س</span></p>
            </div>
          </div>
        </div>
      )}

      {/* ── ذيل الصفحة ── */}
      <div style={{ marginTop: 40, borderTop: "1px solid #e5e5e5", paddingTop: 12, display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: 11 }}>
        <span>{companyName} · تقرير المبيعات الخارجية</span>
        <span>طُبع في: {new Date().toLocaleString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh" })}</span>
      </div>

      <style>{`
        @media print {
          @page { margin: 15mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export default function ExternalSalesPrintPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><p>جاري التحميل...</p></div>}>
      <PrintContent />
    </Suspense>
  );
}
