-- ══════════════════════════════════════════════════════════
--  تشخيص سريع — شغّل هذا في Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- 1) اعرض كل القيود مع معلومات السطور
SELECT 
  je.id,
  je.entry_number,
  je.entry_date,
  je.status,
  je.description,
  je.total_debit,
  je.total_credit,
  je.created_at
FROM journal_entries je
ORDER BY je.created_at DESC
LIMIT 10;

-- ──────────────────────────────────────────────────────────

-- 2) اعرض سطور القيود مع supplier_id
SELECT 
  jl.id,
  jl.journal_entry_id,
  jl.supplier_id,
  jl.debit,
  jl.credit,
  jl.line_number,
  jl.description
FROM journal_lines jl
ORDER BY jl.journal_entry_id
LIMIT 20;

-- ──────────────────────────────────────────────────────────

-- 3) المورد "محمد طه" — ما هو UUID الخاص به؟
SELECT id, name FROM suppliers WHERE name LIKE '%طه%' OR name ILIKE '%taha%';

-- ──────────────────────────────────────────────────────────

-- 4) هل السطور مرتبطة بـ "محمد طه"؟
SELECT 
  jl.supplier_id,
  s.name as supplier_name,
  COUNT(*) as line_count
FROM journal_lines jl
LEFT JOIN suppliers s ON s.id = jl.supplier_id
GROUP BY jl.supplier_id, s.name;
