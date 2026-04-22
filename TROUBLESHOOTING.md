# 🔧 حل مشكلة الإرسال

## ❌ الخطأ:
```
insert or update on table "daily_reports" violates foreign key constraint "daily_reports_branch_id_fkey"
```

## 🔍 السبب:
الـ `branch_id` المرسل غير موجود في جدول `branches`

---

## ✅ الحل السريع:

### الخيار 1: تنفيذ السكريبت الكامل
نفّذ `final-schema.sql` في Supabase - يحتوي على فروع جاهزة

### الخيار 2: إضافة فرع يدوياً
```sql
-- في Supabase SQL Editor
INSERT INTO branches (name, code, slug, pin_hash, is_active) VALUES
  ('فرع الاختبار', 'TEST', 'test', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true);
```

### الخيار 3: التحقق من الفروع الموجودة
```sql
-- عرض جميع الفروع
SELECT id, name, slug FROM branches WHERE is_active = true;
```

---

## 🎯 خطوات التحقق:

1. **تحقق من وجود الفروع:**
   ```sql
   SELECT * FROM branches;
   ```

2. **إذا لا توجد فروع، نفّذ:**
   ```sql
   -- من ملف final-schema.sql
   INSERT INTO branches (name, code, slug, pin_hash) VALUES
     ('فرع العليا', 'OLAYA', 'olaya', '$2b$10$...'),
     ('فرع النخيل', 'NAKHEEL', 'nakheel', '$2b$10$...'),
     ('فرع الملز', 'MALAZ', 'malaz', '$2b$10$...');
   ```

3. **أعد المحاولة**

---

## 📝 ملاحظة:
PIN الافتراضي لكل الفروع: **1234**
