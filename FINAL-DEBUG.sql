-- الـ supplier_id الموجود في journal_lines
SELECT DISTINCT jl.supplier_id, s.name
FROM journal_lines jl
LEFT JOIN suppliers s ON s.id = jl.supplier_id
WHERE jl.supplier_id IS NOT NULL;
