-- ══════════════════════════════════════════════════════════════
--  إصلاح فوري — شغّل هذا في Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1) اعرض ما عندك أولاً
SELECT 
  jl.supplier_id,
  s.name as supplier_name,
  COUNT(*) as line_count,
  SUM(jl.debit) as total_debit,
  SUM(jl.credit) as total_credit
FROM journal_lines jl
LEFT JOIN suppliers s ON s.id = jl.supplier_id
GROUP BY jl.supplier_id, s.name;

-- ──────────────────────────────────────────────────────────────

-- 2) احذف القيود القديمة التي ليس لها مورد (supplier_id = NULL في كل سطورها)
DELETE FROM journal_entries
WHERE id IN (
  SELECT DISTINCT je.id
  FROM journal_entries je
  WHERE NOT EXISTS (
    SELECT 1 FROM journal_lines jl 
    WHERE jl.journal_entry_id = je.id 
    AND jl.supplier_id IS NOT NULL
  )
);

-- ──────────────────────────────────────────────────────────────

-- 3) احذف أي سطور قيود يتيمة (journal_entry_id غير موجود)
DELETE FROM journal_lines
WHERE journal_entry_id NOT IN (SELECT id FROM journal_entries);

-- ──────────────────────────────────────────────────────────────

-- 4) تحقق من النتيجة
SELECT 
  'journal_entries' AS table_name, COUNT(*) AS rows FROM journal_entries
UNION ALL
SELECT 'journal_lines', COUNT(*) FROM journal_lines;
