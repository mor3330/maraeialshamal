-- جدول طلبات التقارير من الإدارة
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

-- Index لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_report_requests_branch ON report_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_report_requests_date ON report_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_report_requests_status ON report_requests(status);

-- Enable RLS
ALTER TABLE report_requests ENABLE ROW LEVEL SECURITY;

-- Policy للقراءة والكتابة
CREATE POLICY "Enable all access for report_requests" ON report_requests FOR ALL USING (true);

-- Trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION update_report_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_report_requests_updated_at
BEFORE UPDATE ON report_requests
FOR EACH ROW
EXECUTE FUNCTION update_report_requests_updated_at();
