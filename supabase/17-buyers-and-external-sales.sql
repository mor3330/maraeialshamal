-- ═══════════════════════════════════════════════════════
-- 17 - جدول المشترين + تحديث جدول المبيعات الخارجية
-- ═══════════════════════════════════════════════════════

-- ── جدول المشترين (عملاء خارجيون) ──
CREATE TABLE IF NOT EXISTS buyers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── إضافة buyer_id لجدول external_sales ──
ALTER TABLE external_sales
  ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES buyers(id) ON DELETE SET NULL;

-- ── تحويل quantity من INTEGER إلى NUMERIC (يدعم الفواصل) ──
ALTER TABLE external_sales
  ALTER COLUMN quantity TYPE NUMERIC(10,4) USING quantity::NUMERIC;

-- ── نفس الإصلاح في جدول purchases ──
ALTER TABLE purchases
  ALTER COLUMN quantity TYPE NUMERIC(10,4) USING quantity::NUMERIC;

-- ── فهرس على buyer_id ──
CREATE INDEX IF NOT EXISTS idx_external_sales_buyer_id ON external_sales(buyer_id);

-- ── RLS ──
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_buyers" ON buyers;
CREATE POLICY "allow_all_buyers" ON buyers FOR ALL USING (true) WITH CHECK (true);
