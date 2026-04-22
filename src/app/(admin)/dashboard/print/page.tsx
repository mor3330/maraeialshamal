"use client";

import { useState, useRef, useCallback } from "react";

/* ─── helpers ─── */
const toN = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmt = (v: number, dec = 0) =>
  v.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: dec, maximumFractionDigits: dec === 0 ? 2 : dec });
const fmtDate = (d: string) =>
  new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${d}T00:00:00`));

function getDefaultRange() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  const day = now.getDay();
  const sun = new Date(now); sun.setDate(now.getDate() - day);
  const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
  const pad = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: pad(sun), to: pad(sat) };
}

/* ─── Types ─── */
type ReportType = "profit" | "sales" | "purchases" | "external-sales" | "exports" | "waste-comparison";

interface CategoryData {
  purchaseQty: number; purchaseWeight: number; purchaseValue: number;
  prevWeight: number; prevValue: number;
  totalCostWeight: number; totalCostValue: number; costPerKg: number;
  salesWeight: number; salesValue: number;
  outgoingWeight: number; outgoingValue: number;
  wasteWeight: number; remainingWeight: number; remainingValue: number;
  profit: number; weightBalance: number;
}
interface OffalData { purchaseValue: number; salesValue: number; remainingValue: number; profit: number; }
interface BranchData {
  branchId: string; branchName: string;
  hashi: CategoryData; sheep: CategoryData; beef: CategoryData; offal: OffalData;
  totalProfit: number;
}
interface GroupSummary { qty: number; weight: number; price: number; }
interface ProfitSummary {
  totalPurchaseValue: number; totalSalesValue: number; totalProfit: number;
  byCategory: {
    hashi: { purchaseWeight: number; purchaseValue: number; salesWeight: number; salesValue: number; remainingWeight: number; remainingValue: number; profit: number };
    sheep: { purchaseWeight: number; purchaseValue: number; salesWeight: number; salesValue: number; remainingWeight: number; remainingValue: number; profit: number };
    beef:  { purchaseWeight: number; purchaseValue: number; salesWeight: number; salesValue: number; remainingWeight: number; remainingValue: number; profit: number };
    offal: { purchaseValue: number; salesValue: number; profit: number };
  };
  purchaseGroupSummary: { hashi: GroupSummary; sheep: GroupSummary; beef: GroupSummary; offal: GroupSummary };
}
interface ProfitData { branches: BranchData[]; summary: ProfitSummary; }

/* ══════════════════════════════════════════
   Step Indicator
══════════════════════════════════════════ */
function StepIndicator({ current }: { current: number }) {
  const steps = ["اختر التقرير", "حدد الفترة", "معاينة وطباعة"];
  return (
    <div className="flex items-center mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current; const active = idx === current;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black transition-all
                ${done ? "bg-green text-white" : active ? "bg-green/20 border-2 border-green text-green" : "bg-card-hi border border-line text-muted"}`}>
                {done ? "✓" : idx}
              </div>
              <span className={`text-xs whitespace-nowrap ${active ? "text-green font-medium" : done ? "text-cream" : "text-muted"}`}>{label}</span>
            </div>
            {i < steps.length - 1 && <div className={`h-px flex-1 mx-2 mb-5 ${done ? "bg-green/50" : "bg-line"}`} />}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════
   Report Type Card
══════════════════════════════════════════ */
function ReportCard({ type, title, desc, active, onClick }: {
  type: ReportType; title: string; desc: string; active: boolean; onClick: () => void;
}) {
  const c: Record<ReportType, string> = {
    profit:            "border-green/40 bg-green/10 text-green",
    sales:             "border-sky-500/40 bg-sky-500/10 text-sky-300",
    purchases:         "border-amber/40 bg-amber/10 text-amber",
    "external-sales":  "border-purple-500/40 bg-purple-500/10 text-purple-300",
    exports:           "border-orange-500/40 bg-orange-500/10 text-orange-300",
    "waste-comparison":"border-rose-500/40 bg-rose-500/10 text-rose-300",
  };
  return (
    <button onClick={onClick}
      className={`relative w-full rounded-[28px] border-2 p-6 text-right transition-all hover:scale-[1.02] active:scale-[0.98]
        ${active ? c : "border-line bg-card hover:bg-card-hi"}`}>
      {active && (
        <span className="absolute top-4 left-4 w-5 h-5 rounded-full bg-green flex items-center justify-center">
          <span className="text-[10px] text-white font-black">✓</span>
        </span>
      )}
      <p className={`text-xl font-black mb-1 ${active ? "" : "text-cream"}`}>{title}</p>
      <p className="text-muted text-sm leading-relaxed">{desc}</p>
    </button>
  );
}

