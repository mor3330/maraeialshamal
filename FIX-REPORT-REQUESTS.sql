-- ═══════════════════════════════════════════════════════════
-- إصلاح جدول طلبات التقارير
-- نفذ هذا في Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1️⃣ تحقق من وجود الجدول
SELECT 'الجدول موجود' as status FROM information_schema.tables 
WHERE table_name = 'report_requests' AND table_schema = 'public';

-- 2️⃣ إنشاء الجدول إذا لم يكن موجوداً
CREATE TABLE IF NOT EXISTS report_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  requested_date DATE NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  requested_by TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3️⃣ إنشاء indexes
CREATE INDEX IF NOT EXISTS idx_report_requests_branch ON report_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_report_requests_date ON report_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_report_requests_status ON report_requests(status);

-- 4️⃣ تفعيل RLS
ALTER TABLE report_requests ENABLE ROW LEVEL SECURITY;

-- 5️⃣ حذف الـ policy القديمة وإنشاء جديدة
DROP POLICY IF EXISTS "Enable all access for report_requests" ON report_requests;
CREATE POLICY "Enable all access for report_requests" ON report_requests FOR ALL USING (true) WITH CHECK (true);

-- 6️⃣ Trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION update_report_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_report_requests_updated_at ON report_requests;
CREATE TRIGGER set_report_requests_updated_at
BEFORE UPDATE ON report_requests
FOR EACH ROW
EXECUTE FUNCTION update_report_requests_updated_at();

-- 7️⃣ منح الصلاحيات
GRANT ALL ON report_requests TO anon, authenticated, service_role;

-- 8️⃣ تحقق من النتيجة
SELECT 
    'الجدول جاهز ✅' as message,
    COUNT(*) as total_rows
FROM report_requests;
