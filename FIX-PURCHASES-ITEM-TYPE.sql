-- إضافة عمود item_type_id فقط (العمود القديم محذوف بالفعل)
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS item_type_id UUID REFERENCES item_types(id) ON DELETE RESTRICT;

-- تحقق
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'purchases'
ORDER BY ordinal_position;
