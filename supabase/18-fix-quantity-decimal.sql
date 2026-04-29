-- ========================================================
-- إصلاح: تحويل عمود quantity في جدول purchases
-- من INTEGER إلى NUMERIC حتى يقبل القيم العشرية مثل 0.25
-- ========================================================

ALTER TABLE purchases
  ALTER COLUMN quantity TYPE NUMERIC(10,4);

-- التحقق
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'purchases' AND column_name = 'quantity';
