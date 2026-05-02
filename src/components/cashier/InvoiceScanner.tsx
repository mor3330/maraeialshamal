"use client";

import { useRef, useState, useEffect } from "react";

export interface ScannedInvoiceData {
  total_sales: number;
  cash_amount: number;
  network_amount: number;
  transfer_amount?: number;
  deferred_amount?: number;
  invoice_count?: number;
  returns_value?: number;
  discounts_value?: number;
}

interface InvoiceScannerProps {
  /** الحقول المتاحة في هذه الخطوة - لتحديد ما يُعرض من نتائج */
  availableFields: string[];
  /** عند تطبيق البيانات المقروءة */
  onApply: (data: ScannedInvoiceData) => void;
}

// الحقول التي يعمل معها قارئ الفواتير
const SCANNER_FIELDS = [
  "total_sales",
  "cash_amount",
  "network_amount",
  "transfer_amount",
  "deferred_amount",
  "invoice_count",
  "returns_value",
];

const FIELD_LABELS: Record<string, string> = {
  total_sales: "إجمالي المبيعات",
  cash_amount: "كاش",
  network_amount: "شبكة",
  transfer_amount: "تحويل بنكي",
  deferred_amount: "آجل",
  invoice_count: "عدد الفواتير",
  returns_value: "المرتجعات",
};

const SCAN_STORAGE_KEY = "marai_last_invoice_scan";

/** حفظ نتيجة المسح في sessionStorage لإعادة استخدامها */
function saveScanToSession(data: ScannedInvoiceData) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SCAN_STORAGE_KEY, JSON.stringify(data));
  }
}

