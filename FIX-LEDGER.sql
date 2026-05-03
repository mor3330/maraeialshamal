-- ══════════════════════════════════════════════════════════
--  تشخيص وإصلاح نظام كشف الحساب
--  شغّل كل query منفردة في Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- STEP 1: هل الجداول موجودة؟
-- ═══════════════════════════════════════
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('journal_entries','journal_lines','suppliers','supplier_statement')
ORDER BY table_name;
-- المتوقع: 4 صفوف (supplier_statement هو VIEW وليس table لذا قد لا يظهر هنا)

-- ═══════════════════════════════════════
-- STEP 2: هل الـ VIEW موجودة؟
-- ═══════════════════════════════════════
SELECT viewname FROM pg_views WHERE schemaname='public' AND viewname='supplier_statement';

-- ═══════════════════════════════════════
-- STEP 3: كم قيد موجود في الجداول؟
-- ═══════════════════════════════════════
SELECT
  (SELECT count(*) FROM journal_entries)  AS total_entries,
  (SELECT count(*) FROM journal_lines)    AS total_lines,
  (SELECT count(*) FROM journal_lines WHERE supplier_id IS NOT NULL) AS lines_with_supplier;

-- ═══════════════════════════════════════
-- STEP 4: المورد محمد طه — ما هو ID؟
-- ═══════════════════════════════════════
SELECT id, name, opening_balance FROM suppliers
WHERE name ILIKE '%محمد%' OR name ILIKE '%طه%' OR name ILIKE '%taha%'
ORDER BY name;

-- ═══════════════════════════════════════
-- STEP 5: آخر 10 قيود (بغض النظر عن المورد)
-- ═══════════════════════════════════════
SELECT
  je.entry_number,
  je.entry_date,
  je.status,
  je.entry_type,
  je.description,
  je.total_debit,
  je.created_at,
  (SELECT count(*) FROM journal_lines jl WHERE jl.journal_entry_id = je.id) AS lines_count,
  (SELECT count(*) FROM journal_lines jl WHERE jl.journal_entry_id = je.id AND jl.supplier_id IS NOT NULL) AS supplier_lines
FROM journal_entries je
ORDER BY je.created_at DESC
LIMIT 10;

-- ═══════════════════════════════════════
-- STEP 6: هل journal_lines فيها supplier_id للقيود الأخيرة؟
-- ═══════════════════════════════════════
SELECT
  jl.id,
  jl.supplier_id,
  jl.debit,
  jl.credit,
  jl.description,
  je.entry_number,
  je.entry_date,
  je.status,
  s.name AS supplier_name
FROM journal_lines jl
JOIN journal_entries je ON je.id = jl.journal_entry_id
LEFT JOIN suppliers s ON s.id = jl.supplier_id
ORDER BY je.created_at DESC
LIMIT 20;

-- ═══════════════════════════════════════
-- STEP 7: هل الـ VIEW تُرجع بيانات؟
-- ═══════════════════════════════════════
SELECT * FROM supplier_statement LIMIT 10;

-- ═══════════════════════════════════════
-- STEP 8: إذا القيود موجودة لكن supplier_id = NULL
-- هذا الإصلاح يربط القيود الموجودة بمحمد طه
-- (شغّله فقط إذا تأكدت من الـ ID الصحيح من STEP 4)
-- ═══════════════════════════════════════
-- UPDATE journal_lines
-- SET supplier_id = 'REPLACE_WITH_ACTUAL_ID_FROM_STEP4'
-- WHERE supplier_id IS NULL
--   AND journal_entry_id IN (SELECT id FROM journal_entries ORDER BY created_at DESC LIMIT 20);
-- تحقق أولاً، ثم أزل التعليق وشغّل

-- ═══════════════════════════════════════
-- STEP 9: فحص RLS (هل Row Level Security يمنع القراءة؟)
-- ═══════════════════════════════════════
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('journal_entries','journal_lines');
-- إذا rowsecurity = true → هذا قد يكون المشكلة

-- إصلاح RLS إذا كان المشكلة:
-- ALTER TABLE journal_entries DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE journal_lines   DISABLE ROW LEVEL SECURITY;
