-- عرض الفروع الموجودة حالياً
SELECT id, name, slug, is_active FROM branches ORDER BY name;

-- ملاحظة: الفروع موجودة بالفعل!
-- إذا أردت إضافة فروع جديدة، استخدم:
-- INSERT INTO branches (name, slug, is_active) VALUES
-- ('فرع جديد', 'new-branch', true);