/* ══════════════════════════════════════════
   Period Presets
══════════════════════════════════════════ */
function PeriodPresets({ onSelect, selected }: { onSelect: (r: { from: string; to: string }) => void; selected: { from: string; to: string } }) {
  const now = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  const pad = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const presets = [
    { label: "اليوم", get: () => { const d = now(); const s = pad(d); return { from: s, to: s }; } },
    { label: "أمس", get: () => { const d = now(); d.setDate(d.getDate() - 1); const s = pad(d); return { from: s, to: s }; } },
    { label: "هذا الأسبوع", get: () => { const d = now(); const s = new Date(d); s.setDate(d.getDate() - d.getDay()); const e = new Date(s); e.setDate(s.getDate() + 6); return { from: pad(s), to: pad(e) }; } },
    { label: "الأسبوع الماضي", get: () => { const d = now(); const s = new Date(d); s.setDate(d.getDate() - d.getDay() - 7); const e = new Date(s); e.setDate(s.getDate() + 6); return { from: pad(s), to: pad(e) }; } },
    { label: "هذا الشهر", get: () => { const d = now(); return { from: pad(new Date(d.getFullYear(), d.getMonth(), 1)), to: pad(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }; } },
    { label: "الشهر الماضي", get: () => { const d = now(); return { from: pad(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: pad(new Date(d.getFullYear(), d.getMonth(), 0)) }; } },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map(p => {
        const r = p.get();
        const isActive = r.from === selected.from && r.to === selected.to;
        return (
          <button key={p.label} onClick={() => onSelect(r)}
            className={`rounded-xl px-4 py-2 text-sm transition-all
              ${isActive ? "bg-green text-white" : "border border-line bg-card-hi text-muted hover:text-cream hover:border-green/30"}`}>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════
   Print: صافي الربح
══════════════════════════════════════════ */
function ProfitReportPrint({ data, range }: { data: ProfitData; range: { from: string; to: string } }) {
  const { summary, branches } = data;
  const catLabel = { hashi: "حاشي", sheep: "غنم", beef: "عجل", offal: "مخلفات" };

  const profit = toN(summary.totalProfit);
  const isPositive = profit >= 0;

  return (
    <div className="text-gray-900 font-[Readex_Pro,Tajawal,sans-serif]" dir="rtl">

      {/* ── KPIs الكبيرة ── */}
      <div className="kpi-grid grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="text-amber-600 text-xs font-medium mb-1">إجمالي المشتريات</p>
          <p className="text-3xl font-black text-amber-700 ltr-num" dir="ltr">{fmt(toN(summary.totalPurchaseValue))}</p>
          <p className="text-amber-500 text-xs mt-1">ريال</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-center">
          <p className="text-sky-600 text-xs font-medium mb-1">إجمالي المبيعات</p>
          <p className="text-3xl font-black text-sky-700 ltr-num" dir="ltr">{fmt(toN(summary.totalSalesValue))}</p>
          <p className="text-sky-500 text-xs mt-1">ريال</p>
        </div>
        <div className={`rounded-2xl border p-5 text-center ${isPositive ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <p className={`text-xs font-medium mb-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>صافي الربح</p>
          <p className={`text-3xl font-black ltr-num ${isPositive ? "text-green-700" : "text-red-700"}`} dir="ltr">
            {isPositive ? "+" : ""}{fmt(profit)}
          </p>
          <p className={`text-xs mt-1 ${isPositive ? "text-green-500" : "text-red-500"}`}>ريال</p>
        </div>
      </div>

      {/* ── ملخص حسب الصنف ── */}
      <div className="summary-block rounded-2xl border border-gray-200 overflow-hidden mb-6">
        <div className="section-header bg-[#1a2420] text-white px-5 py-3 flex items-center gap-2">
          
          <h2 className="font-black text-sm">صافي الربح حسب الصنف</h2>
        </div>
        <div className="overflow-x-auto">
        <table style={{width:"100%", tableLayout:"fixed", minWidth:"unset", fontSize:"13px", borderCollapse:"collapse"}} dir="ltr">
          <colgroup>
            <col style={{width:"80px"}}/>
            <col style={{width:"80px"}}/>
            <col style={{width:"90px"}}/>
            <col style={{width:"80px"}}/>
            <col style={{width:"90px"}}/>
            <col style={{width:"80px"}}/>
            <col style={{width:"90px"}}/>
            <col style={{width:"110px"}}/>
          </colgroup>
          <thead>
            <tr style={{borderBottom:"2px solid #e5e7eb"}}>
              <th style={{padding:"4px 5px", textAlign:"right", background:"#f9fafb", borderRight:"1px solid #e5e7eb"}} rowSpan={2}>الصنف</th>
              <th style={{padding:"4px 5px", textAlign:"center", background:"#fffbeb", color:"#92400e", borderRight:"1px solid #fde68a"}} colSpan={2}>المشتريات</th>
              <th style={{padding:"4px 5px", textAlign:"center", background:"#f0f9ff", color:"#075985", borderRight:"1px solid #bae6fd"}} colSpan={2}>المبيعات</th>
              <th style={{padding:"4px 5px", textAlign:"center", background:"#f3f4f6", color:"#374151", borderRight:"1px solid #e5e7eb"}} colSpan={2}>المتبقي</th>
              <th style={{padding:"4px 5px", textAlign:"center", background:"#f0fdf4", color:"#166534"}} rowSpan={2}>صافي الربح</th>
            </tr>
            <tr style={{borderBottom:"2px solid #d1d5db", fontSize:"11px"}}>
              <th style={{padding:"5px 4px", textAlign:"center", background:"#fffbeb", color:"#b45309"}}>كجم</th>
              <th style={{padding:"5px 4px", textAlign:"center", background:"#fffbeb", color:"#92400e", fontWeight:700, borderRight:"1px solid #fde68a"}}>ريال</th>
              <th style={{padding:"5px 4px", textAlign:"center", background:"#f0f9ff", color:"#0369a1"}}>كجم</th>
              <th style={{padding:"5px 4px", textAlign:"center", background:"#f0f9ff", color:"#075985", fontWeight:700, borderRight:"1px solid #bae6fd"}}>ريال</th>
              <th style={{padding:"5px 4px", textAlign:"center", background:"#f3f4f6", color:"#6b7280"}}>كجم</th>
              <th style={{padding:"5px 4px", textAlign:"center", background:"#f3f4f6", color:"#374151", fontWeight:700, borderRight:"1px solid #e5e7eb"}}>ريال</th>
            </tr>
          </thead>
          <tbody>
            {(["hashi", "sheep", "beef"] as const).map((cat, i) => {
              const c = summary.byCategory[cat];
              const p = toN(c.profit);
              return (
                <tr key={cat} style={{borderBottom:"1px solid #f3f4f6", background: i%2===0?"#fff":"#fafafa"}}>
                  <td style={{padding:"10px 8px", fontWeight:700, color:"#1f2937", textAlign:"right", borderRight:"1px solid #e5e7eb"}}>{catLabel[cat]}</td>
                  <td style={{padding:"10px 6px", textAlign:"center", color:"#b45309"}}>{fmt(toN(c.purchaseWeight))}</td>
                  <td style={{padding:"10px 6px", textAlign:"center", color:"#92400e", fontWeight:700, borderRight:"1px solid #fde68a"}}>{fmt(toN(c.purchaseValue))}</td>
                  <td style={{padding:"10px 6px", textAlign:"center", color:"#0369a1"}}>{fmt(toN(c.salesWeight))}</td>
                  <td style={{padding:"10px 6px", textAlign:"center", color:"#075985", fontWeight:700, borderRight:"1px solid #bae6fd"}}>{fmt(toN(c.salesValue))}</td>
                  <td style={{padding:"10px 6px", textAlign:"center", color:"#6b7280"}}>{fmt(toN(c.remainingWeight))}</td>
                  <td style={{padding:"10px 6px", textAlign:"center", color:"#374151", borderRight:"1px solid #e5e7eb"}}>{fmt(toN(c.remainingValue))}</td>
                  <td style={{padding:"10px 6px", textAlign:"center", fontWeight:800, fontSize:"14px", color: p>=0?"#15803d":"#dc2626", background: p>=0?"#f0fdf4":"#fef2f2"}}>
                    {p>=0?"+":""}{fmt(p)}
                  </td>
                </tr>
              );
            })}
            <tr style={{borderBottom:"1px solid #e5e7eb", background:"#f9fafb"}}>
              <td style={{padding:"10px 8px", fontWeight:700, color:"#6b7280", textAlign:"right", borderRight:"1px solid #e5e7eb"}}>مخلفات</td>
              <td style={{padding:"10px 6px", textAlign:"center", color:"#d1d5db", fontSize:"11px"}}>—</td>
              <td style={{padding:"10px 6px", textAlign:"center", color:"#92400e", fontWeight:700, borderRight:"1px solid #fde68a"}}>{fmt(toN(summary.byCategory.offal.purchaseValue))}</td>
              <td style={{padding:"10px 6px", textAlign:"center", color:"#d1d5db", fontSize:"11px"}} colSpan={2}>—</td>
              <td style={{padding:"10px 6px", textAlign:"center", color:"#d1d5db", fontSize:"11px"}} colSpan={2}>—</td>
              <td style={{padding:"10px 6px", textAlign:"center", fontWeight:700, color:"#9ca3af"}}>0</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style={{background:"#1a2420", color:"#fff", fontWeight:700}}>
              <td style={{padding:"10px 8px", fontWeight:800, textAlign:"right", borderRight:"1px solid rgba(255,255,255,0.1)"}}>الإجمالي</td>
              <td style={{padding:"10px 6px", textAlign:"center", color:"#fde68a"}}>{fmt((["hashi","sheep","beef"] as const).reduce((s,c)=>s+toN(summary.byCategory[c].purchaseWeight),0))}</td>
              <td style={{padding:"10px 6px", textAlign:"center", color:"#fcd34d", fontWeight:800, borderRight:"1px solid rgba(255,255,255,0.1)"}}>{fmt(toN(summary.totalPurchaseValue))}</td>
              <td style={{padding:"10px 6px", textAlign:"center", color:"#bae6fd"}}>{fmt((["hashi","sheep","beef"] as const).reduce((s,c)=>s+toN(summary.byCategory[c].salesWeight),0))}</td>
              <td style={{padding:"10px 6px", textAlign:"center", color:"#7dd3fc", fontWeight:800, borderRight:"1px solid rgba(255,255,255,0.1)"}}>{fmt(toN(summary.totalSalesValue))}</td>
              <td style={{padding:"10px 6px", textAlign:"center", color:"#9ca3af"}}>{fmt((["hashi","sheep","beef"] as const).reduce((s,c)=>s+toN(summary.byCategory[c].remainingWeight),0))}</td>
              <td style={{padding:"10px 6px", textAlign:"center", color:"#d1d5db", borderRight:"1px solid rgba(255,255,255,0.1)"}}>{fmt((["hashi","sheep","beef"] as const).reduce((s,c)=>s+toN(summary.byCategory[c].remainingValue),0))}</td>
              <td style={{padding:"10px 6px", textAlign:"center", fontWeight:800, fontSize:"14px", color: profit>=0?"#86efac":"#fca5a5"}}>
                {profit>=0?"+":""}{fmt(profit)}
              </td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>

      {/* ── إجمالي المشتريات ── */}
      <div className="summary-block rounded-2xl border border-gray-200 overflow-hidden mb-6">
        <div className="section-header bg-amber-700 text-white px-5 py-3 flex items-center gap-2">
          
          <h2 className="font-black text-sm">إجمالي المشتريات</h2>
        </div>
        <table style={{width:"100%", tableLayout:"fixed", fontSize:"13px", borderCollapse:"collapse"}} dir="ltr">
          <colgroup>
            <col style={{width:"35%"}}/>
            <col style={{width:"20%"}}/>
            <col style={{width:"22%"}}/>
            <col style={{width:"23%"}}/>
          </colgroup>
          <thead style={{borderBottom:"2px solid #fde68a"}}>
            <tr style={{background:"#fffbeb", color:"#92400e", fontSize:"12px", fontWeight:700}}>
              <th style={{padding:"10px 12px", textAlign:"right", borderRight:"1px solid #fde68a"}}>الصنف</th>
              <th style={{padding:"10px 8px", textAlign:"center"}}>العدد</th>
              <th style={{padding:"10px 8px", textAlign:"center", borderRight:"1px solid #fde68a"}}>الوزن (كجم)</th>
              <th style={{padding:"10px 8px", textAlign:"center"}}>الإجمالي (ريال)</th>
            </tr>
          </thead>
          <tbody>
            {(["hashi","sheep","beef"] as const).map((cat,i) => {
              const g = summary.purchaseGroupSummary[cat];
              return (
                <tr key={cat} style={{borderBottom:"1px solid #f3f4f6", background: i%2===0?"#fff":"#fffdf5"}}>
                  <td style={{padding:"10px 12px", fontWeight:700, color:"#1f2937", textAlign:"right", borderRight:"1px solid #e5e7eb"}}>{catLabel[cat]}</td>
                  <td style={{padding:"10px 8px", textAlign:"center", color:"#374151", fontWeight:600}}>{fmt(toN(g.qty))}</td>
                  <td style={{padding:"10px 8px", textAlign:"center", color:"#0369a1", fontWeight:700, borderRight:"1px solid #e5e7eb"}}>{fmt(toN(g.weight))}</td>
                  <td style={{padding:"10px 8px", textAlign:"center", color:"#92400e", fontWeight:800, fontSize:"14px"}}>{fmt(toN(g.price))}</td>
                </tr>
              );
            })}
            <tr style={{borderBottom:"1px solid #e5e7eb", background:"#f9fafb"}}>
              <td style={{padding:"10px 12px", fontWeight:700, color:"#6b7280", textAlign:"right", borderRight:"1px solid #e5e7eb"}}>مخلفات</td>
              <td style={{padding:"10px 8px", textAlign:"center", color:"#374151"}}>{fmt(toN(summary.purchaseGroupSummary.offal.qty))}</td>
              <td style={{padding:"10px 8px", textAlign:"center", color:"#d1d5db", fontSize:"11px", borderRight:"1px solid #e5e7eb"}}>—</td>
              <td style={{padding:"10px 8px", textAlign:"center", color:"#92400e", fontWeight:700}}>{fmt(toN(summary.purchaseGroupSummary.offal.price))}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style={{background:"#b45309", color:"#fff", fontWeight:700}}>
              <td style={{padding:"10px 12px", fontWeight:800, textAlign:"right", borderRight:"1px solid rgba(255,255,255,0.2)"}}>الإجمالي</td>
              <td style={{padding:"10px 8px", textAlign:"center"}}>{fmt((["hashi","sheep","beef","offal"] as const).reduce((s,c)=>s+toN(summary.purchaseGroupSummary[c].qty),0))}</td>
              <td style={{padding:"10px 8px", textAlign:"center", color:"#bae6fd", fontWeight:800, borderRight:"1px solid rgba(255,255,255,0.2)"}}>{fmt((["hashi","sheep","beef"] as const).reduce((s,c)=>s+toN(summary.purchaseGroupSummary[c].weight),0))} كجم</td>
              <td style={{padding:"10px 8px", textAlign:"center", fontWeight:800, fontSize:"14px"}}>{fmt(toN(summary.totalPurchaseValue))} ر</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── تفصيل الفروع ── */}
      <div className="section-header rounded-2xl border border-gray-200 overflow-hidden mb-3">
        <div className="bg-[#0f1511] text-white px-5 py-3 flex items-center gap-2">
          
          <h2 className="font-black text-sm">تفصيل الفروع</h2>
        </div>
      </div>

      <div className="branches-grid">
      {branches.map((branch) => (
        <div key={branch.branchId} className="branch-block rounded-2xl border border-gray-200 overflow-hidden mb-4">
          {/* رأس الفرع */}
          <div className="branch-header flex items-center justify-between px-5 py-3 bg-[#1a2420] text-white" dir="rtl">
            <div className="flex items-center gap-2">
              
              <span className="font-black text-base">{branch.branchName}</span>
            </div>
            <div className={`text-lg font-black ${toN(branch.totalProfit)>=0?"text-green-300":"text-red-300"}`}>
              {toN(branch.totalProfit)>=0?"+":""}{fmt(toN(branch.totalProfit))} ر
            </div>
          </div>

          {/* جدول الأصناف */}
          <div className="overflow-x-auto">
          <table style={{width:"100%", tableLayout:"fixed", minWidth:"unset", fontSize:"12px", borderCollapse:"collapse"}} dir="ltr">
            <colgroup>
              <col style={{width:"75px"}}/>
              <col style={{width:"75px"}}/>
              <col style={{width:"85px"}}/>
              <col style={{width:"75px"}}/>
              <col style={{width:"85px"}}/>
              <col style={{width:"75px"}}/>
              <col style={{width:"85px"}}/>
              <col style={{width:"95px"}}/>
            </colgroup>
            <thead>
              <tr style={{borderBottom:"2px solid #d1d5db", fontSize:"10px", fontWeight:700}}>
                <th style={{padding:"5px 5px", textAlign:"right", background:"#f9fafb", borderRight:"1px solid #e5e7eb"}}>الصنف</th>
                <th style={{padding:"5px 3px", textAlign:"center", background:"#fffbeb", color:"#b45309"}}><div>مش</div><div style={{fontSize:"9px", opacity:0.7}}>كجم</div></th>
                <th style={{padding:"5px 3px", textAlign:"center", background:"#fffbeb", color:"#92400e", borderRight:"1px solid #fde68a"}}><div>مش</div><div style={{fontSize:"9px", opacity:0.7}}>ريال</div></th>
                <th style={{padding:"5px 3px", textAlign:"center", background:"#f0f9ff", color:"#0369a1"}}><div>مب</div><div style={{fontSize:"9px", opacity:0.7}}>كجم</div></th>
                <th style={{padding:"5px 3px", textAlign:"center", background:"#f0f9ff", color:"#075985", borderRight:"1px solid #bae6fd"}}><div>مب</div><div style={{fontSize:"9px", opacity:0.7}}>ريال</div></th>
                <th style={{padding:"5px 3px", textAlign:"center", background:"#f3f4f6", color:"#6b7280"}}><div>متب</div><div style={{fontSize:"9px", opacity:0.7}}>كجم</div></th>
                <th style={{padding:"5px 3px", textAlign:"center", background:"#f3f4f6", color:"#374151", borderRight:"1px solid #e5e7eb"}}><div>متب</div><div style={{fontSize:"9px", opacity:0.7}}>ريال</div></th>
                <th style={{padding:"5px 3px", textAlign:"center", background:"#f0fdf4", color:"#166534"}}>الربح</th>
              </tr>
            </thead>
            <tbody>
              {(["hashi","sheep","beef"] as const).map((cat,i) => {
                const c = branch[cat] as CategoryData;
                const p = toN(c.profit);
                const deficient = Math.abs(toN(c.weightBalance)) > 0.5;
                return (
                  <tr key={cat} style={{borderBottom:"1px solid #f3f4f6", background: i%2===0?"#fff":"#fafafa"}}>
                    <td style={{padding:"4px 5px", textAlign:"right", borderRight:"1px solid #e5e7eb"}}>
                      <div style={{fontWeight:700, color:"#1f2937"}}>{catLabel[cat]}</div>
                      {deficient && (
                        <div style={{fontSize:"9px", marginTop:"2px", fontWeight:600, color: toN(c.weightBalance)<0?"#ef4444":"#16a34a"}}>
                          {toN(c.weightBalance)>0?"زيادة +":"عجز "}{fmt(Math.abs(toN(c.weightBalance)))} كجم
                        </div>
                      )}
                    </td>
                    <td style={{padding:"4px 4px", textAlign:"center", color:"#b45309"}}>{fmt(toN(c.totalCostWeight))}</td>
                    <td style={{padding:"4px 4px", textAlign:"center", color:"#92400e", fontWeight:700, borderRight:"1px solid #fde68a"}}>{fmt(toN(c.totalCostValue))}</td>
                    <td style={{padding:"4px 4px", textAlign:"center", color:"#0369a1"}}>{fmt(toN(c.salesWeight))}</td>
                    <td style={{padding:"4px 4px", textAlign:"center", color:"#075985", fontWeight:700, borderRight:"1px solid #bae6fd"}}>{fmt(toN(c.salesValue))}</td>
                    <td style={{padding:"4px 4px", textAlign:"center", color:"#6b7280"}}>{fmt(toN(c.remainingWeight))}</td>
                    <td style={{padding:"4px 4px", textAlign:"center", color:"#374151", borderRight:"1px solid #e5e7eb"}}>{fmt(toN(c.remainingValue))}</td>
                    <td style={{padding:"4px 4px", textAlign:"center", fontWeight:800, color: p>=0?"#15803d":"#dc2626", background: p>=0?"#f0fdf4":"#fef2f2"}}>
                      {p>=0?"+":""}{fmt(p)}
                    </td>
                  </tr>
                );
              })}
              <tr style={{borderBottom:"1px solid #e5e7eb", background:"#f9fafb"}}>
                <td style={{padding:"4px 5px", fontWeight:700, color:"#9ca3af", textAlign:"right", borderRight:"1px solid #e5e7eb"}}>مخلفات</td>
                <td style={{padding:"4px 4px", textAlign:"center", color:"#d1d5db", fontSize:"10px"}}>—</td>
                <td style={{padding:"4px 4px", textAlign:"center", color:"#92400e", fontWeight:700, borderRight:"1px solid #fde68a"}}>{fmt(toN(branch.offal.purchaseValue))}</td>
                <td style={{padding:"4px 4px", textAlign:"center", color:"#d1d5db", fontSize:"10px"}} colSpan={2}>—</td>
                <td style={{padding:"4px 4px", textAlign:"center", color:"#d1d5db", fontSize:"10px"}} colSpan={2}>—</td>
                <td style={{padding:"4px 4px", textAlign:"center", fontWeight:700, color:"#9ca3af"}}>0</td>
              </tr>
            </tbody>
            <tfoot>
              <tr style={{background:"#1a2420", color:"#fff", fontWeight:700, fontSize:"11px"}}>
                <td style={{padding:"4px 5px", fontWeight:800, textAlign:"right", borderRight:"1px solid rgba(255,255,255,0.1)"}}>إجمالي</td>
                <td style={{padding:"4px 4px", textAlign:"center", color:"#fde68a"}}>{fmt(toN(branch.hashi.totalCostWeight)+toN(branch.sheep.totalCostWeight)+toN(branch.beef.totalCostWeight))}</td>
                <td style={{padding:"4px 4px", textAlign:"center", color:"#fcd34d", fontWeight:800, borderRight:"1px solid rgba(255,255,255,0.1)"}}>{fmt(toN(branch.hashi.totalCostValue)+toN(branch.sheep.totalCostValue)+toN(branch.beef.totalCostValue)+toN(branch.offal.purchaseValue))}</td>
                <td style={{padding:"4px 4px", textAlign:"center", color:"#bae6fd"}}>{fmt(toN(branch.hashi.salesWeight)+toN(branch.sheep.salesWeight)+toN(branch.beef.salesWeight))}</td>
                <td style={{padding:"4px 4px", textAlign:"center", color:"#7dd3fc", fontWeight:800, borderRight:"1px solid rgba(255,255,255,0.1)"}}>{fmt(toN(branch.hashi.salesValue)+toN(branch.sheep.salesValue)+toN(branch.beef.salesValue))}</td>
                <td style={{padding:"4px 4px", textAlign:"center", color:"#9ca3af"}}>{fmt(toN(branch.hashi.remainingWeight)+toN(branch.sheep.remainingWeight)+toN(branch.beef.remainingWeight))}</td>
                <td style={{padding:"4px 4px", textAlign:"center", color:"#d1d5db", borderRight:"1px solid rgba(255,255,255,0.1)"}}>{fmt(toN(branch.hashi.remainingValue)+toN(branch.sheep.remainingValue)+toN(branch.beef.remainingValue))}</td>
                <td style={{padding:"4px 4px", textAlign:"center", fontWeight:800, fontSize:"13px", color: toN(branch.totalProfit)>=0?"#86efac":"#fca5a5"}}>
                  {toN(branch.totalProfit)>=0?"+":""}{fmt(toN(branch.totalProfit))} ر
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Print: تقرير المبيعات
══════════════════════════════════════════ */
interface SalesBranch {
  branchId: string; branchName: string;
  cash: number; network: number; transfer: number; deferred: number;
  total: number; expenses: number; reportCount: number;
}
interface SalesSummary { cash: number; network: number; transfer: number; deferred: number; total: number; expenses: number; }
interface SalesData { branches: SalesBranch[]; summary: SalesSummary; }

function SalesReportPrint({ data }: { data: SalesData }) {
  const { branches, summary } = data;
  const activeBranches = branches.filter(b => b.reportCount > 0);

  const cols = [
    { key: "network",  label: "شبكة",        color: "#075985", bg: "#f0f9ff", border: "#bae6fd" },
    { key: "cash",     label: "كاش",          color: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
    { key: "transfer", label: "تحويل بنكي",   color: "#6b21a8", bg: "#faf5ff", border: "#e9d5ff" },
    { key: "deferred", label: "آجل",          color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
  ] as const;

  return (
    <div className="text-gray-900 font-[Readex_Pro,Tajawal,sans-serif]" dir="rtl">

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-center">
          <p className="text-sky-600 text-xs font-medium mb-1">إجمالي المبيعات</p>
          <p className="text-3xl font-black text-sky-700" dir="ltr">{fmt(toN(summary.total))}</p>
          <p className="text-sky-500 text-xs mt-1">ريال</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
          <p className="text-red-600 text-xs font-medium mb-1">إجمالي المصروفات</p>
          <p className="text-3xl font-black text-red-700" dir="ltr">{fmt(toN(summary.expenses))}</p>
          <p className="text-red-500 text-xs mt-1">ريال</p>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
          <p className="text-green-600 text-xs font-medium mb-1">صافي الكاش</p>
          <p className="text-3xl font-black text-green-700" dir="ltr">{fmt(toN(summary.total) - toN(summary.expenses))}</p>
          <p className="text-green-500 text-xs mt-1">ريال</p>
        </div>
      </div>

      {/* طرق الدفع الإجمالية */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {cols.map(c => (
          <div key={c.key} style={{borderRadius:"16px", border:`1px solid ${c.border}`, background:c.bg, padding:"16px", textAlign:"center"}}>
            <p style={{color:c.color, fontSize:"11px", fontWeight:600, marginBottom:"4px"}}>{c.label}</p>
            <p style={{color:c.color, fontSize:"22px", fontWeight:800}} dir="ltr">{fmt(toN(summary[c.key]))}</p>
            <p style={{color:c.color, fontSize:"10px", opacity:0.7, marginTop:"2px"}}>ريال</p>
          </div>
        ))}
      </div>

      {/* جدول الفروع */}
      <div className="rounded-2xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-[#1a2420] text-white px-5 py-3 flex items-center gap-2">
          
          <h2 className="font-black text-sm">تفصيل المبيعات حسب الفرع</h2>
        </div>
        <div className="overflow-x-auto">
          <table style={{width:"100%", tableLayout:"fixed", minWidth:"unset", fontSize:"13px", borderCollapse:"collapse"}} dir="ltr">
            <colgroup>
              <col style={{width:"20%"}}/>
              <col style={{width:"13%"}}/>
              <col style={{width:"13%"}}/>
              <col style={{width:"13%"}}/>
              <col style={{width:"13%"}}/>
              <col style={{width:"14%"}}/>
              <col style={{width:"14%"}}/>
            </colgroup>
            <thead>
              <tr style={{background:"#f9fafb", borderBottom:"2px solid #e5e7eb", fontSize:"12px", fontWeight:700}}>
                <th style={{padding:"10px 12px", textAlign:"right", borderRight:"1px solid #e5e7eb"}}>الفرع</th>
                <th style={{padding:"10px 8px", textAlign:"center", color:"#075985", background:"#f0f9ff", borderRight:"1px solid #bae6fd"}}>شبكة</th>
                <th style={{padding:"10px 8px", textAlign:"center", color:"#166534", background:"#f0fdf4", borderRight:"1px solid #bbf7d0"}}>كاش</th>
                <th style={{padding:"10px 8px", textAlign:"center", color:"#6b21a8", background:"#faf5ff", borderRight:"1px solid #e9d5ff"}}>تحويل</th>
                <th style={{padding:"10px 8px", textAlign:"center", color:"#92400e", background:"#fffbeb", borderRight:"1px solid #fde68a"}}>آجل</th>
                <th style={{padding:"10px 8px", textAlign:"center", color:"#1f2937", background:"#f3f4f6", borderRight:"1px solid #e5e7eb"}}>الإجمالي</th>
                <th style={{padding:"10px 8px", textAlign:"center", color:"#dc2626", background:"#fef2f2"}}>المصروفات</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b, i) => (
                <tr key={b.branchId} style={{borderBottom:"1px solid #f3f4f6", background: i%2===0?"#fff":"#fafafa",
                  opacity: b.reportCount === 0 ? 0.4 : 1}}>
                  <td style={{padding:"10px 12px", fontWeight:700, color:"#1f2937", textAlign:"right", borderRight:"1px solid #e5e7eb"}}>
                    <div>{b.branchName}</div>
                    {b.reportCount === 0 && <div style={{fontSize:"10px", color:"#9ca3af", marginTop:"2px"}}>لا يوجد تقرير</div>}
                  </td>
                  <td style={{padding:"10px 8px", textAlign:"center", color:"#075985", fontWeight:600, background:"#f0f9ff22", borderRight:"1px solid #e5e7eb"}}>{b.network > 0 ? fmt(b.network) : "—"}</td>
                  <td style={{padding:"10px 8px", textAlign:"center", color:"#166534", fontWeight:600, background:"#f0fdf422", borderRight:"1px solid #e5e7eb"}}>{b.cash > 0 ? fmt(b.cash) : "—"}</td>
                  <td style={{padding:"10px 8px", textAlign:"center", color:"#6b21a8", fontWeight:600, background:"#faf5ff22", borderRight:"1px solid #e5e7eb"}}>{b.transfer > 0 ? fmt(b.transfer) : "—"}</td>
                  <td style={{padding:"10px 8px", textAlign:"center", color:"#92400e", fontWeight:600, background:"#fffbeb22", borderRight:"1px solid #e5e7eb"}}>{b.deferred > 0 ? fmt(b.deferred) : "—"}</td>
                  <td style={{padding:"10px 8px", textAlign:"center", color:"#1f2937", fontWeight:800, fontSize:"14px", borderRight:"1px solid #e5e7eb"}}>{b.total > 0 ? fmt(b.total) : "—"}</td>
                  <td style={{padding:"10px 8px", textAlign:"center", color:"#dc2626", fontWeight:600}}>{b.expenses > 0 ? fmt(b.expenses) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{background:"#1a2420", color:"#fff", fontWeight:700}}>
                <td style={{padding:"11px 12px", fontWeight:800, textAlign:"right", borderRight:"1px solid rgba(255,255,255,0.1)"}}>
                  الإجمالي
                  <span style={{fontSize:"10px", color:"#8a9690", marginRight:"8px"}}>({activeBranches.length} فرع)</span>
                </td>
                <td style={{padding:"11px 8px", textAlign:"center", color:"#7dd3fc", borderRight:"1px solid rgba(255,255,255,0.1)"}}>{fmt(summary.network)}</td>
                <td style={{padding:"11px 8px", textAlign:"center", color:"#86efac", borderRight:"1px solid rgba(255,255,255,0.1)"}}>{fmt(summary.cash)}</td>
                <td style={{padding:"11px 8px", textAlign:"center", color:"#d8b4fe", borderRight:"1px solid rgba(255,255,255,0.1)"}}>{fmt(summary.transfer)}</td>
                <td style={{padding:"11px 8px", textAlign:"center", color:"#fde68a", borderRight:"1px solid rgba(255,255,255,0.1)"}}>{fmt(summary.deferred)}</td>
                <td style={{padding:"11px 8px", textAlign:"center", color:"#fff", fontWeight:800, fontSize:"15px", borderRight:"1px solid rgba(255,255,255,0.1)"}}>{fmt(summary.total)}</td>
                <td style={{padding:"11px 8px", textAlign:"center", color:"#fca5a5", fontWeight:700}}>{fmt(summary.expenses)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Print: Wrapper مع هيدر وفوتر
══════════════════════════════════════════ */
function PrintWrapper({ reportType, range, children, loading }: {
  reportType: ReportType; range: { from: string; to: string };
  children: React.ReactNode; loading: boolean;
}) {
  const titles: Record<ReportType, string> = {
    profit:            "تقرير صافي الربح",
    sales:             "تقرير المبيعات",
    purchases:         "تقرير المشتريات",
    "external-sales":  "تقرير المبيعات الخارجية",
    exports:           "تقرير الصادرات",
    "waste-comparison":"تقرير مقارنة المخلفات",
  };
  const now = new Date().toLocaleDateString("ar-SA-u-nu-latn", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh",
  });

  return (
    <div className="bg-white text-gray-900 rounded-[20px] overflow-hidden shadow-2xl print:rounded-none print:shadow-none">
      {/* Header */}
      <div className="print-header bg-[#0f1511] text-white px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[#3fa66a] text-xs tracking-widest uppercase mb-1">Marai Alshamal</p>
            <h1 className="text-2xl font-black">{titles[reportType]}</h1>
            <p className="text-[#8a9690] text-sm mt-1">
              {range.from === range.to ? fmtDate(range.from) : `${fmtDate(range.from)} — ${fmtDate(range.to)}`}
            </p>
          </div>
          <div className="text-left">
            <p className="text-[#8a9690] text-xs mt-2">{now}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="print-body p-6">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-[#3fa66a] border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-gray-400">جاري تحميل البيانات...</p>
          </div>
        ) : children}
      </div>

      {/* Footer */}
      <div className="print-footer border-t border-gray-100 px-8 py-3 flex items-center justify-between text-xs text-gray-400">
        <span>مراعي الشمال — نظام الإقفال اليومي</span>
        <span className="ltr-num">{now}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Main Page
══════════════════════════════════════════ */
export default function PrintReportsPage() {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [range, setRange] = useState(getDefaultRange());
  const [loading, setLoading] = useState(false);
  const [profitData, setProfitData] = useState<ProfitData | null>(null);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const loadProfitData = useCallback(async (from: string, to: string) => {
    setLoading(true); setError(""); setProfitData(null);
    try {
      const res = await fetch(`/api/admin/profit-report?from=${from}&to=${to}`);
      if (!res.ok) { setError("تعذر تحميل البيانات"); return; }
      const json = await res.json();
      setProfitData(json);
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSalesData = useCallback(async (from: string, to: string) => {
    setLoading(true); setError(""); setSalesData(null);
    try {
      const res = await fetch(`/api/admin/sales-report?from=${from}&to=${to}`);
      if (!res.ok) { setError("تعذر تحميل البيانات"); return; }
      const json = await res.json();
      setSalesData(json);
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, []);

  function handlePrint() {
    window.print();
  }

  const reportTypes = [
    { type: "profit"           as ReportType, title: "صافي الربح",         desc: "يوضح الفرق بين قيمة المشتريات والمبيعات لكل فرع وصنف" },
    { type: "sales"            as ReportType, title: "المبيعات",            desc: "تفصيل شامل للمبيعات حسب الفرع وطريقة الدفع وأنواع اللحوم" },
    { type: "purchases"        as ReportType, title: "المشتريات",           desc: "سجل تفصيلي للمشتريات من الموردين حسب الصنف والفرع" },
    { type: "external-sales"   as ReportType, title: "المبيعات الخارجية",   desc: "تقرير مبيعات الحملات والعروض الخارجية خارج الفروع" },
    { type: "exports"          as ReportType, title: "الصادرات",            desc: "تقرير الصادرات وكميات المواد المُصدَّرة من الفروع" },
    { type: "waste-comparison" as ReportType, title: "مقارنة المخلفات",     desc: "مقارنة بيانات المخلفات وكمياتها بين الفروع والفترات" },
  ];

  return (
    <div className="min-h-screen bg-bg text-cream" dir="rtl">
      <div className="fixed inset-x-0 top-0 h-[400px] bg-[radial-gradient(ellipse_at_top,_rgba(63,166,106,0.07),_transparent_60%)] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 py-8">

        {/* Page Header */}
        <div className="mb-8 no-print">
          <div className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/10 px-3 py-1 text-xs text-green mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
            طباعة التقارير
          </div>
          <h1 className="text-4xl font-black">طباعة التقارير</h1>
          <p className="text-muted mt-1 text-sm">أنشئ تقارير احترافية جاهزة للطباعة والتصدير</p>
        </div>

        <div className="no-print">
          <StepIndicator current={step} />
        </div>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="no-print">
            <p className="text-muted text-sm mb-5">اختر نوع التقرير:</p>
            <div className="grid gap-4 sm:grid-cols-3 mb-8">
              {reportTypes.map(r => (
                <ReportCard key={r.type} {...r} active={selectedType === r.type} onClick={() => setSelectedType(r.type)} />
              ))}
            </div>
            <div className="flex justify-end">
              <button disabled={!selectedType} onClick={() => setStep(2)}
                className="rounded-2xl bg-green hover:bg-green-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-8 py-3.5 text-sm transition-all hover:scale-[1.02]">
                التالي ← تحديد الفترة
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="no-print">
            <div className="rounded-[28px] border border-line bg-card p-6 mb-6">
              <h2 className="font-black text-xl mb-5">حدد الفترة الزمنية</h2>
              <div className="mb-6">
                <p className="text-muted text-xs mb-3">اختصارات سريعة:</p>
                <PeriodPresets selected={range} onSelect={r => setRange(r)} />
              </div>
              <div className="border-t border-line pt-5">
                <p className="text-muted text-xs mb-3">أو حدد تاريخاً مخصصاً:</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted block mb-1.5">من تاريخ</label>
                    <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
                      className="w-full rounded-2xl bg-bg border border-line px-4 py-3 text-cream text-sm focus:outline-none focus:border-green/50" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1.5">إلى تاريخ</label>
                    <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
                      className="w-full rounded-2xl bg-bg border border-line px-4 py-3 text-cream text-sm focus:outline-none focus:border-green/50" />
                  </div>
                </div>
              </div>
              {range.from && range.to && (
                <div className="mt-5 rounded-2xl border border-green/20 bg-green/5 px-5 py-3.5 flex items-center gap-3">
                  
                  <div>
                    <p className="text-green text-sm font-bold">
                      {range.from === range.to ? fmtDate(range.from) : `${fmtDate(range.from)} — ${fmtDate(range.to)}`}
                    </p>
                    <p className="text-muted text-xs mt-0.5">
                      {(() => {
                        const d = Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000) + 1;
                        return `${d} ${d === 1 ? "يوم" : "أيام"}`;
                      })()}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(1)}
                className="rounded-2xl border border-line bg-card-hi px-6 py-3 text-sm text-muted hover:text-cream transition-all">
                ← رجوع
              </button>
              <button disabled={!range.from || !range.to} onClick={() => {
                setStep(3);
                if (selectedType === "profit") loadProfitData(range.from, range.to);
                if (selectedType === "sales")  loadSalesData(range.from, range.to);
              }}
                className="rounded-2xl bg-green hover:bg-green-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-8 py-3.5 text-sm transition-all hover:scale-[1.02]">
                معاينة التقرير →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && selectedType && (
          <div>
            {/* Toolbar */}
            <div className="rounded-[24px] border border-line bg-card p-4 mb-6 flex items-center justify-between gap-4 no-print">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep(2)}
                  className="rounded-xl border border-line bg-card-hi px-4 py-2 text-sm text-muted hover:text-cream transition-all">
                  ← تعديل
                </button>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${selectedType === "profit" ? "bg-green" : selectedType === "sales" ? "bg-sky-400" : "bg-amber"}`} />
                  <span className="text-cream text-sm font-medium">
                    {selectedType === "profit" ? "صافي الربح" : selectedType === "sales" ? "المبيعات" : "المشتريات"}
                  </span>
                  <span className="text-muted text-xs">·</span>
                  <span className="text-muted text-xs">
                    {range.from === range.to ? fmtDate(range.from) : `${fmtDate(range.from)} — ${fmtDate(range.to)}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(selectedType === "profit" || selectedType === "sales") && (
                  <button onClick={() => {
                    if (selectedType === "profit") loadProfitData(range.from, range.to);
                    if (selectedType === "sales")  loadSalesData(range.from, range.to);
                  }}
                    className="rounded-xl border border-line bg-card-hi px-4 py-2 text-sm text-muted hover:text-cream transition-all">
                    ↻ تحديث
                  </button>
                )}
                {error && <p className="text-red text-xs">{error}</p>}
                <button onClick={handlePrint}
                  className="flex items-center gap-2 rounded-2xl bg-green hover:bg-green-dark text-white font-bold px-6 py-2.5 text-sm transition-all hover:scale-[1.02]">
                  طباعة
                </button>
              </div>
            </div>

            {/* Print Content */}
            <div ref={printRef} className="print-scale-wrap">
              <PrintWrapper reportType={selectedType} range={range} loading={loading}>
                {selectedType === "profit" && profitData && (
                  <ProfitReportPrint data={profitData} range={range} />
                )}
                {selectedType === "profit" && !profitData && !loading && (
                  <div className="text-center py-12 text-gray-400">لا توجد بيانات في هذه الفترة</div>
                )}
                {selectedType === "sales" && salesData && (
                  <SalesReportPrint data={salesData} />
                )}
                {selectedType === "sales" && !salesData && !loading && (
                  <div className="text-center py-12 text-gray-400">لا توجد بيانات في هذه الفترة</div>
                )}
                {selectedType === "purchases" && (
                  <div className="text-center py-12 text-gray-400">تقرير المشتريات — قريباً</div>
                )}
                {selectedType === "external-sales" && (
                  <div className="text-gray-900 font-[Readex_Pro,Tajawal,sans-serif]" dir="rtl">
                    <div className="rounded-2xl border border-purple-200 bg-purple-50 p-10 text-center">
                      <div className="text-5xl mb-4">🔄</div>
                      <p className="text-purple-700 font-black text-xl mb-2">تقرير المبيعات الخارجية</p>
                      <p className="text-purple-500 text-sm">هذا التقرير قيد التطوير — سيكون متاحاً قريباً</p>
                    </div>
                  </div>
                )}
                {selectedType === "exports" && (
                  <div className="text-gray-900 font-[Readex_Pro,Tajawal,sans-serif]" dir="rtl">
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-10 text-center">
                      <div className="text-5xl mb-4">↗</div>
                      <p className="text-orange-700 font-black text-xl mb-2">تقرير الصادرات</p>
                      <p className="text-orange-500 text-sm">هذا التقرير قيد التطوير — سيكون متاحاً قريباً</p>
                    </div>
                  </div>
                )}
                {selectedType === "waste-comparison" && (
                  <div className="text-gray-900 font-[Readex_Pro,Tajawal,sans-serif]" dir="rtl">
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center">
                      <div className="text-5xl mb-4">⚖</div>
                      <p className="text-rose-700 font-black text-xl mb-2">تقرير مقارنة المخلفات</p>
                      <p className="text-rose-500 text-sm">هذا التقرير قيد التطوير — سيكون متاحاً قريباً</p>
                    </div>
                  </div>
                )}
              </PrintWrapper>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          aside { display: none !important; }
          nav  { display: none !important; }
          body { background: white !important; margin: 0 !important; }
          @page {
            size: A4 portrait;
            margin: 5mm 6mm;
          }
          /* wrap يأخذ عرض الصفحة كاملاً بدون overflow */
          .print-scale-wrap {
            width: 100% !important;
            box-shadow: none !important;
          }
          /* إزالة الظلال والحدود المزخرفة */
          .print-scale-wrap > div {
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          /* تصغير KPI cards */
          .kpi-grid { gap: 6px !important; margin-bottom: 8px !important; }
          .kpi-grid > div { padding: 8px 10px !important; }
          .kpi-grid p:first-child { font-size: 9px !important; margin-bottom: 2px !important; }
          .kpi-grid p:nth-child(2) { font-size: 16px !important; }
          .kpi-grid p:last-child { font-size: 9px !important; }
          /* تصغير header */
          .print-header { padding: 10px 16px !important; }
          .print-header h1 { font-size: 15px !important; }
          /* جداول الملخص */
          .summary-block { margin-bottom: 8px !important; }
          .section-header { padding: 5px 10px !important; }
          .section-header h2 { font-size: 11px !important; }
          /* تصغير كل الجداول */
          table { font-size: 8.5px !important; }
          table th { padding: 2px 4px !important; line-height: 1.2 !important; }
          table td { padding: 2px 4px !important; line-height: 1.2 !important; }
          /* تصغير overflow-x wrapper */
          .branch-block .overflow-x-auto { overflow: visible !important; }
          /* كل فرع بصف كامل */
          .branches-grid {
            display: block !important;
          }
          /* كل فرع لا ينكسر داخله */
          .branch-block { page-break-inside: avoid; break-inside: avoid; margin-bottom: 5px !important; }
          /* تصغير رأس الفرع */
          .branch-header { padding: 4px 10px !important; }
          .branch-header span { font-size: 11px !important; }
          /* body padding */
          .print-body { padding: 10px !important; }
          /* footer */
          .print-footer { padding: 4px 16px !important; font-size: 8px !important; }
        }
        .ltr-num { direction: ltr; display: inline-block; }
      `}</style>
    </div>
  );
}
