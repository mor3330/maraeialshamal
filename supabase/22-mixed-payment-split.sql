-- إضافة حقلي تفصيل الدفع المختلط
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS mixed_cash_amount    NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mixed_network_amount NUMERIC(10,2) DEFAULT 0;

-- index للأداء
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method);
