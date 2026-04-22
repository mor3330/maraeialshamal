# تشغيل SQL للأسعار النهائي

## 📋 شغّل هذا الكود في Supabase SQL Editor:

```sql
-- Function للترتيب الديناميكي
CREATE OR REPLACE FUNCTION increment_item_type_orders(start_order INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE item_types SET display_order = display_order + 1
  WHERE display_order >= start_order AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- جدول أسعار الموردين
CREATE TABLE IF NOT EXISTS supplier_item_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  item_type_id UUID NOT NULL REFERENCES item_types(id) ON DELETE CASCADE,
  price_per_unit DECIMAL(10, 2) NOT NULL,
  pricing_method TEXT DEFAULT 'quantity' CHECK (pricing_method IN ('quantity', 'weight')),
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
1. اذهب لصفحة **"المشتريات"**
2. اضغط زر **"الأسعار"** (🟡 أصفر)
3. اضغط **"إضافة سعر"**

### 2. أمثلة:
**مثال 1: بالكمية**
- المورد: مورد 2
- الصنف: حاشي
- طريقة الحساب: **بالكمية**
- السعر: 4200 ر (للرأس الواحد)
- النتيجة: 2 رأس × 4200 = **8400 ر**

**مثال 2: بالوزن**
- المورد: مورد 1
- الصنف: عجل
- طريقة الحساب: **بالوزن**
- السعر: 20 ر (للكجم)
- النتيجة: 100 كجم × 20 = **2000 ر**

## 🎯 الفكرة:
- **بالكمية**: السعر × العدد
- **بالوزن**: السعر × الوزن (كجم)

**النظام جاهز للاستخدام!** 🚀
