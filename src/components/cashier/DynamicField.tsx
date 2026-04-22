"use client";

import { useRef } from "react";
import { StepField } from "@/types/database";

interface DynamicFieldProps {
  field: StepField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

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

  // NUMBER TYPE
  if (field.field_type === "number") {
    return (
      <div className="bg-card rounded-2xl p-5 border border-line">
        <p className="text-cream font-semibold mb-1">{field.field_label}</p>
        {field.help_text && <p className="text-muted text-xs mb-3">{field.help_text}</p>}
        <input
          type="number"
          inputMode="numeric"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "0"}
          className={`w-full bg-card-hi text-cream rounded-xl px-4 py-4 text-3xl font-black ltr-num border outline-none transition-colors ${
            error ? "border-red" : "border-line focus:border-green"
          }`}
          dir="ltr"
        />
        {error && <p className="text-red text-xs mt-2">{error}</p>}
      </div>
    );
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

  // TEXT TYPE (default)
  return (
    <div className="bg-card rounded-2xl p-5 border border-line">
      <p className="text-cream font-semibold mb-1">{field.field_label}</p>
      {field.help_text && <p className="text-muted text-xs mb-3">{field.help_text}</p>}
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || ""}
        className={`w-full bg-card-hi text-cream rounded-xl px-4 py-3 border outline-none ${
          error ? "border-red" : "border-line focus:border-green"
        }`}
      />
      {error && <p className="text-red text-xs mt-2">{error}</p>}
    </div>
  );
}
