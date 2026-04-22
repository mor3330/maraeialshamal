-- إصلاح مشكلة RLS على جدول daily_reports
-- المشكلة: RLS يمنع ظهور كل التقارير في الداش بورد وسجل التقارير
-- الحل: تعطيل RLS لأننا نستخدم Service Role Key في الـ API

-- 1. تعطيل RLS على جدول daily_reports
ALTER TABLE public.daily_reports DISABLE ROW LEVEL SECURITY;

-- 2. حذف جميع السياسات القديمة إن وجدت
DROP POLICY IF EXISTS "Enable read access for service role" ON public.daily_reports;
DROP POLICY IF EXISTS "Enable insert for service role" ON public.daily_reports;
DROP POLICY IF EXISTS "Enable update for service role" ON public.daily_reports;
DROP POLICY IF EXISTS "Enable delete for service role" ON public.daily_reports;
DROP POLICY IF EXISTS "Allow full access to service role" ON public.daily_reports;
DROP POLICY IF EXISTS "Allow read for all users" ON public.daily_reports;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.daily_reports;

-- 3. منح صلاحيات كاملة للجداول المرتبطة (للتأكد)
GRANT ALL ON public.daily_reports TO service_role;
GRANT ALL ON public.daily_reports TO anon;
GRANT ALL ON public.daily_reports TO authenticated;

-- 4. التحقق من النتائج
SELECT 
  tablename, 
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'daily_reports';

-- 5. عرض جميع التقارير للتأكد
SELECT 
  COUNT(*) as total_reports,
  COUNT(DISTINCT report_date) as unique_dates,
  MIN(report_date) as earliest_date,
  MAX(report_date) as latest_date
FROM daily_reports;

SELECT 
  report_date,
  COUNT(*) as count_per_date
FROM daily_reports
GROUP BY report_date
ORDER BY report_date DESC;
