-- نقل pricing_method من item_types إلى supplier_item_prices
ALTER TABLE supplier_item_prices 
ADD COLUMN IF NOT EXISTS pricing_method TEXT DEFAULT 'quantity' CHECK (pricing_method IN ('quantity', 'weight'));

COMMENT ON COLUMN supplier_item_prices.pricing_method IS 'طريقة حساب السعر: quantity (بالكمية/العدد) أو weight (بالوزن/كجم)';

-- إزالة pricing_method من item_types (اختياري)
-- ALTER TABLE item_types DROP COLUMN IF EXISTS pricing_method;

-- تحديث البيانات الموجودة
UPDATE supplier_item_prices SET pricing_method = 'quantity' WHERE pricing_method IS NULL;
