-- ═══════════════════════════════════════════════════════════
-- Migration 13: جداول مزامنة Aronium POS
-- شغّل هذا في Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─── 1. جدول الفواتير (sales) ───────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id             UUID        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  aronium_document_id   INTEGER     NOT NULL,
  invoice_number        TEXT        NOT NULL,
  document_type         TEXT        NOT NULL DEFAULT 'sale',  -- sale | refund
  sale_date             TIMESTAMPTZ NOT NULL,
  date_created          TIMESTAMPTZ NOT NULL,
  total                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount           NUMERIC(12,2) DEFAULT 0,
  payment_method        TEXT,        -- cash | network | transfer | deferred | mixed
  cashier_name          TEXT,
  synced_at             TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_branch_document UNIQUE (branch_id, aronium_document_id)
);

-- ─── 2. جدول أصناف الفواتير (sale_items) ────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id               UUID        NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  branch_id             UUID        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  aronium_document_id   INTEGER     NOT NULL,
  product_name          TEXT,
  quantity              NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total                 NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ─── 3. جدول سجلات المزامنة (sync_logs) ─────────────────
CREATE TABLE IF NOT EXISTS sync_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  sync_start    TIMESTAMPTZ DEFAULT NOW(),
  sync_end      TIMESTAMPTZ,
  sales_count   INTEGER     DEFAULT 0,
  items_count   INTEGER     DEFAULT 0,
  status        TEXT        DEFAULT 'running',  -- running | success | failed
  error_message TEXT
);

-- ─── 4. جدول ربط أسماء المنتجات بالأنواع (product_mappings) ─
-- يُستخدم لربط الأسماء الحرة من Aronium بـ item_types المنظّمة
CREATE TABLE IF NOT EXISTS product_mappings (
  aronium_name  TEXT        PRIMARY KEY,        -- الاسم كما يظهر في Aronium
  item_type_id  UUID        REFERENCES item_types(id) ON DELETE SET NULL,
  meat_type_id  UUID        REFERENCES meat_types(id) ON DELETE SET NULL,
  category      TEXT,                           -- hashi | sheep | beef | offal
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. Indexes للأداء ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sales_branch_date    ON sales(branch_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_date           ON sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale      ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_branch    ON sale_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_branch     ON sync_logs(branch_id, sync_start DESC);

-- ─── 6. RLS Policies ────────────────────────────────────
ALTER TABLE sales          DISABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items     DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs      DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_mappings DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════
-- تحقق بعد التنفيذ:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('sales','sale_items','sync_logs','product_mappings');
-- ═══════════════════════════════════════════════════════════
