"use client";

import { useRef, useState } from "react";
import { StepField } from "@/types/database";

interface DynamicFieldProps {
  field: StepField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

/* ─── تقييم تعبير رياضي بشكل آمن (بدون eval مباشر) ─── */
function safeCalc(expr: string): number | null {
  const cleaned = expr.trim().replace(/\s/g, "").replace(/،/g, ".").replace(/,/g, ".");
  if (!cleaned) return null;
  // السماح فقط بالأرقام وعمليات + - * / والأقواس والنقطة
  if (!/^[0-9+\-*/.()]+$/.test(cleaned)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function('"use strict"; return (' + cleaned + ')')();
    if (typeof result === "number" && isFinite(result) && !isNaN(result)) {
      // تقريب إلى 3 منازل عشرية
      return Math.round(result * 1000) / 1000;
    }
    return null;
  } catch {
    return null;
  }
}

/* ─── الانتقال للحقل التالي عند Enter ─── */
function focusNext(current: HTMLElement) {
  const sel = 'input:not([type="hidden"]):not([type="file"]):not([disabled]), textarea:not([disabled]), select:not([disabled])';
  const all = [...document.querySelectorAll<HTMLElement>(sel)].filter(
    (el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]')
  );
  const idx = all.indexOf(current);
  if (idx !== -1 && idx < all.length - 1) {
    all[idx + 1].focus();
    if ((all[idx + 1] as HTMLInputElement).select) {
      (all[idx + 1] as HTMLInputElement).select();
    }
  }
}

/* ─── حقل الأرقام مع الحاسبة ─── */
function NumberField({ field, value, onChange, error }: DynamicFieldProps) {
  const [raw, setRaw]       = useState("");
  const [focused, setFocused] = useState(false);

  const displayVal = focused ? raw : (value != null && value !== "" ? String(value) : "");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setRaw(v);
    // تحديث فوري إذا كان رقماً بسيطاً (بدون عمليات)
    if (v === "" || v === "-") {
      onChange(v === "" ? "" : v);
    } else if (!/[+\-*/]/.test(v) || (v.startsWith("-") && !/[+\-*/]/.test(v.slice(1)))) {
      const n = parseFloat(v);
      if (!isNaN(n)) onChange(n);
      else onChange(v);
    }
  }

  function commitCalc(input: HTMLElement) {
    if (/[+\-*/]/.test(raw)) {
      const result = safeCalc(raw);
      if (result !== null) {
        onChange(result);
        setRaw(String(result));
        return String(result);
      }
    }
    return raw;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitCalc(e.currentTarget);
      focusNext(e.currentTarget);
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(false);
    commitCalc(e.currentTarget);
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(true);
    setRaw(value != null && value !== "" ? String(value) : "");
    setTimeout(() => e.target.select(), 0);
  }

  return (
    <div className="bg-card rounded-2xl p-5 border border-line">
      <p className="text-cream font-semibold mb-1">{field.field_label}</p>
      {field.help_text && <p className="text-muted text-xs mb-3">{field.help_text}</p>}
      <input
        type="text"
        inputMode="decimal"
        value={displayVal}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={field.placeholder || "0"}
        className={`w-full bg-card-hi text-cream rounded-xl px-4 py-4 text-3xl font-black ltr-num border outline-none transition-colors ${
          error ? "border-red" : "border-line focus:border-green"
        }`}
        dir="ltr"
      />
      {focused && raw && /[+\-*/]/.test(raw) && (() => {
        const r = safeCalc(raw);
        return r !== null ? (
          <p className="text-green text-sm mt-1 ltr-num">= {r}</p>
        ) : null;
      })()}
      {error && <p className="text-red text-xs mt-2">{error}</p>}
    </div>
  );
}

