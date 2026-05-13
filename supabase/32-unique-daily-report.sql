-- ✅ منع تكرار التقارير (Race Condition Fix)
-- المشكلة: لو ضغط موظفان "إرسال" بنفس الثانية لنفس الفرع، يصير check-then-insert race
--          → ينشأ تقريران مكرران أو تتداخل البيانات
-- الحل: UNIQUE constraint على (branch_id, report_date) + استخدام upsert في الكود

-- 1) احذف التكرارات الموجودة (إن وُجدت) قبل إضافة القيد
-- نحتفظ بالأحدث (submitted_at الأكبر) لكل (branch_id, report_date)
-- إذا submitted_at NULL، نرتّب بالـ id (UUID lexicographic — يكفي للاختيار غير المتعارض)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY branch_id, report_date
           ORDER BY submitted_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM daily_reports
)
DELETE FROM daily_reports
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) أضف UNIQUE constraint (إذا لم يكن موجوداً)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_reports_branch_date_unique'
  ) THEN
    ALTER TABLE daily_reports
      ADD CONSTRAINT daily_reports_branch_date_unique
      UNIQUE (branch_id, report_date);
  END IF;
END$$;

-- 3) فهرس لتسريع الاستعلامات
CREATE INDEX IF NOT EXISTS idx_daily_reports_branch_date
  ON daily_reports (branch_id, report_date);

-- ✅ بعد هذا، أي محاولة إدراج صف بنفس (branch_id, report_date) ستفشل
--    والكود يستخدم upsert (ON CONFLICT) ليحدّث بدلاً من ينشئ تكرار
