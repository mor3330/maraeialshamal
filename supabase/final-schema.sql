-- ============================================================
-- مراعي الشمال - النظام النهائي الصحيح
-- ============================================================

-- 1️⃣ حذف كل شيء
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS report_expenses CASCADE;
DROP TABLE IF EXISTS report_meat_movements CASCADE;
DROP TABLE IF EXISTS report_payments CASCADE;
DROP TABLE IF EXISTS daily_reports CASCADE;
DROP TABLE IF EXISTS step_fields CASCADE;
DROP TABLE IF EXISTS opening_balances CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS meat_types CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS branches CASCADE;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2️⃣ الجداول
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('cashier', 'admin', 'owner')),
  branch_id UUID REFERENCES branches(id),
  phone TEXT,
  pin_hash TEXT,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE meat_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT DEFAULT 'kg',
  has_count BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0
);

CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  report_date DATE NOT NULL,
  cashier_id UUID REFERENCES users(id),
  total_sales NUMERIC(10,2),
  invoice_count INT,
  returns_value NUMERIC(10,2) DEFAULT 0,
  cash_expected NUMERIC(10,2),
  cash_actual NUMERIC(10,2),
  cash_difference NUMERIC(10,2) GENERATED ALWAYS AS (cash_actual - cash_expected) STORED,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','flagged')),
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  synced_to_excel BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ,
  UNIQUE(branch_id, report_date)
);

CREATE TABLE report_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES payment_methods(id),
  amount NUMERIC(10,2) NOT NULL
);

CREATE TABLE report_meat_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
  meat_type_id UUID REFERENCES meat_types(id),
  movement_type TEXT CHECK (movement_type IN ('incoming','sales','outgoing','remaining','opening')),
  count INT DEFAULT 0,
  weight_kg NUMERIC(10,3),
  notes TEXT
);

CREATE TABLE report_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
  category TEXT,
  description TEXT,
  amount NUMERIC(10,2)
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES daily_reports(id),
  branch_id UUID REFERENCES branches(id),
  type TEXT,
  severity TEXT CHECK (severity IN ('info','warning','critical')),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE step_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step INT NOT NULL,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'select', 'textarea', 'checkbox')),
  is_required BOOLEAN DEFAULT true,
  options JSONB,
  placeholder TEXT,
  help_text TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(step, field_name)
);

CREATE TABLE opening_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  balance_date DATE NOT NULL,
  hashi_weight NUMERIC(10,3) DEFAULT 0,
  sheep_weight NUMERIC(10,3) DEFAULT 0,
  beef_weight NUMERIC(10,3) DEFAULT 0,
  offal_details TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, balance_date)
);

-- 3️⃣ RLS
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE meat_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_meat_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_branches" ON branches FOR SELECT USING (true);
CREATE POLICY "public_read_meat_types" ON meat_types FOR SELECT USING (is_active = true);
CREATE POLICY "public_read_payment_methods" ON payment_methods FOR SELECT USING (is_active = true);
CREATE POLICY "public_read_step_fields" ON step_fields FOR SELECT USING (is_active = true);

-- 4️⃣ البيانات
INSERT INTO meat_types (name, category, unit, has_count, sort_order) VALUES
  ('حاشي بالعظم', 'hashi', 'kg', true, 1),
  ('حاشي بدون عظم', 'hashi', 'kg', true, 2),
  ('عجل بالعظم', 'beef', 'kg', true, 3),
  ('عجل بدون عظم', 'beef', 'kg', true, 4),
  ('غنم', 'sheep', 'kg', true, 5),
  ('لحم مفروم', 'minced', 'kg', false, 6),
  ('مخلفات', 'offal', 'kg', false, 7);

INSERT INTO payment_methods (name, code, sort_order) VALUES
  ('كاش', 'cash', 1),
  ('شبكة', 'network', 2),
  ('تحويل بنكي', 'transfer', 3),
  ('آجل', 'deferred', 4);

