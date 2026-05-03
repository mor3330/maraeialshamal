-- 1) هل الـ VIEW تشوف القيود؟
SELECT count(*) AS view_count FROM supplier_statement;

-- 2) هل الـ VIEW تشوف قيود محمد طه؟
SELECT * FROM supplier_statement LIMIT 10;

-- 3) ما هو الـ supplier_id لمحمد طه؟
SELECT id, name FROM suppliers WHERE name ILIKE '%محمد%' OR name ILIKE '%طه%';

-- 4) القيود مع supplier_id مباشرة (بدون VIEW)
SELECT
  je.entry_number,
  je.entry_date,
  je.status,
  jl.supplier_id,
  jl.debit,
  jl.credit
FROM journal_entries je
JOIN journal_lines jl ON jl.journal_entry_id = je.id
WHERE jl.supplier_id IS NOT NULL
ORDER BY je.entry_date DESC;
