-- تعديلات على حقول الخطوات
-- 1. حذف حقول بالعظم/صافي من step 3 (المبيعات)
-- 2. إضافة حقول المخلفات في step 5 (المتبقي)

-- حذف الحقول القديمة من step 3
DELETE FROM step_fields 
WHERE step = 3 
AND field_name IN (
  'hashi_bone_weight', 'hashi_bone_price',
  'hashi_clean_weight', 'hashi_clean_price',
  'beef_bone_weight', 'beef_bone_price',
  'beef_clean_weight', 'beef_clean_price'
);

-- إضافة حقول جديدة لـ step 3 (الحاشي والعجل بدون تفصيل)
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order)
VALUES
  -- حاشي (بدل بالعظم والصافي)
  (3, 'hashi_weight', 'حاشي - الوزن (كجم)', 'number', true, 10),
  (3, 'hashi_price', 'حاشي - السعر (ريال)', 'number', true, 11),
  
  -- عجل (بدل بالعظم والصافي)
  (3, 'beef_weight', 'عجل - الوزن (كجم)', 'number', true, 30),
  (3, 'beef_price', 'عجل - السعر (ريال)', 'number', true, 31)
ON CONFLICT (step, field_name) DO NOTHING;

-- إضافة حقول المخلفات في step 5
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order)
VALUES
  (5, 'hashi_offal', 'مخلفات الحاشي (كجم)', 'number', false, 11),
  (5, 'sheep_offal', 'مخلفات الغنم (كجم)', 'number', false, 21),
  (5, 'beef_offal', 'مخلفات العجل (كجم)', 'number', false, 31)
ON CONFLICT (step, field_name) DO NOTHING;

-- تحديث ترتيب الحقول في step 5 للتوضيح
UPDATE step_fields SET sort_order = 10 WHERE step = 5 AND field_name = 'hashi_remaining';
UPDATE step_fields SET sort_order = 11 WHERE step = 5 AND field_name = 'hashi_offal';
UPDATE step_fields SET sort_order = 20 WHERE step = 5 AND field_name = 'sheep_remaining';
UPDATE step_fields SET sort_order = 21 WHERE step = 5 AND field_name = 'sheep_offal';
UPDATE step_fields SET sort_order = 30 WHERE step = 5 AND field_name = 'beef_remaining';
UPDATE step_fields SET sort_order = 31 WHERE step = 5 AND field_name = 'beef_offal';
