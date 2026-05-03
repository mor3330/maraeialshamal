-- ══════════════════════════════════════════════════════
-- إصلاح شامل لجدول طلبات التقارير  
-- نفّذ هذا الملف كاملاً في Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- ── 1. إنشاء الجدول إذا لم يكن موجوداً ──────────────
CREATE TABLE IF NOT EXISTS report_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  requested_date DATE NOT NULL,
  notes         TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  requested_by  TEXT,
  requested_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at  TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 2. إضافة أعمدة ناقصة إن وُجدت ──────────────────
ALTER TABLE report_requests
  ADD COLUMN IF NOT EXISTS requested_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMP WITH TIME ZONE;

-- تصحيح السجلات التي تكون فيها requested_at أو created_at = null
UPDATE report_requests
SET requested_at = NOW()
WHERE requested_at IS NULL;

UPDATE report_requests
SET created_at = NOW()
WHERE created_at IS NULL;

-- ── 3. Indexes ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_report_requests_branch ON report_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_report_requests_date   ON report_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_report_requests_status ON report_requests(status);

-- ── 4. إصلاح RLS Policy ──────────────────────────────
ALTER TABLE report_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for report_requests" ON report_requests;
DROP POLICY IF EXISTS "report_requests_policy" ON report_requests;

-- السياسة الصحيحة: WITH CHECK (true) مطلوبة للـ INSERT/UPDATE
CREATE POLICY "Enable all access for report_requests"
  ON report_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── 5. منح الصلاحيات ─────────────────────────────────
GRANT ALL ON report_requests TO anon;
GRANT ALL ON report_requests TO authenticated;
GRANT ALL ON report_requests TO service_role;

-- ── 6. Trigger لتحديث updated_at ─────────────────────
CREATE OR REPLACE FUNCTION update_report_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_report_requests_updated_at ON report_requests;
CREATE TRIGGER set_report_requests_updated_at
  BEFORE UPDATE ON report_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_report_requests_updated_at();

-- ── 7. تحقق نهائي ────────────────────────────────────
SELECT
  'الجدول جاهز ✅' AS message,
  COUNT(*) AS total_rows,
  COUNT(CASE WHEN status = 'pending'   THEN 1 END) AS pending,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled
FROM report_requests;

-- تحقق من الـ Policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'report_requests';

-- اختبار إدراج تجريبي (سيُحذف بعده)
DO $$
DECLARE
  test_branch_id UUID;
  test_req_id    UUID;
BEGIN
  -- جلب أول فرع موجود
  SELECT id INTO test_branch_id FROM branches LIMIT 1;
  
  IF test_branch_id IS NOT NULL THEN
    -- إدراج تجريبي
    INSERT INTO report_requests (branch_id, requested_date, notes, requested_by)
    VALUES (test_branch_id, CURRENT_DATE, 'اختبار تلقائي - سيُحذف', '__test__')
    RETURNING id INTO test_req_id;
    
    -- حذفه مباشرة
    DELETE FROM report_requests WHERE id = test_req_id;
    
    RAISE NOTICE '✅ الإدراج والحذف يعملان بنجاح!';
  ELSE
    RAISE NOTICE '⚠️ لا توجد فروع في الجدول - أضف فرعاً أولاً';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ خطأ: %', SQLERRM;
END;
$$;
