-- ═══════════════════════════════════════════════════════════
-- فحص جميع الفروع في قاعدة البيانات
-- ═══════════════════════════════════════════════════════════

-- 1️⃣ عدد الفروع الإجمالي
SELECT 
    'إجمالي الفروع:' as info,
    COUNT(*) as total_count
FROM branches;

-- 2️⃣ جميع الفروع مع تفاصيلها
SELECT 
    'قائمة الفروع:' as info,
    id,
    name,
    code,
    slug,
    is_active
FROM branches
ORDER BY name;

-- 3️⃣ الفروع النشطة فقط
SELECT 
    'الفروع النشطة:' as info,
    COUNT(*) as active_count
FROM branches
WHERE is_active = true;

-- 4️⃣ الفروع حسب الحالة
SELECT 
    'توزيع الفروع:' as info,
    CASE 
        WHEN is_active = true THEN 'نشط'
        ELSE 'غير نشط'
    END as status,
    COUNT(*) as count
FROM branches
GROUP BY is_active;

-- 5️⃣ التحقق من التكرار في الأسماء
SELECT 
    'فروع مكررة:' as info,
    name,
    COUNT(*) as count
FROM branches
GROUP BY name
HAVING COUNT(*) > 1;

-- 6️⃣ التحقق من التكرار في الـ slug
SELECT 
    'slug مكرر:' as info,
    slug,
    COUNT(*) as count
FROM branches
GROUP BY slug
HAVING COUNT(*) > 1;

-- ═══════════════════════════════════════════════════════════
-- النتائج المتوقعة:
-- - إجمالي الفروع: 22+
-- - إذا ظهر أقل، قد تكون المشكلة في الواجهة (caching)
-- ═══════════════════════════════════════════════════════════
