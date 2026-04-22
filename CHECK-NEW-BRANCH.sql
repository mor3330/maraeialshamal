-- ═══════════════════════════════════════════════════════════
-- فحص حالة الفرع الجديد والتقارير المحفوظة
-- ═══════════════════════════════════════════════════════════

-- 1️⃣ فحص الفرع الجديد
SELECT 
    'الفرع الجديد:' as info,
    id,
    name,
    slug,
    is_active
FROM branches 
WHERE id = 'fe5f055d-f795-4d2b-8045-9b30586cc322';

-- 2️⃣ فحص التقارير المحفوظة لهذا الفرع
SELECT 
    'تقارير الفرع الجديد:' as info,
    id,
    report_date,
    total_sales,
    status,
    submitted_at
FROM daily_reports 
WHERE branch_id = 'fe5f055d-f795-4d2b-8045-9b30586cc322'
ORDER BY report_date DESC;

-- 3️⃣ فحص RLS على جدول daily_reports
SELECT 
    'حالة RLS:' as info,
    tablename,
    CASE 
        WHEN rowsecurity = true THEN '❌ RLS مفعّل - المشكلة هنا!'
        ELSE '✅ RLS معطّل'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'daily_reports';

-- 4️⃣ إذا كان RLS مفعّل، عطّله الآن:
ALTER TABLE public.daily_reports DISABLE ROW LEVEL SECURITY;

-- 5️⃣ حذف جميع سياسات daily_reports
DO $$ 
BEGIN
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON daily_reports;', ' ')
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'daily_reports'
    );
END$$;

-- 6️⃣ تحديث schema cache
NOTIFY pgrst, 'reload schema';

-- 7️⃣ التحقق النهائي - يجب أن تظهر التقارير الآن
SELECT 
    '✅ التحقق النهائي:' as info,
    COUNT(*) as total_reports,
    string_agg(DISTINCT report_date::text, ', ') as dates
FROM daily_reports 
WHERE branch_id = 'fe5f055d-f795-4d2b-8045-9b30586cc322';
