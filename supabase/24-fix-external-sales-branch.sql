-- ── إصلاح: جعل branch_id اختيارياً في external_sales ──
-- المبيعات الخارجية لا تنتمي بالضرورة لفرع معين

-- إزالة قيد NOT NULL من branch_id
ALTER TABLE external_sales ALTER COLUMN branch_id DROP NOT NULL;

-- إضافة buyer_id إذا لم تكن موجودة (للتأكد)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_sales' AND column_name = 'buyer_id'
  ) THEN
    ALTER TABLE external_sales ADD COLUMN buyer_id UUID REFERENCES buyers(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_external_sales_buyer ON external_sales(buyer_id);
  END IF;
END $$;

-- تحديث الـ index ليقبل NULL
DROP INDEX IF EXISTS idx_external_sales_branch_id;
CREATE INDEX IF NOT EXISTS idx_external_sales_branch_id ON external_sales(branch_id) WHERE branch_id IS NOT NULL;
