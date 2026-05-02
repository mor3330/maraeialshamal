"use client";

import React, { useState, useEffect, useRef, DragEvent } from "react";
import { createClient } from "@supabase/supabase-js";

const fmt = (v: number) =>
  v.toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function todayStr() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function toHijri(g: string): string {
  if (!g) return "";
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
      day: "numeric", month: "long", year: "numeric",
    }).format(new Date(`${g}T12:00:00`));
  } catch { return ""; }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ─── Types ─── */
interface UF {
  id: string; name: string; size: number; type: string;
  url: string; status: "uploading" | "done" | "error"; progress: number;
}
interface LineItem { id: string; description: string; quantity: string; unitPrice: string; }
interface Props {
  supplierId: string; supplierName?: string; currentBalance?: number;
  onClose: () => void; onSuccess: (entryNumber: string) => void;
}

/* ─── Upload Zone ─── */
function UploadZone({ supplierId, files, setFiles }: {
  supplierId: string;
  files: UF[];
  setFiles: React.Dispatch<React.SetStateAction<UF[]>>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  async function upload(file: File) {
    const uid = crypto.randomUUID();
    const ext = file.name.split(".").pop();
    const path = `${supplierId}/${new Date().getFullYear()}/${Date.now()}-${uid}.${ext}`;
    setFiles(p => [...p, { id: uid, name: file.name, size: file.size, type: file.type, url: "", status: "uploading", progress: 30 }]);
    try {
      const { error } = await sb.storage.from("supplier-documents").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = sb.storage.from("supplier-documents").getPublicUrl(path);
      const url = data?.publicUrl || path;
      setFiles(p => p.map(f => f.id === uid ? { ...f, url, status: "done", progress: 100 } : f));
    } catch {
      setFiles(p => p.map(f => f.id === uid ? { ...f, status: "error", progress: 0 } : f));
    }
  }

  function pick(list: FileList | null) {
    if (!list) return;
    Array.from(list).forEach(f => {
      if (f.size > 10 * 1024 * 1024) { alert(`${f.name} — أكبر من 10MB`); return; }
      upload(f);
    });
  }

  const sz = (b: number) => b > 1048576 ? (b/1048576).toFixed(1)+"MB" : (b/1024).toFixed(0)+"KB";

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e: DragEvent) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all select-none ${
          drag ? "border-[#3fa66a] bg-[#3fa66a]/10" : "border-[#2a3830] hover:border-[#3fa66a]/40 bg-[#1a2420]"}`}>
        <div className="w-10 h-10 rounded-xl bg-[#0f1511] border border-[#2a3830] flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-[#6a7870]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-white mb-1">اسحب الملفات هنا أو اضغط للرفع</p>
        <p className="text-[10px] text-[#6a7870]">PDF, JPG, PNG, WEBP — حتى 10 MB</p>
        <input ref={inputRef} type="file" className="hidden" multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => pick(e.target.files)} />
      </div>
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-3 rounded-xl bg-[#1a2420] border border-[#2a3830] p-3">
              <div className="w-8 h-8 rounded-lg bg-[#0f1511] flex items-center justify-center flex-shrink-0">
                <span className={`text-xs font-bold ${f.type.startsWith("image") ? "text-green-400" : "text-red-400"}`}>
                  {f.type.startsWith("image") ? "IMG" : "PDF"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{f.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {f.status === "uploading" && (
                    <div className="flex-1 h-1 bg-[#2a3830] rounded-full overflow-hidden">
                      <div className="h-full bg-[#3fa66a] rounded-full" style={{ width: `${f.progress}%` }} />
                    </div>
                  )}
                  {f.status === "done"  && <span className="text-[10px] text-green-400">تم الرفع</span>}
                  {f.status === "error" && <span className="text-[10px] text-red-400">فشل الرفع</span>}
                  <span className="text-[10px] text-[#6a7870]">{sz(f.size)}</span>
                </div>
              </div>
              <button onClick={() => setFiles(p => p.filter(x => x.id !== f.id))}
                className="text-[#6a7870] hover:text-red-400 text-sm flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Field helper (خارج المكون لتفادي إعادة الإنشاء) ─── */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#8a9890] block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-[#6a7870] mt-1">{hint}</p>}
    </div>
  );
}

/* ─── Main Modal ─── */
const DRAFT_KEY = (id: string) => `entry-draft-${id}`;

export default function AddEntryModal({ supplierId, supplierName = "المورد", currentBalance = 0, onClose, onSuccess }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [files, setFiles]   = useState<UF[]>([]);
  const [showDraft, setShowDraft] = useState(false);

  const [form, setForm] = useState({
    entry_date: todayStr(), entry_type: "purchase", description: "", hijri_date: "",
    amount: "", notes: "",
    supplier_invoice_number: "", supplier_invoice_date: "", due_date: "",
    includes_vat: false, vat_percent: 15, line_items: [] as LineItem[],
    payment_method: "transfer", bank_name: "", transaction_reference: "",
    check_number: "", check_date: "", check_status: "pending", received_by: "",
    adjustment_reason: "", adjustment_direction: "decrease" as "increase"|"decrease",
    cost_center: "",
  });

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const iCls = "w-full rounded-xl bg-[#1a2420] border border-[#2a3830] px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3fa66a]/60 placeholder:text-[#4a5550]";

  const dir: "debit"|"credit" = form.entry_type === "payment" ? "credit"
    : form.entry_type === "adjustment" ? (form.adjustment_direction === "decrease" ? "credit" : "debit")
    : "debit";

  const raw    = parseFloat(form.amount) || 0;
  const vat    = form.includes_vat ? Math.round(raw / (1+form.vat_percent/100) * (form.vat_percent/100) * 100) / 100 : 0;
  const before = form.includes_vat ? raw - vat : raw;
  const newBal = dir === "debit" ? currentBalance + raw : currentBalance - raw;

  useEffect(() => { if (form.entry_date) set("hijri_date", toHijri(form.entry_date)); }, [form.entry_date]);

  useEffect(() => {
    if (!form.description && !form.amount) return;
    localStorage.setItem(DRAFT_KEY(supplierId), JSON.stringify({ form, ts: Date.now() }));
  }, [form, supplierId]);

  useEffect(() => {
    const raw2 = localStorage.getItem(DRAFT_KEY(supplierId));
    if (!raw2) return;
    try {
      const { form: s, ts } = JSON.parse(raw2);
      if (Date.now() - ts < 86400000 && (s.description || s.amount)) setShowDraft(true);
    } catch {}
  }, [supplierId]);

  function restoreDraft() {
    const r = localStorage.getItem(DRAFT_KEY(supplierId));
    if (r) try { setForm(JSON.parse(r).form); } catch {}
    setShowDraft(false);
  }

  /* line items */
  const addLine  = () => set("line_items", [...form.line_items, { id: crypto.randomUUID(), description: "", quantity: "", unitPrice: "" }]);
  const updLine  = (id: string, k: string, v: string) => set("line_items", form.line_items.map((l: LineItem) => l.id===id ? {...l,[k]:v} : l));
  const delLine  = (id: string) => set("line_items", form.line_items.filter((l: LineItem) => l.id !== id));
  const lineSum  = form.line_items.reduce((s: number, l: LineItem) => s + (parseFloat(l.quantity)||0)*(parseFloat(l.unitPrice)||0), 0);

  async function save() {
    if (!form.description.trim()) { setError("البيان مطلوب"); return; }
    if (raw <= 0)                  { setError("أدخل مبلغاً أكبر من صفر"); return; }
    if (files.some(f => f.status === "uploading")) { setError("انتظر اكتمال رفع الملفات"); return; }
    setSaving(true); setError("");
    try {
      const urls = files.filter(f => f.status === "done").map(f => f.url);
      const body: Record<string, unknown> = {
        entry_date: form.entry_date, entry_type: form.entry_type, description: form.description,
        hijri_date: form.hijri_date, amount: raw, direction: dir,
        notes: form.notes || undefined, cost_center: form.cost_center || undefined, document_urls: urls,
      };
      if (form.entry_type === "purchase") Object.assign(body, {
        supplier_invoice_number: form.supplier_invoice_number || undefined,
        supplier_invoice_date: form.supplier_invoice_date || undefined,
        due_date: form.due_date || undefined,
        includes_vat: form.includes_vat,
        amount_before_vat: form.includes_vat ? before : undefined,
        vat_amount: form.includes_vat ? vat : undefined,
        line_items: form.line_items.length > 0 ? form.line_items : undefined,
      });
      else if (form.entry_type === "payment") Object.assign(body, {
        payment_method: form.payment_method,
        bank_name: form.bank_name || undefined,
        transaction_reference: form.transaction_reference || undefined,
        check_number: form.check_number || undefined,
        check_date: form.check_date || undefined,
        check_status: form.check_status || undefined,
        received_by: form.received_by || undefined,
      });
      else if (form.entry_type === "adjustment") body.adjustment_reason = form.adjustment_reason || undefined;

      const res  = await fetch(`/api/suppliers/${supplierId}/ledger`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل الحفظ");
      localStorage.removeItem(DRAFT_KEY(supplierId));
      onSuccess(json.entryNumber);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally { setSaving(false); }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); save(); }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const TYPES = [
    { v:"purchase", l:"فاتورة شراء", c:"#d97706" }, { v:"payment", l:"دفعة تسديد",   c:"#16a34a" },
    { v:"opening",  l:"رصيد افتتاحي",c:"#0369a1" }, { v:"adjustment",l:"تسوية",       c:"#7c3aed" },
    { v:"reversing",l:"قيد عكسي",    c:"#dc2626" },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-start justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-[#0f1511] border border-[#2a3830] rounded-[28px] w-full max-w-3xl my-6 shadow-2xl">

        {/* Header */}
        <div className="p-6 border-b border-[#2a3830] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">قيد يومية جديد</h2>
            <p className="text-xs text-[#6a7870] mt-0.5">حساب {supplierName}</p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#1a2420] hover:bg-[#2a3830] text-[#6a7870] hover:text-white flex items-center justify-center">✕</button>
        </div>

        {/* Draft banner */}
        {showDraft && (
          <div className="mx-6 mt-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-center justify-between">
            <span className="text-xs text-amber-300">وُجدت مسودة محفوظة. هل تريد استعادتها؟</span>
            <div className="flex gap-2">
              <button onClick={() => setShowDraft(false)}
                className="text-xs text-[#6a7870] px-3 py-1.5 rounded-xl bg-[#1a2420]">تجاهل</button>
              <button onClick={restoreDraft}
                className="text-xs text-amber-300 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/20">استعادة</button>
            </div>
          </div>
        )}

        <div className="p-6 space-y-6">

          {/* نوع القيد */}
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => (
              <button key={t.v} onClick={() => set("entry_type", t.v)}
                className="rounded-2xl px-4 py-2 text-xs font-bold border transition-all"
                style={{
                  color: form.entry_type===t.v ? t.c : "#6a7870",
                  borderColor: form.entry_type===t.v ? t.c : "#2a3830",
                  background: form.entry_type===t.v ? `${t.c}18` : "transparent",
                }}>
                {t.l}
              </button>
            ))}
          </div>

          {/* اتجاه القيد */}
          <div className={`rounded-2xl p-3 text-xs border ${dir==="debit" ? "bg-amber-500/5 border-amber-500/15 text-amber-400" : "bg-green-500/5 border-green-500/15 text-green-400"}`}>
            {dir==="debit"
              ? `هذا القيد يُضاف إلى المبلغ المستحق لـ ${supplierName}`
              : `هذا القيد يُخصم من المبلغ المستحق لـ ${supplierName}`}
          </div>

          {/* التاريخ + الهجري */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="التاريخ الميلادي *">
              <input type="date" value={form.entry_date} onChange={e => set("entry_date", e.target.value)} className={iCls} />
            </Field>
            <Field label="التاريخ الهجري" hint="يُحسب تلقائياً">
              <input type="text" value={form.hijri_date} onChange={e => set("hijri_date", e.target.value)}
                placeholder="يتم الحساب تلقائياً" className={iCls + " text-[#8a9890]"} />
            </Field>
          </div>

          {/* المبلغ + مركز التكلفة */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="المبلغ بالريال *">
              <input type="number" value={form.amount} min="0" step="0.01"
                onChange={e => set("amount", e.target.value)} placeholder="0.00" className={iCls} />
            </Field>
            <Field label="مركز التكلفة">
              <input type="text" value={form.cost_center}
                onChange={e => set("cost_center", e.target.value)} placeholder="الفرع الرئيسي" className={iCls} />
            </Field>
          </div>

          {/* الوصف */}
          <Field label="الوصف / البيان *">
            <textarea value={form.description} onChange={e => set("description", e.target.value)}
              rows={2} maxLength={500}
              placeholder={form.entry_type==="purchase" ? "مثال: 50 رأس حاشي — فاتورة رقم 1234"
                : form.entry_type==="payment" ? "مثال: دفعة جزئية تحويل بنكي" : "وصف القيد"}
              className={iCls + " resize-none"} />
            <p className="text-[10px] text-[#4a5550] mt-1 text-left">{form.description.length}/500</p>
          </Field>

          {/* حقول فاتورة الشراء */}
          {form.entry_type === "purchase" && (
            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4 space-y-4">
              <p className="text-xs font-black text-amber-400">تفاصيل فاتورة الشراء</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="رقم فاتورة المورد" hint="الرقم المطبوع على الفاتورة">
                  <input type="text" value={form.supplier_invoice_number}
                    onChange={e => set("supplier_invoice_number", e.target.value)}
                    placeholder="INV-1234" className={iCls} />
                </Field>
                <Field label="تاريخ الفاتورة">
                  <input type="date" value={form.supplier_invoice_date}
                    onChange={e => set("supplier_invoice_date", e.target.value)} className={iCls} />
                </Field>
                <Field label="تاريخ الاستحقاق">
                  <input type="date" value={form.due_date}
                    onChange={e => set("due_date", e.target.value)} className={iCls} />
                </Field>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-10 h-5 rounded-full relative transition-colors ${form.includes_vat ? "bg-[#3fa66a]" : "bg-[#2a3830]"}`}
                  onClick={() => set("includes_vat", !form.includes_vat)}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.includes_vat ? "right-0.5" : "left-0.5"}`} />
                </div>
                <span className="text-xs text-white">المبلغ يشمل ضريبة القيمة المضافة 15%</span>
              </label>

              {form.includes_vat && raw > 0 && (
                <div className="rounded-xl bg-[#0f1511] border border-[#2a3830] p-3 grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-[10px] text-[#6a7870]">قبل الضريبة</p><p className="text-sm font-black text-white">{fmt(before)}</p></div>
                  <div><p className="text-[10px] text-[#6a7870]">الضريبة 15%</p><p className="text-sm font-black text-amber-400">{fmt(vat)}</p></div>
                  <div><p className="text-[10px] text-[#6a7870]">الإجمالي</p><p className="text-sm font-black text-[#3fa66a]">{fmt(raw)}</p></div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#8a9890]">بنود الفاتورة (اختياري)</span>
                  <button onClick={addLine}
                    className="text-xs text-[#3fa66a] border border-[#3fa66a]/30 px-3 py-1 rounded-xl">+ إضافة بند</button>
                </div>
                {form.line_items.map((l: LineItem) => (
                  <div key={l.id} className="grid grid-cols-[1fr_80px_80px_30px] gap-2 items-center mb-2">
                    <input value={l.description} onChange={e => updLine(l.id,"description",e.target.value)}
                      placeholder="الوصف" className={iCls+" text-xs"} />
                    <input value={l.quantity} onChange={e => updLine(l.id,"quantity",e.target.value)}
                      type="number" placeholder="كمية" className={iCls+" text-xs"} />
                    <input value={l.unitPrice} onChange={e => updLine(l.id,"unitPrice",e.target.value)}
                      type="number" placeholder="سعر" className={iCls+" text-xs"} />
                    <button onClick={() => delLine(l.id)} className="text-[#6a7870] hover:text-red-400">✕</button>
                  </div>
                ))}
                {form.line_items.length > 0 && (
                  <p className="text-right text-xs font-black text-[#3fa66a]">الإجمالي: {fmt(lineSum)} ر.س</p>
                )}
              </div>
            </div>
          )}

          {/* حقول الدفع */}
          {form.entry_type === "payment" && (
            <div className="rounded-2xl border border-green-500/15 bg-green-500/5 p-4 space-y-4">
              <p className="text-xs font-black text-green-400">طريقة الدفع</p>
              <div className="grid grid-cols-4 gap-2">
                {[{v:"cash",l:"نقدي"},{v:"transfer",l:"تحويل بنكي"},{v:"check",l:"شيك"},{v:"card",l:"بطاقة"}].map(p => (
                  <button key={p.v} onClick={() => set("payment_method",p.v)}
                    className={`rounded-xl p-2.5 text-xs font-bold border transition-all ${
                      form.payment_method===p.v
                        ? "border-green-500/50 bg-green-500/10 text-green-300"
                        : "border-[#2a3830] text-[#6a7870]"}`}>{p.l}</button>
                ))}
              </div>
              {form.payment_method === "transfer" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="البنك"><input type="text" value={form.bank_name}
                    onChange={e => set("bank_name",e.target.value)} placeholder="البنك الأهلي" className={iCls}/></Field>
                  <Field label="رقم العملية"><input type="text" value={form.transaction_reference}
                    onChange={e => set("transaction_reference",e.target.value)} placeholder="TXN-123456" className={iCls}/></Field>
                </div>
              )}
              {form.payment_method === "check" && (
                <div className="grid grid-cols-3 gap-3">
                  <Field label="رقم الشيك"><input type="text" value={form.check_number}
                    onChange={e => set("check_number",e.target.value)} className={iCls}/></Field>
                  <Field label="تاريخ الشيك"><input type="date" value={form.check_date}
                    onChange={e => set("check_date",e.target.value)} className={iCls}/></Field>
                  <Field label="الحالة">
                    <select value={form.check_status} onChange={e => set("check_status",e.target.value)} className={iCls}>
                      <option value="pending">مؤجّل</option>
                      <option value="cleared">مصروف</option>
                      <option value="bounced">مرتجع</option>
                    </select>
                  </Field>
                </div>
              )}
              {form.payment_method === "cash" && (
                <Field label="استلمه"><input type="text" value={form.received_by}
                  onChange={e => set("received_by",e.target.value)} placeholder="اسم المستلم" className={iCls}/></Field>
              )}
            </div>
          )}

          {/* حقول التسوية */}
          {form.entry_type === "adjustment" && (
            <div className="rounded-2xl border border-purple-500/15 bg-purple-500/5 p-4 space-y-4">
              <p className="text-xs font-black text-purple-400">تفاصيل التسوية</p>
              <Field label="السبب">
                <select value={form.adjustment_reason} onChange={e => set("adjustment_reason",e.target.value)} className={iCls}>
                  <option value="">اختر</option>
                  <option value="trade_discount">خصم تجاري</option>
                  <option value="cash_discount">خصم نقدي</option>
                  <option value="return">مرتجع</option>
                  <option value="price_diff">فرق سعر</option>
                  <option value="correction">تصحيح خطأ</option>
                  <option value="other">أخرى</option>
                </select>
              </Field>
              <div className="flex gap-3">
                {[{v:"decrease",l:"تُقلّل المستحق (صالحنا)"},{v:"increase",l:"تزيد المستحق (صالح المورد)"}].map(o => (
                  <button key={o.v} onClick={() => set("adjustment_direction",o.v)}
                    className={`flex-1 rounded-xl py-2 text-xs font-bold border transition-all ${
                      form.adjustment_direction===o.v
                        ? "border-purple-500/50 bg-purple-500/10 text-purple-300"
                        : "border-[#2a3830] text-[#6a7870]"}`}>{o.l}</button>
                ))}
              </div>
            </div>
          )}

          {form.entry_type === "opening" && (
            <div className="rounded-2xl bg-blue-500/5 border border-blue-500/20 p-4">
              <p className="text-xs font-bold text-blue-400 mb-1">رصيد افتتاحي</p>
              <p className="text-xs text-blue-300/70">هذا القيد سيُحدد الرصيد الابتدائي للمورد.</p>
            </div>
          )}

          {/* ملاحظات */}
          <Field label="ملاحظات داخلية">
            <textarea value={form.notes} onChange={e => set("notes",e.target.value)}
              rows={2} placeholder="ملاحظات داخلية..." className={iCls+" resize-none"}/>
          </Field>

          {/* المرفقات */}
          <div>
            <p className="text-xs font-semibold text-[#8a9890] mb-2">المرفقات (فاتورة / إيصال / تحويل)</p>
            <UploadZone supplierId={supplierId} files={files} setFiles={setFiles} />
          </div>

          {/* معاينة الرصيد */}
          {raw > 0 && (
            <div className={`rounded-2xl p-4 border ${dir==="debit" ? "bg-amber-500/5 border-amber-500/15" : "bg-green-500/5 border-green-500/15"}`}>
              <p className="text-xs font-bold text-[#8a9890] mb-3">أثر هذا القيد على الرصيد</p>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-[10px] text-[#6a7870]">الرصيد الحالي</p>
                  <p className={`font-black tabular-nums text-sm ${currentBalance > 0 ? "text-amber-300" : "text-green-300"}`}>{fmt(Math.abs(currentBalance))}</p>
                </div>
                <span className="text-[#6a7870] text-xl">{dir==="debit" ? "+" : "−"}</span>
                <div className="text-center">
                  <p className="text-[10px] text-[#6a7870]">هذا القيد</p>
                  <p className={`font-black tabular-nums text-sm ${dir==="debit" ? "text-amber-300" : "text-green-300"}`}>{fmt(raw)}</p>
                </div>
                <span className="text-[#6a7870]">=</span>
                <div className="text-center">
                  <p className="text-[10px] text-[#6a7870]">الرصيد الجديد</p>
                  <p className={`font-black tabular-nums text-lg ${newBal > 5 ? "text-amber-300" : newBal < -5 ? "text-green-300" : "text-white"}`}>{fmt(Math.abs(newBal))} ر.س</p>
                  <p className="text-[10px] text-[#6a7870]">{newBal > 5 ? "مستحق للمورد" : newBal < -5 ? "رصيد لصالحك" : "متوازن"}</p>
                </div>
              </div>
            </div>
          )}

          {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-400 text-sm">{error}</div>}

          {/* أزرار */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 rounded-2xl bg-[#1a2420] border border-[#2a3830] py-3.5 text-sm font-bold text-[#6a7870] hover:text-white">
              إلغاء
            </button>
            <button onClick={save} disabled={saving || !form.description.trim() || raw <= 0}
              className="flex-[3] rounded-2xl bg-[#3fa66a] hover:bg-[#2d7a4e] disabled:opacity-40 py-3.5 text-sm font-black text-white transition-colors">
              {saving
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"/>
                    جاري الحفظ...
                  </span>
                : `حفظ القيد${raw > 0 ? ` — ${fmt(raw)} ر.س` : ""}`}
            </button>
          </div>
          <p className="text-center text-[10px] text-[#4a5550]">Ctrl+Enter للحفظ · Esc للإغلاق</p>
        </div>
      </div>
    </div>
  );
}
