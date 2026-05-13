# 🔒 إصلاحات الأمن والموثوقية

> آخر تحديث: 2026-05-13

تم تنفيذ **5 إصلاحات حرجة** تعالج مشاكل قد تسبّب: اختلاط البيانات بين الفروع، تكرار التقارير، انتحال هوية الفرع، وضغط API.

---

## ✅ #1 — مفتاح sessionStorage لكل فرع

**المشكلة:** كانت كل البيانات تُحفظ تحت مفتاح واحد `marai_report_draft`. لو فتح أحد تبويباً جديداً لفرع آخر، الـ draft يختلط ويُرسَل تقرير الفرع A تحت اسم B.

**الحل:** المفاتيح الآن بصيغة `marai_report_draft__{slug}` و `cashier_session__{slug}`، ويتم استخراج الـ slug تلقائياً من URL.

**الملفات المتأثرة:**
- `src/lib/report-store.ts` — أعيدت كتابة الدوال (نفس الـ API الخارجي، backward-compatible)
- `src/components/cashier/PinLoginClient.tsx` — يستخدم `saveSessionForBranch` بدل sessionStorage مباشرة

**التحقق:**
1. سجّل دخول لفرع A، ابدأ تقرير، املأ بيانات.
2. افتح تبويب جديد، سجّل دخول لفرع B.
3. ✅ المتوقع: لا يُعرض draft فرع A في تبويب فرع B.

---

## ✅ #2 — جلسة فرع موقّعة عبر HTTP-only cookie

**المشكلة:** قبل الإصلاح، الـ client يرسل `branchId` في الـ body بدون أي تحقق من جهة الخادم → ممكن نظرياً تزوير الـ branchId لإنشاء تقرير لفرع آخر.

**الحل:** بعد PIN صحيح، نُصدر cookie موقّع `HMAC-SHA256` (HttpOnly + SameSite=Lax + Secure في prod). كل `POST /api/reports/submit` يتحقق أن الـ branchId في الـ body يطابق ما في الـ cookie.

**الملفات الجديدة:**
- `src/lib/branch-session.ts` — توقيع/تحقق HMAC بدون مكتبات خارجية

**الملفات المعدّلة:**
- `src/app/api/branch/[slug]/verify-pin/route.ts` — يُصدر Set-Cookie
- `src/app/api/reports/submit/route.ts` — يتحقق من الـ cookie

**متغير بيئة (اختياري):**
```bash
SESSION_SECRET=أي_نص_عشوائي_طويل_32+حرف
```
إذا لم يُعرّف، يستخدم `SUPABASE_SERVICE_ROLE_KEY` كاحتياط.

**ملاحظة:** الحماية متساهلة مع جلسات قديمة (إذا الـ cookie غير موجود نقبل الطلب). بعد أسبوع من النشر، احذف هذا الـ fallback لجعل الحماية إلزامية.

---

## ✅ #3 — منع تكرار التقارير (UNIQUE constraint)

**المشكلة:** الكود يعمل `check-then-insert`. لو ضغط موظفان "إرسال" بفارق مللي ثانية، تنشأ صفّان لنفس الفرع/التاريخ (race condition).

**الحل:**
- SQL: `ALTER TABLE daily_reports ADD CONSTRAINT daily_reports_branch_date_unique UNIQUE (branch_id, report_date)`
- الكود الحالي يستخدم upsert (update if exists, else insert) ولكن الآن مع UNIQUE constraint، حتى الـ race يمنعه postgres.

**كيف تشغّل:**
```bash
# في Supabase SQL editor، شغّل:
supabase/32-unique-daily-report.sql
```
الملف يحذف التكرارات الموجودة أولاً ثم يضيف القيد.

---

## ✅ #4 — تقليل polling من 60 ثانية إلى 5 دقائق

**المشكلة:** Dashboard كان يستدعي `/api/admin/dashboard` كل دقيقة → ضغط على Supabase (1440 طلب/يوم لكل مستخدم admin مفتوح).

**الحل:** تغيير الـ interval إلى 300 ثانية. زر "↻ تحديث" اليدوي ما زال موجوداً للتحديث الفوري.

**الملف:** `src/app/(admin)/dashboard/page.tsx`

---

## ⏸️ #5 — تصغير body الـ submit (مؤجَّل)

**حالة:** غير منفّذ. السبب: تصغير الـ body يتطلب إعادة هيكلة الـ steps لتُرسَل البيانات نظيفة (بدون `stepXNamed` + `stepXValues` المتكررة). الحجم الحالي لا يسبّب مشكلة عملياً (< 50KB لكل تقرير).

**توصية مستقبلية:** عند العمل على Step6Client/Step7Client، أزل `stepXValues` المكرّر مع `stepXNamed`.

---

## ✅ #6 — زر "مسح المسودة" في صفحة الفرع

**المشكلة:** لو الكاشير حصل عنده draft خاطئ (مثلاً من فرع آخر بعد الإصلاح #1)، لا يقدر يبدأ من الصفر إلا بمسح sessionStorage يدوياً.

**الحل:** يظهر زر 🗑️ "مسح المسودة المحفوظة والبدء من جديد" تحت زر "بدء التقرير" إذا كان فيه draft. أيضاً نص الزر يتغيّر إلى "متابعة التقرير الحالي" عند وجود draft.

**الملف:** `src/components/cashier/BranchHomeClient.tsx`

---

## 🚀 خطوات النشر

### 1) شغّل SQL أولاً (مهم)
في Supabase SQL editor:
```sql
-- نسخ والصق محتوى الملف:
supabase/32-unique-daily-report.sql
```

### 2) (اختياري لكن مُوصى به) أضف SESSION_SECRET
في `.env.local` (وفي Vercel env):
```bash
SESSION_SECRET=YOUR_32_CHAR_RANDOM_STRING_HERE
```
أنشئ واحد بـ:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3) Deploy
```bash
git add -A
git commit -m "fix: 5 critical security & reliability fixes (sessionStorage, cookie auth, unique constraint, polling, draft clear)"
git push
```

### 4) بعد النشر
- ✅ كل الموظفين بحاجة تسجيل دخول جديد بالـ PIN (لإصدار الـ cookie الجديد).
- ✅ راقب logs/Supabase أول يوم للتأكد إن submit يعمل بشكل صحيح.
- ✅ إذا ظهر خطأ "🔒 اختلاف بين الفرع في الجلسة..." → الموظف لازم يسجّل خروج ثم دخول.

---

## 📊 جدول الملخص

| # | الإصلاح | الخطورة | الملف الأساسي |
|---|---------|---------|----------------|
| 1 | sessionStorage per branch | 🔴 حرج | `report-store.ts` |
| 2 | HMAC cookie auth | 🔴 حرج | `branch-session.ts` |
| 3 | UNIQUE constraint | 🟠 عالي | `32-unique-daily-report.sql` |
| 4 | Polling 60→300s | 🟡 متوسط | `dashboard/page.tsx` |
| 5 | Body size | ⏸️ مؤجَّل | — |
| 6 | Clear draft button | 🟢 UX | `BranchHomeClient.tsx` |
