# 🔍 فحص بيانات التقارير

## المشكلة المحتملة:
البيانات المدخلة من الكاشير لا تظهر بشكل صحيح في الداشبورد

## 🧪 الخطوات للتشخيص:

### 1. افحص أحدث تقرير من **كل** فرع

افتح **Supabase SQL Editor** وشغّل:

```sql
-- عرض آخر تقرير من كل فرع
SELECT 
  b.name as branch_name,
  b.slug as branch_slug,
  dr.report_date,
  dr.total_sales,
  dr.cash_expected,
  dr.cash_actual,
  dr.cash_difference,
  dr.submitted_at,
  CASE 
    WHEN dr.notes IS NULL THEN 'لا توجد ملاحظات'
    WHEN jsonb_typeof(dr.notes) = 'null' THEN 'notes فارغة'
    WHEN dr.notes::text = '{}' THEN 'notes فارغة ({})'
    ELSE 'موجودة'
  END as notes_status,
  LENGTH(dr.notes::text) as notes_length
FROM branches b
LEFT JOIN LATERAL (
  SELECT * 
  FROM daily_reports 
  WHERE branch_id = b.id 
  ORDER BY submitted_at DESC 
  LIMIT 1
) dr ON true
ORDER BY b.name;
```

### 2. افحص محتوى `notes` بالتفصيل لكل فرع:

```sql
-- عرض notes لآخر تقرير من كل فرع
SELECT 
  b.name as branch_name,
  dr.report_date,
  jsonb_pretty(dr.notes) as notes_data
FROM branches b
LEFT JOIN LATERAL (
  SELECT * 
  FROM daily_reports 
  WHERE branch_id = b.id 
  ORDER BY submitted_at DESC 
  LIMIT 1
) dr ON true
WHERE dr.id IS NOT NULL
ORDER BY b.name;
```

### 3. فحص شامل لكل الفروع والبيانات المفقودة:

```sql
-- فحص ما إذا كانت بيانات الخطوات موجودة
SELECT 
  b.name as branch_name,
  dr.report_date,
  dr.total_sales,
  (dr.notes::jsonb->'step1Named') IS NOT NULL as has_step1,
  (dr.notes::jsonb->'step2Named') IS NOT NULL as has_step2,
  (dr.notes::jsonb->'step3Named') IS NOT NULL as has_step3,
  (dr.notes::jsonb->'step4Named') IS NOT NULL as has_step4,
  (dr.notes::jsonb->'step5Named') IS NOT NULL as has_step5,
  (dr.notes::jsonb->'step6Named') IS NOT NULL as has_step6,
  (dr.notes::jsonb->'previousBalance') IS NOT NULL as has_previous_balance,
  (dr.notes::jsonb->'payments') IS NOT NULL as has_payments,
  (dr.notes::jsonb->'expenses') IS NOT NULL as has_expenses
FROM branches b
LEFT JOIN LATERAL (
  SELECT * 
  FROM daily_reports 
  WHERE branch_id = b.id 
  ORDER BY submitted_at DESC 
  LIMIT 1
) dr ON true
WHERE dr.id IS NOT NULL
ORDER BY b.name;
```

## 📊 ما الذي نبحث عنه؟

### يجب أن تحتوي `notes` على:

```json
{
  "step1Named": {
    "hashi_weight": رقم,
    "sheep_weight": رقم,
    "beef_weight": رقم,
    ...
  },
  "step2Named": {
    "total_sales": رقم,
    "invoice_count": رقم,
    ...
  },
  "step3Named": {
    "hashi_bone_weight": رقم,
    "hashi_bone_price": رقم,
    ...
  },
  "payments": [
    {"methodCode": "cash", "amount": رقم},
    ...
  ],
  "expenses": [
    {"description": "...", "amount": رقم}
  ],
  "previousBalance": {
    "hashi": رقم,
    "sheep": رقم,
    "beef": رقم
  }
}
```

## ⚠️ مشاكل محتملة:

### 1. البيانات محفوظة لكن لا تظهر في الداشبورد
**السبب**: الداشبورد يستخرج البيانات من `notes` بطريقة خاطئة

### 2. البيانات غير محفوظة بشكل صحيح
**السبب**: مشكلة في إرسال البيانات من الكاشير

### 3. previousBalance غير موجود
**السبب**: لم يتم حساب رصيد أمس بشكل صحيح

## 🔧 الحل المقترح:

### إذا كانت البيانات محفوظة بشكل صحيح في `notes`:
المشكلة في **عرض البيانات** في الداشبورد

### إذا كانت البيانات ناقصة في `notes`:
المشكلة في **إرسال البيانات** من الكاشير

## 📝 النتيجة المتوقعة:

بعد تشغيل SQL أعلاه:
- إذا رأيت كل البيانات في `notes` → المشكلة في العرض
- إذا كانت `notes` فارغة أو ناقصة → المشكلة في الإرسال

**شغّل SQL واخبرني بالنتيجة!**