INSERT INTO branches (name, code, slug, pin_hash) VALUES
  ('فرع العليا', 'OLAYA', 'olaya', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
  ('فرع النخيل', 'NAKHEEL', 'nakheel', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
  ('فرع الملز', 'MALAZ', 'malaz', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

INSERT INTO users (name, role, branch_id) VALUES ('محمد', 'owner', null);

-- 5️⃣ حقول الخطوات الصحيحة

-- ═══════════════════════════════════════════════════════════
-- الخطوة 1: الوارد (كمية + وزن فقط - بدون سعر)
-- ═══════════════════════════════════════════════════════════
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order, help_text) VALUES
  (1, 'hashi_count', 'عدد الرؤوس', 'number', true, 1, null),
  (1, 'hashi_weight', 'الوزن (كجم)', 'number', true, 2, null),
  (1, 'sheep_count', 'عدد الرؤوس', 'number', true, 3, null),
  (1, 'sheep_weight', 'الوزن (كجم)', 'number', true, 4, null),
  (1, 'beef_count', 'عدد الرؤوس', 'number', true, 5, null),
  (1, 'beef_weight', 'الوزن (كجم)', 'number', true, 6, null);

-- ═══════════════════════════════════════════════════════════
-- الخطوة 2: المبيعات الإجمالية
-- ═══════════════════════════════════════════════════════════
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order) VALUES
  (2, 'total_sales', 'إجمالي المبيعات (ريال)', 'number', true, 1),
  (2, 'invoice_count', 'عدد الفواتير', 'number', true, 2),
  (2, 'returns_value', 'قيمة المرتجعات (ريال)', 'number', false, 3);

-- ═══════════════════════════════════════════════════════════
-- الخطوة 3: تفاصيل المبيعات (وزن + سعر)
-- ═══════════════════════════════════════════════════════════
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order) VALUES
  -- حاشي بالعظم
  (3, 'hashi_bone_weight', 'الوزن (كجم)', 'number', true, 1),
  (3, 'hashi_bone_price', 'السعر (ريال)', 'number', true, 2),
  -- حاشي صافي
  (3, 'hashi_clean_weight', 'الوزن (كجم)', 'number', true, 3),
  (3, 'hashi_clean_price', 'السعر (ريال)', 'number', true, 4),
  -- غنم
  (3, 'sheep_weight', 'الوزن (كجم)', 'number', true, 5),
  (3, 'sheep_price', 'السعر (ريال)', 'number', true, 6),
  -- عجل بالعظم
  (3, 'beef_bone_weight', 'الوزن (كجم)', 'number', true, 7),
  (3, 'beef_bone_price', 'السعر (ريال)', 'number', true, 8),
  -- عجل صافي
  (3, 'beef_clean_weight', 'الوزن (كجم)', 'number', true, 9),
  (3, 'beef_clean_price', 'السعر (ريال)', 'number', true, 10),
  -- مخلفات
  (3, 'offal_total_price', 'إجمالي سعر المخلفات (ريال)', 'number', false, 11);

-- ═══════════════════════════════════════════════════════════
-- الخطوة 4: الصادر (غنم كمية+وزن، الباقي وزن فقط)
-- ═══════════════════════════════════════════════════════════
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order, help_text) VALUES
  -- حاشي (وزن فقط)
  (4, 'hashi_outgoing', 'الوزن (كجم)', 'number', false, 1, 'الصادر من الحاشي'),
  -- غنم (كمية + وزن)
  (4, 'sheep_outgoing_count', 'الكمية (رؤوس)', 'number', false, 2, 'عدد رؤوس الغنم الصادرة'),
  (4, 'sheep_outgoing_weight', 'الوزن (كجم)', 'number', false, 3, 'وزن الغنم الصادر'),
  -- عجل (وزن فقط)
  (4, 'beef_outgoing', 'الوزن (كجم)', 'number', false, 4, 'الصادر من العجل'),
  -- المخلفات للمسلخ
  (4, 'offal_to_slaughterhouse', 'المخلفات المسلمة للمسلخ', 'textarea', false, 5, 'بيان المخلفات');

-- ═══════════════════════════════════════════════════════════
-- الخطوة 5: المتبقي في الثلاجة
-- ═══════════════════════════════════════════════════════════
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order, help_text) VALUES
  (5, 'hashi_remaining', 'حاشي متبقي (كجم)', 'number', true, 1, 'الوزن الفعلي'),
  (5, 'sheep_remaining', 'غنم متبقي (كجم)', 'number', true, 2, 'الوزن الفعلي'),
  (5, 'beef_remaining', 'عجل متبقي (كجم)', 'number', true, 3, 'الوزن الفعلي'),
  (5, 'offal_remaining', 'مخلفات متبقية', 'textarea', false, 4, 'التفاصيل');

-- ═══════════════════════════════════════════════════════════
-- الخطوة 6: الأموال
-- ═══════════════════════════════════════════════════════════
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order) VALUES
  (6, 'cash_amount', 'الكاش (ريال)', 'number', true, 1),
  (6, 'network_amount', 'الشبكة (ريال)', 'number', true, 2),
  (6, 'transfer_amount', 'الحوالة البنكية (ريال)', 'number', true, 3),
  (6, 'deferred_amount', 'الآجل (ريال)', 'number', true, 4);

-- ═══════════════════════════════════════════════════════════
-- الخطوة 7: المصروفات والمراجعة
-- ═══════════════════════════════════════════════════════════
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order, help_text) VALUES
  (7, 'expenses', 'المصروفات', 'text', false, 1, 'جدول المصروفات'),
  (7, 'final_notes', 'ملاحظات نهائية', 'textarea', false, 2, null),
  (7, 'confirmation', 'أؤكد صحة جميع البيانات', 'checkbox', true, 3, null);

-- ✅ تم!
