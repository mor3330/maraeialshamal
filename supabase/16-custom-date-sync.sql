-- ═══════════════════════════════════════════════════
-- 16 - إضافة حقول التاريخ المخصص لجدول sync_triggers
-- ═══════════════════════════════════════════════════

-- إضافة حقل نوع المزامنة (normal / custom_date)
ALTER TABLE sync_triggers
  ADD COLUMN IF NOT EXISTS sync_type TEXT DEFAULT 'normal';

-- إضافة تاريخ البداية للمزامنة المخصصة
ALTER TABLE sync_triggers
  ADD COLUMN IF NOT EXISTS date_from DATE;

-- إضافة تاريخ النهاية للمزامنة المخصصة
ALTER TABLE sync_triggers
  ADD COLUMN IF NOT EXISTS date_to DATE;
