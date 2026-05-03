-- ══════════════════════════════════════════════════════
-- STEP 1: شوف كل الموردين الموجودين
-- ══════════════════════════════════════════════════════
SELECT id, name FROM suppliers ORDER BY name;

-- ══════════════════════════════════════════════════════
-- STEP 2: أضف محمد طه إذا ما كان موجود
-- ══════════════════════════════════════════════════════
INSERT INTO suppliers (name, opening_balance, payment_terms_days)
VALUES ('محمد طه', 0, 30)
ON CONFLICT DO NOTHING
RETURNING id, name;

-- ══════════════════════════════════════════════════════
-- STEP 3: شوف الـ ID بعد الإضافة
-- ══════════════════════════════════════════════════════
SELECT id, name FROM suppliers WHERE name ILIKE '%محمد%' OR name ILIKE '%طه%';

-- ══════════════════════════════════════════════════════
-- STEP 4: صلّح القيود الموجودة (ضع الـ ID من STEP 3)
-- ══════════════════════════════════════════════════════
UPDATE journal_lines
SET supplier_id = (
  SELECT id FROM suppliers WHERE name ILIKE '%محمد%' OR name ILIKE '%طه%' LIMIT 1
)
WHERE supplier_id IS NULL
  AND journal_entry_id IN (
    SELECT id FROM journal_entries WHERE status = 'posted'
  );

-- تحقق من النتيجة
SELECT count(*) AS lines_with_supplier_now
FROM journal_lines WHERE supplier_id IS NOT NULL;
