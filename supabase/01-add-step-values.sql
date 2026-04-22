-- ============================================================
-- إضافة أعمدة لحفظ بيانات كل خطوة
-- ============================================================

-- إضافة أعمدة JSONB لحفظ قيم كل خطوة
ALTER TABLE daily_reports 
  ADD COLUMN IF NOT EXISTS step1_values JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS step2_values JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS step3_values JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS step4_values JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS step5_values JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS step6_values JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS step7_values JSONB DEFAULT '{}'::jsonb;

-- إضافة عمود للمصروفات
ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS expenses_list JSONB DEFAULT '[]'::jsonb;

-- إضافة تعليق توضيحي
COMMENT ON COLUMN daily_reports.step1_values IS 'بيانات الخطوة 1: الوارد';
COMMENT ON COLUMN daily_reports.step2_values IS 'بيانات الخطوة 2: المبيعات';
COMMENT ON COLUMN daily_reports.step3_values IS 'بيانات الخطوة 3: تفاصيل المبيعات';
COMMENT ON COLUMN daily_reports.step4_values IS 'بيانات الخطوة 4: الصادر';
COMMENT ON COLUMN daily_reports.step5_values IS 'بيانات الخطوة 5: المتبقي';
COMMENT ON COLUMN daily_reports.step6_values IS 'بيانات الخطوة 6: الأموال';
COMMENT ON COLUMN daily_reports.step7_values IS 'بيانات الخطوة 7: المراجعة والمصروفات';
COMMENT ON COLUMN daily_reports.expenses_list IS 'قائمة المصروفات [{description, amount}]';

-- ✅ تم!
