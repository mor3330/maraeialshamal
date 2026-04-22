# 🔄 كيفية تحديث قاعدة البيانات

## الخطوة الأولى: تحديث جدول daily_reports

### 📋 الملف المطلوب:
```
supabase/01-add-step-values.sql
```

### 🎯 ماذا يفعل؟
يضيف أعمدة جديدة لجدول `daily_reports` لحفظ بيانات كل خطوة:

- `step1_values` → بيانات الوارد
- `step2_values` → بيانات المبيعات
- `step3_values` → تفاصيل المبيعات
- `step4_values` → الصادر
- `step5_values` → المتبقي
- `step6_values` → الأموال
- `step7_values` → المراجعة
- `expenses_list` → قائمة المصروفات

---

## 🚀 التنفيذ:

### في Supabase Dashboard:

1. افتح **SQL Editor**
2. New Query
3. انسخ محتوى `01-add-step-values.sql`
4. اضغط **Run**
5. انتظر "Success" ✓

---

## ✅ التحقق:

بعد التنفيذ، يمكنك التحقق بتشغيل:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'daily_reports' 
  AND column_name LIKE 'step%';
```

**النتيجة المتوقعة:**
```
step1_values | jsonb
step2_values | jsonb
step3_values | jsonb
step4_values | jsonb
step5_values | jsonb
step6_values | jsonb
step7_values | jsonb
```

---

## 📝 مثال على البيانات المحفوظة:

### step1_values (الوارد):
```json
{
  "field_id_1": "10",    // hashi_count
  "field_id_2": "250",   // hashi_weight
  "field_id_3": "5",     // sheep_count
  "field_id_4": "120"    // sheep_weight
}
```

### step6_values (الأموال):
```json
{
  "field_id_1": "5000",  // cash_amount
  "field_id_2": "3000",  // network_amount
  "field_id_3": "1000",  // transfer_amount
  "field_id_4": "1000"   // deferred_amount
}
```

### expenses_list (المصروفات):
```json
[
  {
    "description": "كهرباء",
    "amount": 500
  },
  {
    "description": "صيانة",
    "amount": 200
  }
]
```

---

**بعد تنفيذ هذا السكريبت، انتقل للجزء التالي →**
