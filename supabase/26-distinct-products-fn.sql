-- ── دالة جلب أسماء المنتجات الفريدة (بدون حد الـ 1000 صف) ──
-- شغّل هذا في Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_distinct_product_names()
RETURNS TABLE(product_name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT TRIM(si.product_name) AS product_name
  FROM sale_items si
  WHERE si.product_name IS NOT NULL
    AND TRIM(si.product_name) <> ''
  ORDER BY 1;
$$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION get_distinct_product_names() TO service_role;
GRANT EXECUTE ON FUNCTION get_distinct_product_names() TO anon;
GRANT EXECUTE ON FUNCTION get_distinct_product_names() TO authenticated;
