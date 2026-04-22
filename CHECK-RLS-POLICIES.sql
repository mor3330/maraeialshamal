-- فحص سياسات RLS على جدول daily_reports

-- 1. التحقق من تفعيل RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'daily_reports';

-- 2. عرض جميع السياسات
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'daily_reports';

-- 3. فحص جميع التقارير مباشرة (بدون RLS)
SELECT 
  id,
  branch_id,
  report_date,
  status,
  total_sales,
  submitted_at,
  created_at
FROM daily_reports
ORDER BY report_date DESC, submitted_at DESC;
