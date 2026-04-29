-- إضافة عمود تصنيف الفئة لجدول item_types
ALTER TABLE item_types
  ADD COLUMN IF NOT EXISTS meat_category TEXT
  CHECK (meat_category IN ('hashi','sheep','beef','offal'));

-- تعليق للتوضيح
COMMENT ON COLUMN item_types.meat_category IS
  'hashi=حاشي, sheep=غنم, beef=عجل, offal=مخلفات';
