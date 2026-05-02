-- ══════════════════════════════════════════════
-- تشخيص بيانات كشف الحساب
-- شغّل هذا في Supabase → SQL Editor
-- ══════════════════════════════════════════════

-- 1) هل توجد قيود اليومية؟
SELECT 'journal_entries count' AS check_name, COUNT(*) AS total
FROM journal_entries;

-- 2) هل توجد سطور قيود بـ supplier_id؟
SELECT 'journal_lines with supplier' AS check_name, COUNT(*) AS total
FROM journal_lines
WHERE supplier_id IS NOT NULL;

-- 3) القيود الأخيرة (آخر 5)
SELECT
  je.entry_number,
  je.entry_date,
  je.status,
  je.description,
  je.total_debit,
  je.created_at
FROM journal_entries je
ORDER BY je.created_at DESC
LIMIT 5;

-- 4) سطور القيود مع المورد
SELECT
  jl.id,
  jl.supplier_id,
  jl.debit,
  jl.credit,
  jl.description,
  je.entry_number,
  je.entry_date,
  je.status
FROM journal_lines jl
JOIN journal_entries je ON je.id = jl.journal_entry_id
WHERE jl.supplier_id IS NOT NULL
ORDER BY je.created_at DESC
LIMIT 10;

-- 5) اسم المورد
SELECT id, name FROM suppliers WHERE name ILIKE '%محمد طه%' OR name ILIKE '%mohammed taha%';