/* ─── المكون الرئيسي ─── */
export default function DynamicField({ field, value, onChange, error }: DynamicFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  // FILE TYPE
  if (field.field_type === "file") {
    const fileName = value as string;
    const acceptTypes = field.file_types?.map(t => {
      if (t === "pdf") return ".pdf";
      if (t === "jpg" || t === "jpeg") return "image/jpeg";
      if (t === "png") return "image/png";
      return `.${t}`;
    }).join(",") || "*";

    return (
      <div className="bg-card rounded-2xl p-5 border border-line">
        <p className="text-cream font-semibold mb-1">{field.field_label}</p>
        {field.help_text && <p className="text-muted text-xs mb-3">{field.help_text}</p>}
        {field.file_types && field.file_types.length > 0 && (
          <p className="text-muted text-xs mb-2">الأنواع المسموحة: {field.file_types.join(", ")}</p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={acceptTypes}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange(file.name);
          }}
          className="hidden"
        />
        {fileName ? (
          <div className="bg-card-hi rounded-xl p-4 border border-green/30">
            <p className="text-green text-sm font-medium mb-1">✓ تم الإرفاق</p>
            <p className="text-muted text-xs">{fileName}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`w-full border-2 border-dashed rounded-xl p-6 text-center hover:border-green/40 transition-colors ${
              error ? "border-red" : "border-line"
            }`}
          >
            <p className="text-4xl mb-2">📎</p>
            <p className="text-muted text-sm">{field.placeholder || "اضغط لإرفاق ملف"}</p>
          </button>
        )}
        {fileName && (
          <button
            type="button"
            onClick={() => { onChange(""); if (fileRef.current) fileRef.current.value = ""; }}
            className="mt-2 text-muted text-xs underline"
          >
            إزالة الملف
          </button>
        )}
        {error && <p className="text-red text-xs mt-2">{error}</p>}
      </div>
    );
  }

  // NUMBER TYPE — مع حاسبة + Enter للانتقال + بدون أسهم
  if (field.field_type === "number") {
    return <NumberField field={field} value={value} onChange={onChange} error={error} />;
  }

  // TEXTAREA TYPE
  if (field.field_type === "textarea") {
    return (
      <div className="bg-card rounded-2xl p-5 border border-line">
        <p className="text-cream font-semibold mb-1">{field.field_label}</p>
        {field.help_text && <p className="text-muted text-xs mb-3">{field.help_text}</p>}
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ""}
          rows={4}
          className={`w-full bg-card-hi text-cream rounded-xl px-4 py-3 border outline-none resize-none ${
            error ? "border-red" : "border-line focus:border-green"
          }`}
        />
        {error && <p className="text-red text-xs mt-2">{error}</p>}
      </div>
    );
  }

  // CHECKBOX TYPE
  if (field.field_type === "checkbox") {
    return (
      <div className="bg-card rounded-2xl p-5 border border-line">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="w-6 h-6 rounded border-2 border-line bg-card-hi checked:bg-green checked:border-green"
          />
          <div className="flex-1">
            <p className="text-cream font-semibold">{field.field_label}</p>
            {field.help_text && <p className="text-muted text-xs mt-1">{field.help_text}</p>}
          </div>
        </label>
        {error && <p className="text-red text-xs mt-2">{error}</p>}
      </div>
    );
  }

  // SELECT TYPE
  if (field.field_type === "select") {
    const options = (field.options as string[]) || [];
    return (
      <div className="bg-card rounded-2xl p-5 border border-line">
        <p className="text-cream font-semibold mb-1">{field.field_label}</p>
        {field.help_text && <p className="text-muted text-xs mb-3">{field.help_text}</p>}
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-card-hi text-cream rounded-xl px-4 py-3 border outline-none ${
            error ? "border-red" : "border-line focus:border-green"
          }`}
        >
          <option value="">-- اختر --</option>
          {options.map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
        {error && <p className="text-red text-xs mt-2">{error}</p>}
      </div>
    );
  }

  // TEXT TYPE (default) — مع Enter للانتقال
  return (
    <div className="bg-card rounded-2xl p-5 border border-line">
      <p className="text-cream font-semibold mb-1">{field.field_label}</p>
      {field.help_text && <p className="text-muted text-xs mb-3">{field.help_text}</p>}
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext(e.currentTarget); } }}
        placeholder={field.placeholder || ""}
        className={`w-full bg-card-hi text-cream rounded-xl px-4 py-3 border outline-none ${
          error ? "border-red" : "border-line focus:border-green"
        }`}
      />
      {error && <p className="text-red text-xs mt-2">{error}</p>}
    </div>
  );
}
