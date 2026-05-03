-- شغّل هذا كله مرة واحدة في Supabase SQL Editor
SELECT
  (SELECT count(*) FROM journal_entries)                                    AS total_entries,
  (SELECT count(*) FROM journal_lines)                                      AS total_lines,
  (SELECT count(*) FROM journal_lines WHERE supplier_id IS NOT NULL)        AS lines_with_supplier,
  (SELECT count(*) FROM journal_entries WHERE status = 'posted')            AS posted_entries,
  (SELECT count(*) FROM journal_entries WHERE status != 'posted')           AS non_posted;

-- آخر 5 قيود مع سطورها
SELECT
  je.entry_number,
  je.entry_date,
  je.status,
  je.entry_type,
  je.total_debit,
  jl.supplier_id,
  jl.debit      AS line_debit,
  jl.credit     AS line_credit,
  s.name        AS supplier_name
FROM journal_entries je
LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
LEFT JOIN suppliers s ON s.id = jl.supplier_id
ORDER BY je.created_at DESC
LIMIT 20;
