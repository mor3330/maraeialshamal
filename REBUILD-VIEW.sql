-- أعد بناء الـ VIEW لتشمل البيانات الجديدة
CREATE OR REPLACE VIEW supplier_statement AS
SELECT
    je.id             AS entry_id,
    je.entry_number,
    je.entry_date,
    je.hijri_date,
    je.description,
    je.reference_number,
    je.entry_type,
    je.status,
    je.source_type,
    je.source_id,
    je.created_at,
    jl.supplier_id,
    jl.debit,
    jl.credit,
    jl.description    AS line_description,
    jl.quantity,
    jl.unit_price,
    jl.item_type,
    SUM(jl.debit - jl.credit) OVER (
        PARTITION BY jl.supplier_id
        ORDER BY je.entry_date, je.entry_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_balance
FROM journal_entries je
JOIN journal_lines jl ON jl.journal_entry_id = je.id
WHERE je.status != 'voided'
  AND jl.supplier_id IS NOT NULL
ORDER BY je.entry_date, je.entry_number;

-- تحقق
SELECT count(*) AS rows_in_view FROM supplier_statement;
SELECT * FROM supplier_statement LIMIT 5;
