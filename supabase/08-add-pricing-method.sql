-- إضافة طريقة الحساب للأصناف
ALTER TABLE item_types 
ADD COLUMN IF NOT EXISTS pricing_method TEXT DEFAULT 'quantity' CHECK (pricing_method IN ('quantity', 'weight'));

COMMENT ON COLUMN item_types.pricing_method IS 'طريقة حساب السعر: quantity (بالعدد) أو weight (بالوزن)';

-- تحديث البيانات الموجودة
UPDATE item_types SET pricing_method = 'quantity' WHERE pricing_method IS NULL;
