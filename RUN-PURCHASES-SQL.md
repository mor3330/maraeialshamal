# 🔧 تشغيل SQL نظام المشتريات المحدث

## الخطوة 1: قم بتشغيل هذا SQL في Supabase

```sql
-- جدول أنواع الأصناف (للمشتريات)
CREATE TABLE IF NOT EXISTS item_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_en TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- إدراج الأصناف الافتراضية
INSERT INTO item_types (name, name_en, display_order) VALUES
('حاشي', 'hashi', 1),
('غنم', 'sheep', 2),
('عجل', 'beef', 3),
('مخلفات', 'offal', 4)
ON CONFLICT (name) DO NOTHING;

-- فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_item_types_active ON item_types(is_active);
CREATE INDEX IF NOT EXISTS idx_item_types_order ON item_types(display_order);
```

## الخطوة 2: تم تحديث النظام

✅ تم إضافة APIs:
- `/api/item-types` (GET, POST, PUT, DELETE)
- `/api/suppliers` تم تحديثه (GET, POST, PUT, DELETE)

✅ التعديلات:
- إزالة حقل "النوع" من نموذج الإضافة
- تحويل زر "إضافة مورد" لصفحة إدارة كاملة
- إضافة زر "الأصناف" للإدارة

**جاهز للاستخدام! 🚀**
