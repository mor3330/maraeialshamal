-- ============================================================
-- إصلاح التكرار في جدول sale_items
-- المشكلة: كل مزامنة كانت تُدرج الأصناف من جديد دون حذف القديمة
-- الحل: نحتفظ بنسخة واحدة لكل صنف في كل فاتورة
-- ============================================================

-- 1) أولاً نرى حجم التكرار
SELECT 
  sale_id,
  product_name,
  COUNT(*) AS cnt
FROM sale_items
GROUP BY sale_id, product_name, quantity, unit_price
HAVING COUNT(*) > 1
LIMIT 20;

-- ============================================================
-- 2) حذف التكرارات — يحتفظ بأقدم نسخة (MIN id) لكل صنف
-- شغّل هذا بعد التأكد من الاستعلام أعلاه
-- ============================================================

DELETE FROM sale_items
WHERE id NOT IN (
  SELECT MIN(id)
  FROM sale_items
  GROUP BY sale_id, product_name, ROUND(quantity::numeric, 4), ROUND(unit_price::numeric, 4)
);

-- 3) تأكيد النتيجة
SELECT COUNT(*) AS total_items FROM sale_items;
