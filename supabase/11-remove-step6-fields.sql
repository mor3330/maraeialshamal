-- ══════════════════════════════════════════════════════════════
-- حذف حقول خطوة الأموال (step 6) - تم نقلها لخطوة المبيعات (step 2)
-- شغّل هذا في Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- أولاً: تحقق من الحقول الموجودة في step 6
SELECT id, step, field_name, field_label FROM step_fields WHERE step = 6;

-- ثانياً: احذف جميع حقول step 6
DELETE FROM step_fields WHERE step = 6;

-- تحقق من الحذف
SELECT COUNT(*) AS remaining_step6_fields FROM step_fields WHERE step = 6;
