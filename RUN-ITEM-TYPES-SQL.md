# تشغيل SQL للأصناف

## الخطوات المطلوبة

### 1. افتح Supabase SQL Editor

### 2. شغّل هذا الكود:

```sql
-- Function لدفع ترتيب الأصناف تلقائياً
CREATE OR REPLACE FUNCTION increment_item_type_orders(start_order INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE item_types
  SET display_order = display_order + 1
  WHERE display_order >= start_order
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;
```

## ✅ بعد التشغيل:

- اذهب إلى صفحة "الأصناف" في Dashboard
- جرّب إضافة صنف جديد مثلاً "سواكني" برقم 3
- سيتم تلقائياً دفع الصنف القديم الذي كان رقم 3 إلى رقم 4

## 📝 ملاحظات:

- الترتيب الآن ديناميكي ولن تتكرر الأرقام
- عند التعديل، الأصناف الأخرى تتحرك تلقائياً
- تم إزالة حقل "الاسم بالإنجليزية" من الواجهة
