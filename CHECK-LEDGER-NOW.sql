-- ══════════════════════════════════════════════════════════
--  فحص فوري لنظام كشف الحساب
--  شغّل هذا في Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════

-- 1) كم قيد موجود؟
SELECT 
  'journal_entries' AS "الجدول",
  count(*) AS "عدد الصفوف",
  max(entry_date::text) AS "آخر تاريخ",
  max(entry_number) AS "آخر رقم"
FROM journal_entries

UNION ALL

-- 2) كم سطر موجود؟
SELECT 
  'journal_lines',
  count(*),
  null,
  null
FROM journal_lines;

-- ════════════════════════════════════════════════
-- 3) ما هي القيود الموجودة مع الموردين؟
SELECT 
  je.entry_number,
  je.entry_date,
  je.entry_type,
  je.status,
  je.description,
  jl.debit,
  jl.credit,
  jl.supplier_id,
  s.name AS "اسم المورد"
FROM journal_entries je
JOIN journal_lines jl ON jl.journal_entry_id = je.id
LEFT JOIN suppliers s ON s.id = jl.supplier_id
WHERE jl.supplier_id IS NOT NULL
ORDER BY je.entry_date DESC, je.entry_number DESC
LIMIT 20;

-- ════════════════════════════════════════════════
-- 4) هل الـ VIEW تشتغل؟
SELECT 
  entry_number,
  entry_date,
  description,
  debit,
  credit,
  running_balance,
  supplier_id
FROM supplier_statement
LIMIT 10;

-- ════════════════════════════════════════════════
-- 5) قائمة الموردين مع ID
SELECT id, name FROM suppliers ORDER BY name LIMIT 20;
