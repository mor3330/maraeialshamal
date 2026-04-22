-- ═══════════════════════════════════════════════════════════
-- حل بسيط ومباشر - تعطيل RLS وحذف السياسات
-- ═══════════════════════════════════════════════════════════

-- 1️⃣ تعطيل RLS على daily_reports
ALTER TABLE public.daily_reports DISABLE ROW LEVEL SECURITY;

-- 2️⃣ تعطيل RLS على branches
ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;

-- 3️⃣ تعطيل RLS على جميع الجداول المتبقية
ALTER TABLE IF EXISTS public.report_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_requests DISABLE ROW LEVEL SECURITY;

-- 4️⃣ منح صلاحيات كاملة
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 5️⃣ التحقق من النتائج
SELECT 
    'الفرع الجديد:' as check_type,
    COUNT(*) as count
FROM branches 
WHERE id = 'fe5f055d-f795-4d2b-8045-9b30586cc322';

SELECT 
    'تقارير الفرع:' as check_type,
    COUNT(*) as count
FROM daily_reports 
WHERE branch_id = 'fe5f055d-f795-4d2b-8045-9b30586cc322';

SELECT 
    'جميع التقارير:' as check_type,
    r.report_date,
    b.name as branch_name,
    r.total_sales
FROM daily_reports r
JOIN branches b ON r.branch_id = b.id
ORDER BY r.report_date DESC
LIMIT 10;
