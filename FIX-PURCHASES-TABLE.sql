-- ═══════════════════════════════════════════════════════════
-- إعادة إنشاء جدول المشتريات بالكامل
-- ═══════════════════════════════════════════════════════════

-- 1️⃣ حذف الجدول القديم وإنشاءه من جديد
DROP TABLE IF EXISTS purchases CASCADE;

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  item_type_id UUID REFERENCES item_types(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  weight DECIMAL(10,2) NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2️⃣ Indexes
CREATE INDEX IF NOT EXISTS idx_purchases_branch_date ON purchases(branch_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_item_type_id ON purchases(item_type_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);

-- 3️⃣ RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on purchases" ON purchases
  FOR ALL USING (true) WITH CHECK (true);

-- 4️⃣ صلاحيات
GRANT ALL ON purchases TO anon, authenticated, service_role;

-- 5️⃣ تحقق
SELECT 'الجدول جاهز ✅' as message;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'purchases' ORDER BY ordinal_position;
