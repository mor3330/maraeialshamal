-- ═══════════════════════════════════════════════════════════
-- Migration 27: إضافة أعمدة تفصيلية لجداول sales و sale_items
-- شغّل هذا في Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─── 1. أعمدة جديدة في جدول sales ──────────────────────────
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS discount        NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax             NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note            TEXT,
  ADD COLUMN IF NOT EXISTS cash_amount     NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS network_amount  NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deferred_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashier_id      INTEGER;

-- mixed_cash_amount / mixed_network_amount كانت موجودة من migration 22
-- نبقيها للتوافق مع الإصدارات القديمة
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS mixed_cash_amount    NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mixed_network_amount NUMERIC(12,2) DEFAULT 0;

-- ─── 2. أعمدة جديدة في جدول sale_items ─────────────────────
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS product_id    INTEGER,
  ADD COLUMN IF NOT EXISTS barcode       TEXT,
  ADD COLUMN IF NOT EXISTS item_discount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_tax      NUMERIC(12,2) DEFAULT 0;

-- ─── 3. إضافة agent_version لـ sync_logs (إذا ما كانت موجودة) ─
ALTER TABLE sync_logs
  ADD COLUMN IF NOT EXISTS agent_version TEXT;

-- ─── 4. Index للبحث بالباركود ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sale_items_barcode     ON sale_items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id  ON sale_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_payment_method   ON sales(branch_id, payment_method);

-- ─── 5. تحقق ────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'sales' ORDER BY ordinal_position;
