-- ========================================================
-- إضافة عمود meat_category لجدول item_types
-- شغّل هذا الملف في Supabase SQL Editor
-- ========================================================

-- إضافة العمود إن لم يكن موجوداً
ALTER TABLE item_types
  ADD COLUMN IF NOT EXISTS meat_category TEXT
  CHECK (meat_category IN ('hashi','sheep','beef','offal'));

COMMENT ON COLUMN item_types.meat_category IS
  'hashi=حاشي, sheep=غنم, beef=عجل, offal=مخلفات';

-- تحديث تلقائي للأصناف الموجودة بناءً على الاسم (اختياري - يمكن تعديله)
-- حاشي
UPDATE item_types SET meat_category = 'hashi'
WHERE meat_category IS NULL
  AND (name ILIKE '%حاشي%' OR name ILIKE '%hashi%');

-- غنم (وكل الأصناف الفرعية)
UPDATE item_types SET meat_category = 'sheep'
WHERE meat_category IS NULL
  AND (
    name ILIKE '%غنم%' OR name ILIKE '%سواكني%' OR name ILIKE '%حري%'
    OR name ILIKE '%نعيمي%' OR name ILIKE '%خروف%' OR name ILIKE '%روماني%'
    OR name ILIKE '%رفيدي%' OR name ILIKE '%تيس%' OR name ILIKE '%sheep%'
  );

-- عجل
UPDATE item_types SET meat_category = 'beef'
WHERE meat_category IS NULL
  AND (name ILIKE '%عجل%' OR name ILIKE '%beef%' OR name ILIKE '%بقر%');

-- مخلفات
UPDATE item_types SET meat_category = 'offal'
WHERE meat_category IS NULL
  AND (
    name ILIKE '%مخلف%' OR name ILIKE '%كبد%' OR name ILIKE '%راس%'
    OR name ILIKE '%رأس%' OR name ILIKE '%كراع%' OR name ILIKE '%معاصب%'
    OR name ILIKE '%لحم%' OR name ILIKE '%offal%'
  );

SELECT id, name, meat_category, pricing_method FROM item_types ORDER BY display_order;
