-- ─────────────────────────────────────────────
-- جدول product_mappings: ربط أسماء منتجات Aronium بالفئات
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_mappings (
  aronium_name TEXT PRIMARY KEY,
  category     TEXT NOT NULL CHECK (category IN ('hashi','sheep','beef','offal','other')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- فهرس على category للبحث السريع
CREATE INDEX IF NOT EXISTS idx_product_mappings_category ON product_mappings (category);

-- RLS
ALTER TABLE product_mappings ENABLE ROW LEVEL SECURITY;

-- سماح القراءة للجميع (بدون مصادقة) لأن الكاشير يحتاجها
CREATE POLICY "product_mappings_read"
  ON product_mappings FOR SELECT
  USING (true);

-- سماح الكتابة فقط باستخدام service role
CREATE POLICY "product_mappings_write"
  ON product_mappings FOR ALL
  USING (true)
  WITH CHECK (true);

-- دالة تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_product_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_mappings_updated_at
  BEFORE UPDATE ON product_mappings
  FOR EACH ROW EXECUTE FUNCTION update_product_mappings_updated_at();
