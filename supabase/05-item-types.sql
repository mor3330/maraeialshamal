-- جدول أنواع الأصناف (للمشتريات)
CREATE TABLE IF NOT EXISTS item_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_en TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- إدراج الأصناف الافتراضية
INSERT INTO item_types (name, name_en, display_order) VALUES
('حاشي', 'hashi', 1),
('غنم', 'sheep', 2),
('عجل', 'beef', 3),
('مخلفات', 'offal', 4)
ON CONFLICT (name) DO NOTHING;

-- فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_item_types_active ON item_types(is_active);
CREATE INDEX IF NOT EXISTS idx_item_types_order ON item_types(display_order);
