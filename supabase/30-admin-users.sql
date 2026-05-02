-- ══════════════════════════════════════════════════════════
--  30 — نظام إدارة المستخدمين والصلاحيات
--  شغّل هذا في Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  phone           TEXT,
  pin_hash        TEXT NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  -- الصلاحيات كـ JSON: { "dashboard": true, "reports": false, ... }
  permissions     JSONB DEFAULT '{}'::JSONB,
  -- الفروع المسموح بها في الرئيسية (null = كل الفروع)
  allowed_branches UUID[] DEFAULT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- فهرس على is_active للبحث السريع
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);

-- تعطيل RLS (نفس منهج المشروع)
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
