-- جدول أسعار الموردين لكل صنف
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

-- Index لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_supplier_item_prices_supplier ON supplier_item_prices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_item_prices_item_type ON supplier_item_prices(item_type_id);
CREATE INDEX IF NOT EXISTS idx_supplier_item_prices_active ON supplier_item_prices(is_active);

COMMENT ON TABLE supplier_item_prices IS 'أسعار الموردين لكل صنف';
COMMENT ON COLUMN supplier_item_prices.price_per_unit IS 'السعر لكل وحدة (رأس/ذبيحة)';
