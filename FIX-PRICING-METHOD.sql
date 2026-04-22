-- إضافة عمود pricing_method للجدول الموجود
ALTER TABLE supplier_item_prices 
ADD COLUMN IF NOT EXISTS pricing_method TEXT DEFAULT 'quantity' CHECK (pricing_method IN ('quantity', 'weight'));

-- تحديث البيانات الموجودة
UPDATE supplier_item_prices 
SET pricing_method = 'quantity' 
WHERE pricing_method IS NULL;

COMMENT ON COLUMN supplier_item_prices.pricing_method IS 'طريقة حساب السعر: quantity (بالكمية/العدد) أو weight (بالوزن/كجم)';
