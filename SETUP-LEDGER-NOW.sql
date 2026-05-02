-- ═══════════════════════════════════════════════════════════════
--  إعداد نظام المحاسبة بالكامل — شغّل هذا في Supabase SQL Editor
--  يعمل سواء كانت الجداول موجودة أو لا
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. التسلسل والدالة ───
CREATE SEQUENCE IF NOT EXISTS journal_entry_seq START 1;

CREATE OR REPLACE FUNCTION next_entry_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq_val   BIGINT;
  year_part TEXT;
BEGIN
  seq_val   := nextval('journal_entry_seq');
  year_part := to_char(NOW() AT TIME ZONE 'Asia/Riyadh', 'YYYY');
  RETURN 'JE-' || year_part || '-' || lpad(seq_val::TEXT, 5, '0');
END;
$$;

-- ─── 2. جدول قيود اليومية ───
CREATE TABLE IF NOT EXISTS journal_entries (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number    TEXT    UNIQUE NOT NULL,
    entry_date      DATE    NOT NULL,
    hijri_date      TEXT,
    entry_type      TEXT    NOT NULL DEFAULT 'standard',
    source_type     TEXT    NOT NULL DEFAULT 'manual',
    source_id       UUID,
    description     TEXT    NOT NULL,
    reference_number TEXT,
    total_debit     NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_credit    NUMERIC(14,2) NOT NULL DEFAULT 0,
    status          TEXT    NOT NULL DEFAULT 'posted',
    voided_at       TIMESTAMPTZ,
    voided_by       TEXT,
    void_reason     TEXT,
    reversed_by_entry_id UUID,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    created_by      TEXT,
    posted_at       TIMESTAMPTZ DEFAULT NOW(),
    -- حقول إضافية
    supplier_invoice_number TEXT,
    supplier_invoice_date   DATE,
    due_date                DATE,
    includes_vat            BOOLEAN DEFAULT false,
    amount_before_vat       NUMERIC(14,2),
    vat_amount              NUMERIC(14,2),
    payment_method          TEXT,
    bank_name               TEXT,
    transaction_reference   TEXT,
    check_number            TEXT,
    check_date              DATE,
    check_status            TEXT,
    received_by             TEXT,
    adjustment_reason       TEXT,
    line_items              JSONB,
    cost_center             TEXT,
    document_urls           JSONB DEFAULT '[]'::jsonb
);

-- إضافة الأعمدة الناقصة إن وجد الجدول من قبل
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS supplier_invoice_number TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS supplier_invoice_date   DATE;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS due_date                DATE;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS includes_vat            BOOLEAN DEFAULT false;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS amount_before_vat       NUMERIC(14,2);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS vat_amount              NUMERIC(14,2);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS payment_method          TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS bank_name               TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS transaction_reference   TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS check_number            TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS check_date              DATE;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS check_status            TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS received_by             TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS adjustment_reason       TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS line_items              JSONB;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS cost_center             TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS document_urls           JSONB DEFAULT '[]'::jsonb;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS hijri_date              TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_type             TEXT DEFAULT 'manual';

-- ─── 3. جدول سطور القيود ───
CREATE TABLE IF NOT EXISTS journal_lines (
    id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID    NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number      INTEGER NOT NULL DEFAULT 1,
    account_id       UUID,
    supplier_id      UUID    REFERENCES suppliers(id),
    branch_id        UUID,
    debit            NUMERIC(14,2) NOT NULL DEFAULT 0,
    credit           NUMERIC(14,2) NOT NULL DEFAULT 0,
    description      TEXT,
    quantity         NUMERIC(14,3),
    unit_price       NUMERIC(14,2),
    item_type        TEXT,
    metadata         JSONB   DEFAULT '{}'
);

-- إضافة الأعمدة الناقصة
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS supplier_id  UUID REFERENCES suppliers(id);
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS branch_id    UUID;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS quantity     NUMERIC(14,3);
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS unit_price   NUMERIC(14,2);
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS item_type    TEXT;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS line_number  INTEGER DEFAULT 1;

-- ─── 4. الفهارس ───
CREATE INDEX IF NOT EXISTS idx_je_date        ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_je_status      ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_jl_entry       ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jl_supplier    ON journal_lines(supplier_id) WHERE supplier_id IS NOT NULL;

-- ─── 5. إضافة أعمدة الموردين ───
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance      NUMERIC(14,2) DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance_date DATE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credit_limit         NUMERIC(14,2);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_terms_days   INTEGER DEFAULT 30;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_number           TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_details         JSONB DEFAULT '{}';

-- ─── 6. تعطيل RLS تماماً ───
ALTER TABLE journal_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines   DISABLE ROW LEVEL SECURITY;

-- ─── 7. الصلاحيات الكاملة ───
GRANT ALL ON journal_entries TO anon, authenticated, service_role;
GRANT ALL ON journal_lines   TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ─── 8. اختبار سريع ───
DO $$
DECLARE
  v_num TEXT;
BEGIN
  v_num := next_entry_number();
  RAISE NOTICE 'next_entry_number() = %', v_num;
  RAISE NOTICE 'الإعداد تم بنجاح!';
END $$;

SELECT 'journal_entries' AS table_name, COUNT(*) AS rows FROM journal_entries
UNION ALL
SELECT 'journal_lines',                 COUNT(*) FROM journal_lines
UNION ALL
SELECT 'suppliers',                     COUNT(*) FROM suppliers;
