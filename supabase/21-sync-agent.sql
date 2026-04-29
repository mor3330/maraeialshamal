-- ─────────────────────────────────────────────────────────────
-- جدول sync_agent: تخزين أحدث نسخة من السكريبت لتوزيعها تلقائياً
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_agent (
  id             text        PRIMARY KEY DEFAULT 'main',
  version        text        NOT NULL DEFAULT '2.1',
  script_content text,
  updated_at     timestamptz DEFAULT now()
);

-- السماح للقراءة لجميع المستخدمين (السكريبت يقرأ بدون تسجيل)
ALTER TABLE sync_agent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_agent_read_public"
  ON sync_agent FOR SELECT
  USING (true);

-- الكتابة فقط عبر service_role
CREATE POLICY "sync_agent_write_service"
  ON sync_agent FOR ALL
  USING (auth.role() = 'service_role');

-- إدخال السجل الافتراضي
INSERT INTO sync_agent (id, version)
  VALUES ('main', '2.1')
  ON CONFLICT (id) DO NOTHING;
