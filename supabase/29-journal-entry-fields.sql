-- ═══════════════════════════════════════════════════════════
-- 29 — تحديث جداول قيود اليومية + إضافة الحقول الجديدة
-- شغّل هذا الملف في Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─── إنشاء دالة توليد رقم القيد إذا لم تكن موجودة ───
CREATE SEQUENCE IF NOT EXISTS journal_entry_seq START 1;

CREATE OR REPLACE FUNCTION next_entry_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  seq_val BIGINT;
  year_part TEXT;
BEGIN
  seq_val   := nextval('journal_entry_seq');
  year_part := to_char(NOW() AT TIME ZONE 'Asia/Riyadh', 'YYYY');
  RETURN 'JE-' || year_part || '-' || lpad(seq_val::TEXT, 5, '0');
END;
$$;

-- ─── إضافة الحقول الجديدة لجدول journal_entries ───
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS supplier_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS supplier_invoice_date   DATE,
  ADD COLUMN IF NOT EXISTS due_date                DATE,
  ADD COLUMN IF NOT EXISTS includes_vat            BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS amount_before_vat       NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS vat_amount              NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS payment_method          TEXT,
  ADD COLUMN IF NOT EXISTS bank_name               TEXT,
  ADD COLUMN IF NOT EXISTS transaction_reference   TEXT,
  ADD COLUMN IF NOT EXISTS check_number            TEXT,
  ADD COLUMN IF NOT EXISTS check_date              DATE,
  ADD COLUMN IF NOT EXISTS check_status            TEXT,
  ADD COLUMN IF NOT EXISTS received_by             TEXT,
  ADD COLUMN IF NOT EXISTS adjustment_reason       TEXT,
  ADD COLUMN IF NOT EXISTS reverses_entry_id       UUID REFERENCES journal_entries(id),
  ADD COLUMN IF NOT EXISTS line_items              JSONB,
  ADD COLUMN IF NOT EXISTS cost_center             TEXT,
  ADD COLUMN IF NOT EXISTS hijri_date              TEXT;

-- ─── إضافة حقل document_url لجدول journal_entries ───
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS document_urls JSONB DEFAULT '[]'::jsonb;

-- ─── جدول المستندات المرفقة ───
CREATE TABLE IF NOT EXISTS supplier_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id       UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  journal_entry_id  UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  file_name         TEXT NOT NULL,
  file_path         TEXT NOT NULL,
  file_size         BIGINT,
  file_type         TEXT,
  storage_url       TEXT,
  uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by       TEXT DEFAULT 'admin',
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_supplier_docs_supplier ON supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_docs_entry    ON supplier_documents(journal_entry_id);

-- ─── RLS للمستندات ───
ALTER TABLE supplier_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_docs_all ON supplier_documents;
CREATE POLICY supplier_docs_all ON supplier_documents FOR ALL USING (true);

-- ─── تعطيل RLS على الجداول الأساسية للمحاسبة ───
ALTER TABLE journal_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines   DISABLE ROW LEVEL SECURITY;

-- ─── تأكد من وجود عمود hijri_date في journal_entries ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='journal_entries' AND column_name='hijri_date'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN hijri_date TEXT;
  END IF;
END $$;

-- ─── تحديث عمود status ليقبل القيم المطلوبة ───
ALTER TABLE journal_entries
  ALTER COLUMN status SET DEFAULT 'posted';

-- ─── Storage bucket للمستندات ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-documents',
  'supplier-documents',
  false,
  10485760,  -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf','image/jpg']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = 10485760,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf','image/jpg'];

-- ─── Storage RLS ───
DROP POLICY IF EXISTS storage_supplier_docs_read   ON storage.objects;
DROP POLICY IF EXISTS storage_supplier_docs_write  ON storage.objects;
DROP POLICY IF EXISTS storage_supplier_docs_delete ON storage.objects;

CREATE POLICY storage_supplier_docs_read  ON storage.objects FOR SELECT USING (bucket_id = 'supplier-documents');
CREATE POLICY storage_supplier_docs_write ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'supplier-documents');
CREATE POLICY storage_supplier_docs_delete ON storage.objects FOR DELETE USING (bucket_id = 'supplier-documents');

SELECT 'Done — 29-journal-entry-fields.sql تم تطبيقه بنجاح' AS status;
