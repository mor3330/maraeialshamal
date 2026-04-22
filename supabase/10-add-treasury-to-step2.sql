-- ══════════════════════════════════════════════════════════════
-- إضافة حقول الخزينة (كاش، شبكة، تحويل، آجل) إلى الخطوة الثانية
-- تشغيل هذا الـ SQL في Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- أولاً: احذف إذا كانت موجودة مسبقاً في الخطوة 2 (لتجنب التكرار)
DELETE FROM step_fields
WHERE step = 2
  AND field_name IN ('cash_amount', 'network_amount', 'transfer_amount', 'deferred_amount');

-- ثانياً: أضف حقول الخزينة إلى الخطوة 2 (المبيعات)
INSERT INTO step_fields (step, field_name, field_label, field_type, is_required, sort_order, placeholder, help_text, is_active)
VALUES
  (2, 'cash_amount',     'الكاش',         'number', false, 20, '0', 'المبلغ المدفوع نقداً', true),
  (2, 'network_amount',  'الشبكة',        'number', false, 21, '0', 'المبلغ المدفوع عبر الشبكة', true),
  (2, 'transfer_amount', 'التحويل البنكي','number', false, 22, '0', 'المبلغ المحوّل بنكياً', true),
  (2, 'deferred_amount', 'الآجل',         'number', false, 23, '0', 'المبلغ المؤجل الدفع', true);

-- تحقق من النتيجة
SELECT id, step, field_name, field_label, field_type, sort_order
FROM step_fields
WHERE step = 2
ORDER BY sort_order;
