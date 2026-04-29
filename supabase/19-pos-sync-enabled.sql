-- =====================================================
-- إضافة عمود pos_sync_enabled لجدول branches
-- يتحكم في تفعيل/إيقاف مزامنة POS (Aronium) لكل فرع
-- =====================================================

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS pos_sync_enabled BOOLEAN DEFAULT TRUE;

-- تفعيل المزامنة لجميع الفروع الحالية
UPDATE branches SET pos_sync_enabled = TRUE WHERE pos_sync_enabled IS NULL;

-- التحقق
SELECT id, name, is_active, pos_sync_enabled FROM branches ORDER BY name;
