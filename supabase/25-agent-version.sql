-- ── إضافة عمود agent_version في sync_logs ──────────────────
-- يسمح لكل فرع يرسل إصداره عند كل مزامنة
-- الأدمن يرى أي الفروع حدّثت إلى v2.3

ALTER TABLE sync_logs
  ADD COLUMN IF NOT EXISTS agent_version TEXT DEFAULT NULL;

-- index للبحث السريع عن أحدث إصدار لكل فرع
CREATE INDEX IF NOT EXISTS idx_sync_logs_branch_version
  ON sync_logs (branch_id, agent_version, sync_start DESC);

COMMENT ON COLUMN sync_logs.agent_version IS 'إصدار sync.py الذي نفّذ هذه المزامنة';