/** جلب آخر نتيجة مسح محفوظة */
function loadScanFromSession(): ScannedInvoiceData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SCAN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function InvoiceScanner({
  availableFields,
  onApply,
}: InvoiceScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef  = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [fileName, setFileName] = useState<string>("");
  const [isPdf, setIsPdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScannedInvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // آخر فاتورة تم مسحها في هذه الجلسة
  const [savedScan, setSavedScan] = useState<ScannedInvoiceData | null>(null);

  // هل هذه الخطوة تحتوي على حقول قابلة للقراءة؟
  const hasRelevantFields = availableFields.some((f) =>
    SCANNER_FIELDS.includes(f)
  );

  // تحقق من وجود بيانات محفوظة عند التحميل أو الفتح
  useEffect(() => {
    const saved = loadScanFromSession();
    setSavedScan(saved);
  }, []); // عند أول تحميل

  useEffect(() => {
    if (isOpen) {
      const saved = loadScanFromSession();
      setSavedScan(saved);
    }
  }, [isOpen]);

  // هل توجد بيانات محفوظة مرتبطة بهذه الخطوة؟
  const hasSavedRelevant = savedScan
    ? (Object.entries(savedScan) as [string, number][]).some(
        ([key, val]) => availableFields.includes(key) && val > 0
      )
    : false;

  if (!hasRelevantFields) return null;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setApplied(false);
    setFileName(file.name);
    setIsPdf(false);
    compressImage(file).then(({ dataUrl, mime }) => {
      setPreviewUrl(dataUrl);
      setImageBase64(dataUrl);
      setMimeType(mime);
    });
  }

  function handlePdfSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setApplied(false);
    setFileName(file.name);
    setIsPdf(true);
    setPreviewUrl(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImageBase64(dataUrl);
      setMimeType("application/pdf");
    };
    reader.readAsDataURL(file);
  }

  /** ضغط الصورة إلى أقصى 1200px وجودة 82% */
  function compressImage(file: File): Promise<{ dataUrl: string; mime: string }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1200;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) {
              height = Math.round((height * MAX) / width);
              width = MAX;
            } else {
              width = Math.round((width * MAX) / height);
              height = MAX;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve({ dataUrl, mime: "image/jpeg" });
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleScan() {
    if (!imageBase64) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/invoice-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "فشلت القراءة، جرب صورة أوضح");
        setErrorDetails(data.details ? String(data.details).slice(0, 500) : null);
        return;
      }

      setResult(data.data);
      // ← احفظ النتيجة في sessionStorage لإعادة الاستخدام
      saveScanToSession(data.data);
    } catch {
      setError("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!result) return;
    onApply(result);
    setApplied(true);
    setTimeout(() => {
      setIsOpen(false);
      resetScanner();
    }, 1500);
  }

  /** تطبيق البيانات المحفوظة مباشرة دون مسح جديد */
  function handleApplySaved() {
    if (!savedScan) return;
    onApply(savedScan);
    setApplied(true);
    setTimeout(() => {
      setIsOpen(false);
      resetScanner();
    }, 1500);
  }

  function resetScanner() {
    setPreviewUrl(null);
    setImageBase64(null);
    setIsPdf(false);
    setFileName("");
    setResult(null);
    setError(null);
    setErrorDetails(null);
    setApplied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (pdfInputRef.current)  pdfInputRef.current.value  = "";
  }

  function formatNum(n: number) {
    if (n === 0) return "0";
    return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  // الحقول التي ستُعرض في النتائج
  const relevantResults = result
    ? (Object.entries(result) as [string, number][]).filter(
        ([key]) => availableFields.includes(key) && key !== "raw_text"
      )
    : [];

  // الحقول الموجودة في البيانات المحفوظة
  const savedRelevantResults = savedScan
    ? (Object.entries(savedScan) as [string, number][]).filter(
        ([key]) => availableFields.includes(key)
      )
    : [];

  return (
    <>
      {/* زر فتح القارئ */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`w-full flex items-center gap-3 rounded-2xl py-4 px-4 transition-all active:scale-[0.98] group border-2 border-dashed ${
            hasSavedRelevant
              ? "bg-amber/10 border-amber/60 hover:border-amber text-amber"
              : "bg-card border-amber/40 hover:border-amber/70 text-amber"
          }`}
        >
          <span className="text-2xl group-hover:scale-110 transition-transform flex-shrink-0">
            {hasSavedRelevant ? "♻️" : "📸"}
          </span>
          <div className="text-right flex-1">
            <p className="font-bold text-base">
              {hasSavedRelevant ? "بيانات فاتورة محفوظة" : "قراءة الفاتورة تلقائياً"}
            </p>
            <p className="text-xs text-muted">
              {hasSavedRelevant
                ? "اضغط لاستخدامها مباشرة بدون مسح جديد"
                : "صوّر الفاتورة وسيعبّي البيانات بنفسه"}
            </p>
          </div>
          {hasSavedRelevant && (
            <span className="bg-green text-white text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0">
              جاهزة ✓
            </span>
          )}
        </button>
      )}

      {/* لوحة القارئ */}
      {isOpen && (
        <div className="bg-card border border-amber/30 rounded-2xl overflow-hidden">
          {/* رأس اللوحة */}
          <div className="bg-card-hi px-4 py-3 flex items-center justify-between border-b border-line">
            <div className="flex items-center gap-2">
              <span className="text-xl">📸</span>
              <p className="text-amber font-bold">قارئ الفاتورة الذكي</p>
            </div>
            <button
              type="button"
              onClick={() => { setIsOpen(false); resetScanner(); }}
              className="text-muted hover:text-cream text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-line transition-colors"
            >
              ×
            </button>
          </div>

          <div className="p-4 space-y-4">

            {/* ── بيانات الفاتورة المحفوظة ── */}
            {savedScan && !previewUrl && !result && !applied && (
              <div className="bg-amber/10 border border-amber/30 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-amber/20 flex items-center gap-2">
                  <span className="text-lg">♻️</span>
                  <p className="text-amber font-bold text-sm">بيانات فاتورة محفوظة</p>
                </div>
                <div className="divide-y divide-amber/10">
                  {savedRelevantResults.length > 0 ? (
                    savedRelevantResults.map(([key, val]) =>
                      val > 0 ? (
                        <div key={key} className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-muted text-sm">{FIELD_LABELS[key] ?? key}</span>
                          <span className="text-cream font-bold ltr-num">
                            {key === "invoice_count" ? Math.round(val) : formatNum(val)}
                            {key !== "invoice_count" && (
                              <span className="text-muted text-xs font-normal mr-1">ر.س</span>
                            )}
                          </span>
                        </div>
                      ) : null
                    )
                  ) : (
                    <div className="px-4 py-3 text-center text-muted text-sm">
                      البيانات المحفوظة لا تتطابق مع حقول هذه الخطوة
                    </div>
                  )}
                </div>
                {savedRelevantResults.some(([, v]) => v > 0) && (
                  <div className="p-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSavedScan(null)}
                      className="flex-1 bg-card-hi border border-line text-muted rounded-xl py-2.5 text-sm font-semibold hover:text-cream transition-colors"
                    >
                      مسح جديد
                    </button>
                    <button
                      type="button"
                      onClick={handleApplySaved}
                      className="flex-[2] bg-amber hover:bg-amber/80 text-bg rounded-xl py-2.5 font-bold text-sm transition-colors active:scale-[0.98]"
                    >
                      ✓ استخدم هذه البيانات
                    </button>
                  </div>
                )}
                {!savedRelevantResults.some(([, v]) => v > 0) && (
                  <div className="p-3">
                    <button
                      type="button"
                      onClick={() => setSavedScan(null)}
                      className="w-full bg-card-hi border border-line text-muted rounded-xl py-2.5 text-sm font-semibold hover:text-cream transition-colors"
                    >
                      مسح جديد بدلاً
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── منطقة رفع الصورة أو PDF ── */}
            {!savedScan && !imageBase64 ? (
              <>
                {/* inputs مخفية */}
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
                <input ref={pdfInputRef}  type="file" accept="application/pdf"               onChange={handlePdfSelect}  className="hidden" />

                {/* زران */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 border-2 border-dashed border-amber/50 hover:border-amber hover:bg-amber/5 rounded-xl p-5 text-center transition-colors"
                  >
                    <span className="text-4xl">📄</span>
                    <p className="text-cream font-bold text-sm">رفع PDF</p>
                    <p className="text-muted text-xs">أدق وأسرع</p>
                    <span className="bg-amber text-bg text-xs px-2 py-0.5 rounded-lg font-bold">مُوصى به</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 border-2 border-dashed border-line hover:border-amber/40 rounded-xl p-5 text-center transition-colors"
                  >
                    <span className="text-4xl">📷</span>
                    <p className="text-cream font-bold text-sm">صورة</p>
                    <p className="text-muted text-xs">تصوير الفاتورة</p>
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-muted">
                  <p>✅ PDF: احفظ الفاتورة من زد أو فاتورة كـ PDF</p>
                  <p>✅ صورة: تأكد أن الأرقام واضحة وغير ضبابية</p>
                  <p>✅ يدعم فواتير زد، فاتورة، ونقاط البيع</p>
                </div>
              </>
            ) : imageBase64 ? (
              <>
                {/* معاينة الصورة أو بطاقة PDF */}
                {isPdf ? (
                  <div className="bg-amber/10 border-2 border-amber/40 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-14 h-14 bg-amber/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-3xl">📄</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-cream font-bold text-sm truncate">{fileName}</p>
                      <p className="text-amber text-xs mt-1">✓ PDF جاهز للقراءة</p>
                    </div>
                    <button type="button" onClick={resetScanner} className="text-muted hover:text-cream text-sm underline flex-shrink-0">تغيير</button>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden bg-card-hi border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl ?? ""}
                      alt="الفاتورة"
                      className="w-full max-h-64 object-contain"
                    />
                    <button
                      type="button"
                      onClick={resetScanner}
                      className="absolute top-2 left-2 bg-black/60 text-white rounded-lg px-2 py-1 text-xs hover:bg-black/80 transition-colors"
                    >
                      تغيير الصورة
                    </button>
                  </div>
                )}

                {/* حالة التحميل */}
                {loading && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="relative">
                      <div className="w-12 h-12 border-4 border-line border-t-amber rounded-full animate-spin"></div>
                      <span className="absolute inset-0 flex items-center justify-center text-lg">🤖</span>
                    </div>
                    <div className="text-center">
                      <p className="text-amber font-semibold">جاري تحليل الفاتورة...</p>
                      <p className="text-muted text-xs mt-1">الذكاء الاصطناعي يقرأ البيانات</p>
                    </div>
                  </div>
                )}

                {/* خطأ */}
                {error && !loading && (
                  <div className="bg-red/10 border border-red/30 rounded-xl p-4 text-center">
                    <p className="text-2xl mb-2">⚠️</p>
                    <p className="text-red font-semibold text-sm">{error}</p>
                    {errorDetails && (
                      <details className="mt-2 text-left">
                        <summary className="text-muted text-xs cursor-pointer">تفاصيل الخطأ</summary>
                        <p className="text-muted text-xs mt-1 break-all">{errorDetails}</p>
                      </details>
                    )}
                    <button
                      type="button"
                      onClick={resetScanner}
                      className="mt-3 text-muted text-xs underline"
                    >
                      جرب صورة أخرى
                    </button>
                  </div>
                )}

                {/* النتائج */}
                {result && !loading && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">✅</span>
                      <p className="text-green font-bold">تم قراءة الفاتورة بنجاح!</p>
                    </div>

                    <div className="bg-card-hi rounded-xl border border-line divide-y divide-line overflow-hidden">
                      {relevantResults.length > 0 ? (
                        relevantResults.map(([key, val]) => (
                          val > 0 || key === "total_sales" ? (
                            <div key={key} className="flex items-center justify-between px-4 py-3">
                              <span className="text-muted text-sm">{FIELD_LABELS[key] ?? key}</span>
                              <span className="text-cream font-black text-lg ltr-num">
                                {key === "invoice_count"
                                  ? Math.round(val)
                                  : formatNum(val)}
                                {key !== "invoice_count" && (
                                  <span className="text-muted text-xs font-normal mr-1">ر.س</span>
                                )}
                              </span>
                            </div>
                          ) : null
                        ))
                      ) : (
                        <div className="px-4 py-3 text-center text-muted text-sm">
                          لم يتم العثور على بيانات مطابقة لهذه الخطوة
                        </div>
                      )}
                    </div>

                    {result.total_sales === 0 && (
                      <p className="text-amber text-xs text-center">
                        ⚠️ إجمالي المبيعات يبدو صفراً، تأكد من وضوح الصورة
                      </p>
                    )}

                    {applied ? (
                      <div className="flex items-center justify-center gap-2 py-3 text-green font-bold">
                        <span>✅</span>
                        <span>تم تطبيق البيانات!</span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={resetScanner}
                          className="flex-1 bg-card-hi border border-line text-muted rounded-xl py-3 text-sm font-semibold hover:text-cream transition-colors"
                        >
                          إعادة المسح
                        </button>
                        <button
                          type="button"
                          onClick={handleApply}
                          className="flex-[2] bg-green hover:bg-green-dark text-white rounded-xl py-3 font-bold transition-colors active:scale-[0.98]"
                        >
                          ✓ تطبيق البيانات
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* زر المسح إذا لم يتم المسح بعد */}
                {!loading && !result && !error && (
                  <button
                    type="button"
                    onClick={handleScan}
                    className="w-full bg-amber hover:bg-amber/80 text-bg rounded-xl py-4 font-bold text-lg transition-colors active:scale-[0.98]"
                  >
                    🤖 اقرأ الفاتورة الآن
                  </button>
                )}
              </>
            ) : null}

            {/* إظهار نجاح التطبيق للبيانات المحفوظة */}
            {applied && (
              <div className="flex items-center justify-center gap-2 py-4 text-green font-bold text-lg">
                <span>✅</span>
                <span>تم تطبيق البيانات!</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
