-- الحل النهائي: إزالة RLS تماماً + التحقق من الصلاحيات

-- 1. تعطيل RLS على جميع الجداول المرتبطة
ALTER TABLE IF EXISTS public.daily_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_meat_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_expenses DISABLE ROW LEVEL SECURITY;

-- 2. حذف جميع السياسات الموجودة
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('daily_reports', 'report_payments', 'report_meat_movements', 'report_expenses')) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END$$;

-- 3. منح صلاحيات كاملة
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. تحديث schema cache في Supabase
NOTIFY pgrst, 'reload schema';

-- 5. عرض النتائج للتأكد
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_reports';

SELECT COUNT(*) as total, report_date FROM daily_reports GROUP BY report_date ORDER BY report_date DESC;
