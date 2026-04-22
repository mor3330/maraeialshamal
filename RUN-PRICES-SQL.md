# تشغيل SQL لنظام الأسعار

## 📋 الخطوات المطلوبة:

### 1. افتح Supabase SQL Editor

### 2. شغّل كل هذا الكود:

```sql
-- Function للترتيب الديناميكي
CREATE OR REPLACE FUNCTION increment_item_type_orders(start_order INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE item_types SET display_order = display_order + 1
  WHERE display_order >= start_order AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- إضافة عمود طريقة الحساب للأصناف
ALTER TABLE item_types 
ADD COLUMN IF NOT EXISTS pricing_method TEXT DEFAULT 'quantity' CHECK (pricing_method IN ('quantity', 'weight'));

UPDATE item_types SET pricing_method = 'quantity' WHERE pricing_method IS NULL;

-- جدول أسعار الموردين
CREATE TABLE IF NOT EXISTS supplier_item_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  item_type_id UUID NOT NULL REFERENCES item_types(id) ON DELETE CASCADE,
  price_per_unit DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, item_type_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_item_prices_supplier ON supplier_item_prices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_item_prices_item_type ON supplier_item_prices(item_type_id);
CREATE INDEX IF NOT EXISTS idx_supplier_item_prices_active ON supplier_item_prices(is_active);
```

## ✅ طريقة الاستخدام:

### 1. إضافة الأسعار
- اذهب لصفحة "المشتريات"
- اضغط زر **"الأسعار"** (أصفر)
- أضف: **مورد 2** + **حاشي** = **4200 ر**

### 2. الحساب التلقائي (قريباً)
- عند اختيار مورد 2 + حاشي
- السعر يظهر تلقائياً = 4200
- العدد 2 → السعر الإجمالي = 8400

**الآن: أضف الأسعار يدوياً**
**لاحقاً: سيكون الحساب تلقائي**

## 📍 الأزرار في المشتريات:
- 🟡 **الأسعار** → إدارة الأسعار
- 🔵 **الأصناف** → (حاشي، غنم، إلخ)
- 🟣 **الموردين** → (قائمة الموردين)
- 🟢 **إضافة مشترى** → إضافة جديدة
