# 🛒 نظام المشتريات

## نظرة عامة
نظام شامل لإدارة المشتريات اليومية لكل الفروع مع تتبع الموردين والأصناف.

## المميزات
- ✅ إضافة مشتريات يومية
- ✅ تتبع الموردين
- ✅ 4 أصناف (حاشي، غنم، عجل، مخلفات)
- ✅ تسجيل العدد، الوزن، والسعر
- ✅ فلترة متقدمة (فرع، مورد، صنف، تاريخ)
- ✅ إحصائيات فورية
- ✅ واجهة إبداعية وسهلة

## قاعدة البيانات

### جدول suppliers
```sql
- id: UUID
- name: TEXT (فريد)
- phone: TEXT
- notes: TEXT
- is_active: BOOLEAN
- created_at: TIMESTAMPTZ
```

### جدول purchases
```sql
- id: UUID
- branch_id: UUID (FK)
- supplier_id: UUID (FK)
- purchase_date: DATE
- item_type: TEXT (hashi, sheep, beef, offal)
- item_subtype: TEXT (اختياري: سواكني، نعيمي، إلخ)
- quantity: INTEGER (العدد)
- weight: DECIMAL (الوزن بالكيلو)
- price: DECIMAL (السعر الإجمالي)
- notes: TEXT
- created_at: TIMESTAMPTZ
- created_by: TEXT
```

## APIs

### GET /api/suppliers
جلب قائمة الموردين النشطين

### POST /api/suppliers
إضافة مورد جديد

### GET /api/purchases
جلب المشتريات مع الفلترة:
- `?branchId=xxx`
- `?supplierId=xxx`
- `?itemType=hashi`
- `?date=2026-04-16`

### POST /api/purchases
إضافة مشترى جديد

### DELETE /api/purchases?id=xxx
حذف مشترى

## الصفحة
`/dashboard/purchases`

## التشغيل في Production

### 1. SQL في Supabase
شغّل الملف: `supabase/04-purchases.sql`

### 2. Deploy على Vercel
```bash
git add .
git commit -m "Add purchases system"
git push
```

Vercel سيقوم بالـ deploy تلقائياً.

## الاستخدام

1. اذهب إلى `/dashboard/purchases`
2. اضغط "+ إضافة مشترى جديد"
3. اختر:
   - الفرع
   - المورد (اختياري)
   - الصنف (حاشي، غنم، عجل، مخلفات)
   - النوع الفرعي (مثل: سواكني، نعيمي)
   - العدد
   - الوزن
   - السعر
4. احفظ

## الفلترة
استخدم القوائم المنسدلة للفلترة حسب:
- الفرع
- المورد
- الصنف
- التاريخ

## الإحصائيات
تظهر تلقائياً:
- إجمالي المشتريات
- إجمالي الوزن
- إجمالي السعر
- عدد الموردين
- تفصيل حسب كل صنف
