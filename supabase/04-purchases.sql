-- 🛒 نظام المشتريات
-- جدول الموردين

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  phone TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- تفعيل Row Level Security للموردين
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة والتعديل للموردين
CREATE POLICY "Allow all operations on suppliers" ON suppliers
  FOR ALL USING (true);

-- إدخال موردين افتراضيين
INSERT INTO suppliers (name) VALUES 
  ('مورد 1'),
  ('مورد 2'),
  ('مورد 3')
ON CONFLICT (name) DO NOTHING;

-- جدول المشتريات اليومية

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- معلومات العنصر
  item_type TEXT NOT NULL, -- 'hashi', 'sheep', 'beef', 'offal'
  item_subtype TEXT, -- 'sawakni', 'naimi', etc. (اختياري)
  
  -- التفاصيل
  quantity INTEGER NOT NULL DEFAULT 1, -- العدد (عدد الرؤوس)
  weight DECIMAL(10,2) NOT NULL, -- الوزن بالكيلو
  price DECIMAL(10,2) NOT NULL, -- السعر الإجمالي
  
  -- ملاحظات
  notes TEXT,
  
  -- تتبع الإدخال
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT, -- اسم المستخدم
  
  -- فهرس للبحث السريع
  CONSTRAINT valid_item_type CHECK (item_type IN ('hashi', 'sheep', 'beef', 'offal'))
);

-- إنشاء الفهارس
CREATE INDEX IF NOT EXISTS idx_purchases_branch_date ON purchases(branch_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_type ON purchases(item_type);

-- تفعيل Row Level Security
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة إن وجدت
DROP POLICY IF EXISTS "Allow read access to all" ON purchases;
DROP POLICY IF EXISTS "Allow insert/update to all" ON purchases;

-- سياسة موحدة لكل العمليات
CREATE POLICY "Allow all operations on purchases" ON purchases
  FOR ALL USING (true);

-- منظر (VIEW) لتلخيص المشتريات
CREATE OR REPLACE VIEW purchases_summary AS
SELECT 
  p.branch_id,
  b.name AS branch_name,
  p.purchase_date,
  p.item_type,
  COUNT(*) AS items_count,
  SUM(p.quantity) AS total_quantity,
  SUM(p.weight) AS total_weight,
  SUM(p.price) AS total_price
FROM purchases p
JOIN branches b ON b.id = p.branch_id
GROUP BY p.branch_id, b.name, p.purchase_date, p.item_type;

-- إدخال بيانات تجريبية (اختياري)
-- INSERT INTO purchases (branch_id, purchase_date, item_type, item_subtype, quantity, weight, price, notes)
-- SELECT 
--   (SELECT id FROM branches LIMIT 1),
--   CURRENT_DATE,
--   'hashi',
--   'سواكني',
--   2,
--   426.00,
--   8400.00,
--   'مشتريات تجريبية'
-- WHERE EXISTS (SELECT 1 FROM branches LIMIT 1);
