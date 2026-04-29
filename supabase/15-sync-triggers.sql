-- ─────────────────────────────────────────────
-- جدول sync_triggers: طلبات المزامنة الفورية
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_triggers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at  TIMESTAMPTZ,
  note        TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_triggers_branch_status ON sync_triggers (branch_id, status, requested_at DESC);

ALTER TABLE sync_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_triggers_all"
  ON sync_triggers FOR ALL
  USING (true)
  WITH CHECK (true);
