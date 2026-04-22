-- Function لدفع ترتيب الأصناف تلقائياً
CREATE OR REPLACE FUNCTION increment_item_type_orders(start_order INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE item_types
  SET display_order = display_order + 1
  WHERE display_order >= start_order
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Test: تأكد من وجود الجدول
SELECT COUNT(*) FROM item_types;
