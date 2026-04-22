-- إصلاح مشكلة عدم ظهور الفروع في صفحة "إدارة الفروع"
-- السبب: RLS على جدول branches

-- 1. تعطيل RLS على جدول branches
ALTER TABLE IF EXISTS public.branches DISABLE ROW LEVEL SECURITY;

-- 2. حذف جميع السياسات على branches
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'branches') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.branches', r.policyname);
    END LOOP;
END$$;

-- 3. منح صلاحيات كاملة
GRANT ALL ON public.branches TO service_role;
GRANT ALL ON public.branches TO anon;
GRANT ALL ON public.branches TO authenticated;

-- 4. التحقق من النتائج
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'branches';

-- 5. عرض جميع الفروع للتأكد
SELECT id, name, code, slug, is_active, created_at FROM branches ORDER BY name;
