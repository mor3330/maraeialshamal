-- ============================================================
-- مراعي الشمال - إعادة الإعداد الكامل
-- هذا السكريبت يحذف كل شيء ويبدأ من الصفر
-- ============================================================

-- 1️⃣ حذف الجداول القديمة (إذا كانت موجودة)
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

-- 2️⃣ تفعيل UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 3️⃣ إنشاء الجداول من جديد

-- الفروع
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- المستخدمون
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('cashier', 'admin', 'owner')),
  branch_id UUID REFERENCES branches(id),
  phone TEXT,
  pin_hash TEXT,
  is_active BOOLEAN DEFAULT true
);

-- أنواع اللحوم
CREATE TABLE meat_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT DEFAULT 'kg',
  has_count BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- طرق الدفع
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0
);

-- التقارير اليومية
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  report_date DATE NOT NULL,
  cashier_id UUID REFERENCES users(id),
  total_sales NUMERIC(10,2),
  invoice_count INT,
  returns_value NUMERIC(10,2) DEFAULT 0,
  discounts_value NUMERIC(10,2) DEFAULT 0,
  cash_expected NUMERIC(10,2),
  cash_actual NUMERIC(10,2),
  cash_difference NUMERIC(10,2) GENERATED ALWAYS AS (cash_actual - cash_expected) STORED,
  sales_pdf_url TEXT,
  fridge_photo_url TEXT,
  cash_photo_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','flagged')),
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  synced_to_excel BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ,
  UNIQUE(branch_id, report_date)
);

-- طرق الدفع لكل تقرير
CREATE TABLE report_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES payment_methods(id),
  amount NUMERIC(10,2) NOT NULL
);

-- حركة اللحوم
CREATE TABLE report_meat_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
  meat_type_id UUID REFERENCES meat_types(id),
  movement_type TEXT CHECK (movement_type IN ('incoming','sales','outgoing','remaining','opening')),
  count INT DEFAULT 0,
  weight_kg NUMERIC(10,3),
  notes TEXT
);

-- المصروفات
CREATE TABLE report_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
  category TEXT,
  description TEXT,
  amount NUMERIC(10,2)
);

-- التنبيهات
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

-- سجل التعديلات
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

-- حقول الخطوات (الأهم!)
CREATE TABLE step_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step INT NOT NULL,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'file', 'select', 'textarea', 'checkbox')),
  is_required BOOLEAN DEFAULT true,
  options JSONB,
  file_types TEXT[],
  placeholder TEXT,
  help_text TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(step, field_name)
);

-- الرصيد الافتتاحي
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

-- 4️⃣ تفعيل RLS
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

-- Policies
CREATE POLICY "public_read_branches" ON branches FOR SELECT USING (true);
CREATE POLICY "public_read_meat_types" ON meat_types FOR SELECT USING (is_active = true);
CREATE POLICY "public_read_payment_methods" ON payment_methods FOR SELECT USING (is_active = true);
CREATE POLICY "public_read_step_fields" ON step_fields FOR SELECT USING (is_active = true);

-- 5️⃣ إدخال البيانات الأولية

-- أنواع اللحوم
INSERT INTO meat_types (name, category, unit, has_count, sort_order) VALUES
  ('حاشي بالعظم', 'hashi', 'kg', true, 1),
  ('حاشي بدون عظم', 'hashi', 'kg', true, 2),
  ('عجل بالعظم', 'beef', 'kg', true, 3),
  ('عجل بدون عظم', 'beef', 'kg', true, 4),
  ('غنم', 'sheep', 'kg', true, 5),
  ('لحم مفروم', 'minced', 'kg', false, 6),
  ('مخلفات', 'offal', 'kg', false, 7);

-- طرق الدفع
INSERT INTO payment_methods (name, code, sort_order) VALUES
  ('كاش', 'cash', 1),
  ('شبكة', 'network', 2),
  ('تحويل بنكي', 'transfer', 3),
  ('آجل', 'deferred', 4);

