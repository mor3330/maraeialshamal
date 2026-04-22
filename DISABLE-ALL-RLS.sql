-- ═══════════════════════════════════════════════════════════
-- تعطيل Row Level Security على جميع الجداول نهائياً
-- ═══════════════════════════════════════════════════════════
-- هذا السكريبت يحل مشكلة عدم ظهور التقارير/الفروع الجديدة

-- 1️⃣ تعطيل RLS على جميع جداول التقارير
ALTER TABLE IF EXISTS public.daily_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_meat_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_expenses DISABLE ROW LEVEL SECURITY;

-- 2️⃣ تعطيل RLS على جدول الفروع
ALTER TABLE IF EXISTS public.branches DISABLE ROW LEVEL SECURITY;

-- 3️⃣ تعطيل RLS على طلبات التقارير
ALTER TABLE IF EXISTS public.report_requests DISABLE ROW LEVEL SECURITY;

-- 4️⃣ تعطيل RLS على جداول المشتريات
ALTER TABLE IF EXISTS public.purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supplier_prices DISABLE ROW LEVEL SECURITY;

-- 5️⃣ تعطيل RLS على أنواع اللحوم
ALTER TABLE IF EXISTS public.item_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.step_fields DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_methods DISABLE ROW LEVEL SECURITY;

-- 6️⃣ حذف جميع السياسات الموجودة
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      r.policyname, r.schemaname, r.tablename);
    END LOOP;
END$$;

-- 7️⃣ منح صلاحيات كاملة لجميع الأدوار
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 8️⃣ تحديث schema cache في Supabase
NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════
-- ✅ التحقق من النتائج
-- ═══════════════════════════════════════════════════════════

-- عرض حالة RLS على جميع الجداول
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity = true THEN '❌ مفعّل'
        ELSE '✅ معطّل'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- عرض عدد السياسات المتبقية (يجب أن يكون 0)
SELECT COUNT(*) as remaining_policies
FROM pg_policies 
WHERE schemaname = 'public';

-- عرض جميع الفروع
SELECT id, name, slug, is_active 
FROM branches 
ORDER BY created_at DESC;

-- عرض جميع التقارير
SELECT 
    r.id,
    b.name as branch_name,
    r.report_date,
    r.total_sales,
    r.status
FROM daily_reports r
JOIN branches b ON r.branch_id = b.id
ORDER BY r.report_date DESC, r.created_at DESC
LIMIT 20;
