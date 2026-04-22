"use client";

import { useRef, useState } from "react";
import type { SalesScanResult, ScannedProduct } from "@/app/api/sales-scanner/route";
import { StepField } from "@/types/database";

export type { SalesScanResult, ScannedProduct };

interface SalesProductScannerProps {
  fields: StepField[];
  onApply: (fieldValues: Record<string, string>) => void;
  /** رقم الخطوة الحالية - يظهر القارئ فقط في الخطوة 3 */
  step?: number;
}

const CATEGORY_INFO = {
  hashi: { label: "حاشي 🐪",  color: "text-amber",      bg: "bg-amber/10",      border: "border-amber/30" },
  sheep: { label: "غنم 🐑",   color: "text-blue-400",   bg: "bg-blue-400/10",   border: "border-blue-400/30" },
  beef:  { label: "عجل 🐄",   color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/30" },
  offal: { label: "مخلفات 🥩", color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/30" },
  other: { label: "أخرى 📦",  color: "text-muted",      bg: "bg-card-hi",       border: "border-line" },
} as const;

const QTY_KEYWORDS = ["qty", "weight", "quantity", "كمية", "وزن", "عدد", "كيلو"];
const AMT_KEYWORDS = ["amount", "sales", "total", "price", "مبلغ", "إجمالي", "سعر", "قيمة", "مبيعات"];

function formatNum(n: number) {
  if (!n) return "0";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function guessFieldRole(fieldName: string): "qty" | "amount" | null {
  const lower = fieldName.toLowerCase();
  if (QTY_KEYWORDS.some((k) => lower.includes(k))) return "qty";
  if (AMT_KEYWORDS.some((k) => lower.includes(k))) return "amount";
  return null;
}

function guessFieldCategory(fieldName: string): "hashi" | "sheep" | "beef" | "offal" | null {
  if (fieldName.startsWith("hashi_")) return "hashi";
  if (fieldName.startsWith("sheep_")) return "sheep";
  if (fieldName.startsWith("beef_"))  return "beef";
  if (fieldName.startsWith("offal_")) return "offal";
  return null;
}

function buildFieldValues(fields: StepField[], data: SalesScanResult): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    if (field.field_type !== "number") continue;
    const cat = guessFieldCategory(field.field_name);
    const role = guessFieldRole(field.field_name);
    if (!cat || !role) continue;
    const catData = data.totals[cat];
    if (!catData) continue;
    const val = role === "qty" ? catData.qty : catData.amount;
    if (val > 0) result[field.id] = String(val);
  }
  return result;
}

export default function SalesProductScanner({ fields, onApply, step }: SalesProductScannerProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef   = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen]         = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileData, setFileData]     = useState<{ base64: string; mime: string; name: string } | null>(null);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<SalesScanResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [applied, setApplied]       = useState(false);
  const [activeTab, setActiveTab]   = useState<"summary" | "details">("summary");

  // ═══ يظهر فقط في الخطوة 3 ═══
  if (step !== undefined && step !== 3) return null;

  const matchedCount = result ? Object.keys(buildFieldValues(fields, result)).length : 0;
  const hasFile = !!fileData;
  const isPdf = fileData?.mime === "application/pdf";

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    clearResult();
    compressImage(file).then(({ dataUrl }) => {
      setPreviewUrl(dataUrl);
      setFileData({ base64: dataUrl, mime: "image/jpeg", name: file.name });
    });
  }

  function handlePdfSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    clearResult();
    setPreviewUrl(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setFileData({ base64: dataUrl, mime: "application/pdf", name: file.name });
    };
    reader.readAsDataURL(file);
  }

  function compressImage(file: File): Promise<{ dataUrl: string }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1600;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
            else { width = Math.round((width * MAX) / height); height = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
          resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.88) });
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  function clearResult() {
    setResult(null);
    setError(null);
    setApplied(false);
  }

  function resetAll() {
    setPreviewUrl(null);
    setFileData(null);
    clearResult();
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (pdfInputRef.current)   pdfInputRef.current.value   = "";
  }

  async function handleScan() {
    if (!fileData) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/sales-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: fileData.base64, mimeType: fileData.mime }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "فشلت القراءة، جرب ملفاً أوضح");
        return;
      }
      setResult(data.data);
      setActiveTab("summary");
    } catch {
      setError("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!result) return;
    onApply(buildFieldValues(fields, result));
    setApplied(true);
    setTimeout(() => { setIsOpen(false); resetAll(); }, 1500);
  }

  const activeCategories = result
    ? (Object.entries(result.totals) as [string, { qty: number; amount: number }][]).filter(([, v]) => v.amount > 0)
    : [];

  return (
    <>
      {/* ── زر الفتح ── */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-3 rounded-2xl py-4 px-4 transition-all active:scale-[0.98] group border-2 border-dashed bg-card border-green/40 hover:border-green/70 text-green"
        >
          <span className="text-2xl group-hover:scale-110 transition-transform flex-shrink-0">📊</span>
          <div className="text-right flex-1">
            <p className="font-bold text-base">قراءة تقرير المبيعات حسب المنتج</p>
            <p className="text-xs text-muted">ارفع PDF أو صوّر التقرير – يعبّي الكمية والمبلغ تلقائياً</p>
          </div>
          <span className="text-xs bg-green/20 text-green border border-green/30 px-2 py-1 rounded-lg flex-shrink-0 font-semibold">PDF ✓</span>
        </button>
      )}

      {/* ── لوحة القارئ ── */}
      {isOpen && (
        <div className="bg-card border border-green/30 rounded-2xl overflow-hidden">
          <div className="bg-card-hi px-4 py-3 flex items-center justify-between border-b border-line">
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <p className="text-green font-bold">قارئ تقرير المبيعات</p>
            </div>
            <button type="button" onClick={() => { setIsOpen(false); resetAll(); }}
              className="text-muted hover:text-cream text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-line transition-colors">×</button>
          </div>

          <div className="p-4 space-y-4">

            {/* منطقة الرفع */}
            {!hasFile && (
              <>
                <input ref={imageInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />
                <input ref={pdfInputRef}   type="file" accept="application/pdf"               onChange={handlePdfSelect}   className="hidden" />
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => pdfInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 border-2 border-dashed border-green/50 hover:border-green hover:bg-green/5 rounded-xl p-5 text-center transition-colors">
                    <span className="text-4xl">📄</span>
                    <p className="text-cream font-bold text-sm">رفع PDF</p>
                    <p className="text-muted text-xs">أدق وأسرع</p>
                    <span className="bg-green text-white text-xs px-2 py-0.5 rounded-lg font-bold">مُوصى به</span>
                  </button>
                  <button type="button" onClick={() => imageInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 border-2 border-dashed border-line hover:border-green/40 rounded-xl p-5 text-center transition-colors">
                    <span className="text-4xl">📷</span>
                    <p className="text-cream font-bold text-sm">صورة</p>
                    <p className="text-muted text-xs">تصوير الشاشة</p>
                  </button>
                </div>
                <div className="bg-card-hi border border-line rounded-xl p-3 space-y-1 text-xs text-muted">
                  <p>📄 PDF: احفظ التقرير من EZPOS أو زد كـ PDF</p>
                  <p>📷 صورة: تأكد أن النص واضح وغير مشوّه</p>
                </div>
              </>
            )}

            {/* الملف المرفوع */}
            {hasFile && !result && (
              <>
                {previewUrl && !isPdf ? (
                  <div className="relative rounded-xl overflow-hidden bg-card-hi border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="تقرير المبيعات" className="w-full max-h-72 object-contain" />
                    <button type="button" onClick={resetAll} className="absolute top-2 left-2 bg-black/60 text-white rounded-lg px-2 py-1 text-xs">تغيير</button>
                  </div>
                ) : (
                  <div className="bg-green/10 border-2 border-green/40 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-14 h-14 bg-green/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-3xl">📄</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-cream font-bold text-sm truncate">{fileData?.name}</p>
                      <p className="text-green text-xs mt-1">✓ PDF جاهز للقراءة</p>
                    </div>
                    <button type="button" onClick={resetAll} className="text-muted hover:text-cream text-sm underline flex-shrink-0">تغيير</button>
                  </div>
                )}

                {loading && (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <div className="relative">
                      <div className="w-14 h-14 border-4 border-line border-t-green rounded-full animate-spin" />
                      <span className="absolute inset-0 flex items-center justify-center text-xl">🤖</span>
                    </div>
                    <p className="text-green font-semibold">{isPdf ? "جاري تحليل PDF..." : "جاري قراءة الصورة..."}</p>
                    <p className="text-muted text-xs">الذكاء الاصطناعي يستخرج كل منتج</p>
                  </div>
                )}

                {error && !loading && (
                  <div className="bg-red/10 border border-red/30 rounded-xl p-4 text-center">
                    <p className="text-2xl mb-2">⚠️</p>
                    <p className="text-red font-semibold text-sm">{error}</p>
                    <button type="button" onClick={resetAll} className="mt-3 text-muted text-xs underline">جرب ملفاً آخر</button>
                  </div>
                )}

                {!loading && !error && (
                  <button type="button" onClick={handleScan}
                    className="w-full bg-green hover:bg-green-dark text-white rounded-xl py-4 font-bold text-lg transition-colors active:scale-[0.98]">
                    🤖 {isPdf ? "اقرأ الـ PDF الآن" : "اقرأ التقرير الآن"}
                  </button>
                )}
              </>
            )}

            {/* النتائج */}
            {result && !loading && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <p className="text-green font-bold">تم قراءة {result.products.length} منتج</p>
                  <span className="mr-auto text-amber font-bold ltr-num text-sm">{formatNum(result.grand_total)} ر.س</span>
                </div>

                <div className="flex gap-1 bg-card-hi rounded-xl p-1">
                  {(["summary", "details"] as const).map((tab) => (
                    <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab ? "bg-card text-cream shadow" : "text-muted hover:text-cream"}`}>
                      {tab === "summary" ? "ملخص الفئات" : `تفاصيل (${result.products.length})`}
                    </button>
                  ))}
                </div>

                {activeTab === "summary" && (
                  <div className="space-y-2">
                    {activeCategories.map(([cat, data]) => {
                      const info = CATEGORY_INFO[cat as keyof typeof CATEGORY_INFO];
                      return (
                        <div key={cat} className={`rounded-xl border ${info.border} ${info.bg} p-3`}>
                          <span className={`font-bold ${info.color} block mb-1`}>{info.label}</span>
                          <div className="flex gap-4 text-sm">
                            <span><span className="text-muted">الكمية: </span><span className="text-cream font-bold ltr-num">{formatNum(data.qty)}</span></span>
                            <span><span className="text-muted">المبلغ: </span><span className="text-cream font-bold ltr-num">{formatNum(data.amount)} ر.س</span></span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="bg-card-hi border border-line rounded-xl p-3 flex items-center justify-between">
                      <span className="text-muted font-semibold">الإجمالي الكلي</span>
                      <span className="text-amber font-black ltr-num text-lg">{formatNum(result.grand_total)} ر.س</span>
                    </div>
                  </div>
                )}

                {activeTab === "details" && (
                  <div className="rounded-xl border border-line overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-card-hi px-3 py-2 text-xs text-muted font-semibold border-b border-line">
                      <span>المنتج</span><span className="text-center">الكمية</span><span className="text-left">الإجمالي</span>
                    </div>
                    <div className="divide-y divide-line max-h-72 overflow-y-auto">
                      {result.products.map((p, i) => {
                        const info = CATEGORY_INFO[p.category];
                        return (
                          <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2.5 items-center hover:bg-card-hi">
                            <div>
                              <p className="text-cream text-sm font-semibold leading-tight">{p.name}</p>
                              {p.code && <p className="text-muted text-xs">{p.code}</p>}
                              <span className={`text-xs ${info.color} font-medium`}>{info.label}</span>
                            </div>
                            <span className="text-cream text-sm ltr-num text-center whitespace-nowrap">{formatNum(p.quantity)}</span>
                            <span className="text-amber font-bold text-sm ltr-num text-left whitespace-nowrap">{formatNum(p.total)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {matchedCount > 0 && !applied && (
                  <div className="bg-green/10 border border-green/30 rounded-xl px-4 py-3 text-sm">
                    <p className="text-green font-semibold">✓ سيتم تعبئة {matchedCount} حقل تلقائياً</p>
                  </div>
                )}
                {matchedCount === 0 && !applied && (
                  <div className="bg-amber/10 border border-amber/30 rounded-xl px-4 py-3 text-sm">
                    <p className="text-amber font-semibold">⚠️ البيانات للعرض فقط - حقول الخطوة لا تتطابق مع الفئات</p>
                  </div>
                )}

                {applied ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-green font-bold text-lg">
                    <span>✅</span><span>تم تطبيق البيانات!</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button type="button" onClick={resetAll} className="flex-1 bg-card-hi border border-line text-muted rounded-xl py-3 text-sm font-semibold hover:text-cream transition-colors">مسح جديد</button>
                    {matchedCount > 0 && (
                      <button type="button" onClick={handleApply} className="flex-[2] bg-green hover:bg-green-dark text-white rounded-xl py-3 font-bold transition-colors active:scale-[0.98]">✓ تطبيق البيانات</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