-- فروع تجريبية (PIN: 1234)
INSERT INTO branches (name, code, slug, pin_hash) VALUES
  ('فرع العليا', 'OLAYA', 'olaya', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
  ('فرع النخيل', 'NAKHEEL', 'nakheel', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
  ('فرع الملز', 'MALAZ', 'malaz', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

-- مستخدم مالك
INSERT INTO users (name, role, branch_id) VALUES
  ('محمد', 'owner', null);

-- 6️⃣ حقول الخطوات السبع

-- الخطوة 1: الوارد
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order, help_text) VALUES
  (1, 'hashi_incoming_count', '🐪 حاشي - الكمية', 'number', true, 1, 'عدد الرؤوس'),
  (1, 'hashi_incoming_weight', '🐪 حاشي - الوزن (كجم)', 'number', true, 2, null),
  (1, 'sheep_incoming_count', '🐑 غنم - الكمية', 'number', true, 3, 'عدد الرؤوس'),
  (1, 'sheep_incoming_weight', '🐑 غنم - الوزن (كجم)', 'number', true, 4, null),
  (1, 'beef_incoming_count', '🐄 عجل - الكمية', 'number', true, 5, 'عدد الرؤوس'),
  (1, 'beef_incoming_weight', '🐄 عجل - الوزن (كجم)', 'number', true, 6, null),
  (1, 'offal_incoming', '🥩 مخلفات - ماذا وصل؟', 'textarea', false, 7, 'اذكر تفاصيل المخلفات');

-- الخطوة 2: المبيعات
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, file_types, sort_order, help_text) VALUES
  (2, 'sales_pdf', 'رفع ملف المبيعات (PDF)', 'file', false, ARRAY['pdf', 'jpg', 'jpeg', 'png'], 1, 'ملف نظام المبيعات'),
  (2, 'total_sales', 'إجمالي المبيعات (ريال)', 'number', true, null, 2, null),
  (2, 'invoice_count', 'عدد الفواتير', 'number', true, null, 3, null),
  (2, 'returns_value', 'قيمة المرتجعات (ريال)', 'number', false, null, 4, null);

-- الخطوة 3: تفاصيل المبيعات
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order) VALUES
  (3, 'hashi_bone_weight', 'حاشي بالعظم (كجم)', 'number', true, 1),
  (3, 'hashi_clean_weight', 'حاشي صافي (كجم)', 'number', true, 2),
  (3, 'sheep_weight', 'غنم (كجم)', 'number', true, 3),
  (3, 'beef_bone_weight', 'عجل بالعظم (كجم)', 'number', true, 4),
  (3, 'beef_clean_weight', 'عجل صافي (كجم)', 'number', true, 5),
  (3, 'offal_total_price', 'إجمالي سعر المخلفات (ريال)', 'number', false, 6);

-- الخطوة 4: الصادر
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order, help_text, options) VALUES
  (4, 'outgoing_items', 'الصادرات', 'text', false, 1, 'يمكنك إضافة عدة صادرات', '["غنم", "حاشي", "عجل", "مخلفات"]');

-- الخطوة 5: المتبقي في الثلاجة
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, file_types, sort_order, help_text) VALUES
  (5, 'fridge_photo', 'صورة الثلاجة', 'file', true, ARRAY['jpg', 'jpeg', 'png'], 1, null),
  (5, 'hashi_remaining', 'حاشي المتبقي (كجم)', 'number', true, null, 2, 'الوزن الفعلي في الثلاجة'),
  (5, 'sheep_remaining', 'غنم المتبقي (كجم)', 'number', true, null, 3, null),
  (5, 'beef_remaining', 'عجل المتبقي (كجم)', 'number', true, null, 4, null),
  (5, 'offal_remaining', 'مخلفات متبقية', 'textarea', false, null, 5, 'اذكر كل نوع وكميته');

-- الخطوة 6: الأموال
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, file_types, sort_order) VALUES
  (6, 'cash_photo', 'صورة الكاش', 'file', false, ARRAY['jpg', 'jpeg', 'png'], 1),
  (6, 'cash_amount', 'الكاش (ريال)', 'number', true, null, 2),
  (6, 'network_amount', 'الشبكة (ريال)', 'number', true, null, 3),
  (6, 'transfer_amount', 'الحوالة البنكية (ريال)', 'number', true, null, 4),
  (6, 'deferred_amount', 'الآجل (ريال)', 'number', true, null, 5);

-- الخطوة 7: المراجعة والمصروفات
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order, help_text) VALUES
  (7, 'expenses', 'المصروفات', 'text', false, 1, 'أضف بيان المصروف والمبلغ'),
  (7, 'final_notes', 'ملاحظات نهائية', 'textarea', false, 2, null),
  (7, 'confirmation', 'أؤكد صحة جميع البيانات', 'checkbox', true, 3, null);

-- ✅ تم! الآن كل شيء جاهز
