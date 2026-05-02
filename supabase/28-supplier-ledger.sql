-- ══════════════════════════════════════════════════════
--  28 - نظام المحاسبة المزدوجة للموردين
--  Supplier Accounting / Double-Entry Ledger
-- ══════════════════════════════════════════════════════

-- 1) دليل الحسابات (Chart of Accounts)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT        UNIQUE NOT NULL,
    name_ar     TEXT        NOT NULL,
    name_en     TEXT,
    account_type TEXT       NOT NULL
        CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
    parent_id   UUID        REFERENCES chart_of_accounts(id),
    is_active   BOOLEAN     DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- البيانات الأساسية لدليل الحسابات
INSERT INTO chart_of_accounts (code, name_ar, name_en, account_type) VALUES
  ('1000', 'النقدية والبنوك',       'Cash & Banks',            'asset'),
  ('1100', 'الصندوق',               'Cash on Hand',            'asset'),
  ('1200', 'البنك الرئيسي',         'Main Bank Account',       'asset'),
  ('2000', 'الالتزامات المتداولة',  'Current Liabilities',     'liability'),
  ('2100', 'ذمم الموردين',          'Accounts Payable',        'liability'),
  ('5000', 'تكلفة المشتريات',       'Cost of Purchases',       'expense'),
  ('5100', 'مشتريات حاشي',         'Hashi Purchases',         'expense'),
  ('5200', 'مشتريات غنم',          'Sheep Purchases',         'expense'),
  ('5300', 'مشتريات عجل',          'Beef Purchases',          'expense')
ON CONFLICT (code) DO NOTHING;

-- 2) جدول الفترات المالية
CREATE TABLE IF NOT EXISTS fiscal_periods (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    period_name TEXT    NOT NULL,
    start_date  DATE    NOT NULL,
    end_date    DATE    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','closed','locked')),
    closed_at   TIMESTAMPTZ,
    closed_by   TEXT,
    locked_at   TIMESTAMPTZ,
    locked_by   TEXT,
    notes       TEXT,
    CONSTRAINT period_dates CHECK (end_date >= start_date)
);

-- 3) قيود اليومية (Journal Entries) — صدر الحقيقة
CREATE TABLE IF NOT EXISTS journal_entries (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number    TEXT    UNIQUE NOT NULL,   -- JE-2026-00001
    entry_date      DATE    NOT NULL,
    hijri_date      TEXT,
    fiscal_period_id UUID   REFERENCES fiscal_periods(id),

    entry_type      TEXT    NOT NULL DEFAULT 'standard'
        CHECK (entry_type IN ('standard','opening','purchase','payment','adjustment','reversing','closing')),
    source_type     TEXT    NOT NULL DEFAULT 'manual'
        CHECK (source_type IN ('manual','purchase','payment','expense','system')),
    source_id       UUID,                      -- مرجع للمشتريات مثلاً

    description     TEXT    NOT NULL,
    reference_number TEXT,

    total_debit     NUMERIC(14,2) NOT NULL,
    total_credit    NUMERIC(14,2) NOT NULL,

    status          TEXT    NOT NULL DEFAULT 'posted'
        CHECK (status IN ('draft','posted','voided','reversed')),
    voided_at       TIMESTAMPTZ,
    voided_by       TEXT,
    void_reason     TEXT,
    reversed_by_entry_id UUID REFERENCES journal_entries(id),

    attachments     JSONB   DEFAULT '[]',
    notes           TEXT,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    created_by      TEXT,
    posted_at       TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT balanced_entry CHECK (total_debit = total_credit)
);

CREATE INDEX IF NOT EXISTS idx_je_date   ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_je_source ON journal_entries(source_id) WHERE source_id IS NOT NULL;

-- 4) سطور القيود (Journal Lines)
CREATE TABLE IF NOT EXISTS journal_lines (
    id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID    NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number      INTEGER NOT NULL,

    account_id       UUID    REFERENCES chart_of_accounts(id),
    supplier_id      UUID    REFERENCES suppliers(id),
    branch_id        UUID    REFERENCES branches(id),

    debit            NUMERIC(14,2) NOT NULL DEFAULT 0,
    credit           NUMERIC(14,2) NOT NULL DEFAULT 0,

    description      TEXT,
    quantity         NUMERIC(14,3),
    unit_price       NUMERIC(14,2),
    item_type        TEXT,   -- 'hashi' | 'sheep' | 'beef' | 'offal' | 'other'

    metadata         JSONB   DEFAULT '{}',

    CONSTRAINT positive_amounts CHECK (debit >= 0 AND credit >= 0),
    CONSTRAINT one_side_only    CHECK (
        (debit > 0 AND credit = 0) OR
        (credit > 0 AND debit = 0) OR
        (debit = 0 AND credit = 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_jl_entry    ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jl_supplier ON journal_lines(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jl_branch   ON journal_lines(branch_id)   WHERE branch_id IS NOT NULL;

-- 5) إضافة حقل الرصيد الافتتاحي للموردين إذا لم يكن موجوداً
ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS opening_balance      NUMERIC(14,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS opening_balance_date DATE,
    ADD COLUMN IF NOT EXISTS credit_limit         NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS payment_terms_days   INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS tax_number           TEXT,
    ADD COLUMN IF NOT EXISTS bank_details         JSONB DEFAULT '{}';

-- 6) View لكشف حساب المورد مع الرصيد الجاري
CREATE OR REPLACE VIEW supplier_statement AS
SELECT
    je.id             AS entry_id,
    je.entry_number,
    je.entry_date,
    je.hijri_date,
    je.description,
    je.reference_number,
    je.entry_type,
    je.status,
    je.source_type,
    je.source_id,
    je.created_at,
    jl.supplier_id,
    jl.debit,
    jl.credit,
    jl.description    AS line_description,
    jl.quantity,
    jl.unit_price,
    jl.item_type,
    -- الرصيد الجاري المتراكم (مدين - دائن)
    SUM(jl.debit - jl.credit) OVER (
        PARTITION BY jl.supplier_id
        ORDER BY je.entry_date, je.entry_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_balance
FROM journal_entries je
JOIN journal_lines jl ON jl.journal_entry_id = je.id
WHERE je.status = 'posted'
ORDER BY je.entry_date, je.entry_number;

-- 7) Function لتوليد رقم القيد تلقائياً
CREATE OR REPLACE FUNCTION next_entry_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    y    TEXT := to_char(NOW() AT TIME ZONE 'Asia/Riyadh', 'YYYY');
    seq  INTEGER;
BEGIN
    SELECT COALESCE(MAX(
        NULLIF(regexp_replace(entry_number, '^JE-\d{4}-0*', ''), '')::INTEGER
    ), 0) + 1
    INTO seq
    FROM journal_entries
    WHERE entry_number LIKE 'JE-' || y || '-%';
    RETURN 'JE-' || y || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;
