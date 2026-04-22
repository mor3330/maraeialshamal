-- ── جدول المبيعات الخارجية ──
-- نفس هيكل جدول purchases تماماً
CREATE TABLE IF NOT EXISTS external_sales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  supplier_id   UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  item_type_id  UUID NOT NULL REFERENCES item_types(id) ON DELETE RESTRICT,
  sale_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity      INTEGER NOT NULL DEFAULT 0,
  weight        NUMERIC(10,3) NOT NULL DEFAULT 0,
  price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_external_sales_branch_id  ON external_sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_external_sales_sale_date  ON external_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_external_sales_item_type  ON external_sales(item_type_id);

-- تعطيل RLS (نفس المشتريات)
ALTER TABLE external_sales DISABLE ROW LEVEL SECURITY;
