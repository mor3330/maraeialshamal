-- فحص جميع التقارير في قاعدة البيانات
SELECT 
  dr.id,
  b.name as branch_name,
  dr.report_date,
  dr.status,
  dr.total_sales,
  dr.submitted_at,
  dr.created_at
FROM daily_reports dr
LEFT JOIN branches b ON dr.branch_id = b.id
ORDER BY dr.submitted_at DESC
LIMIT 20;

-- فحص التقارير لفرع معين (الملقا)
SELECT 
  dr.id,
  b.name as branch_name,
  dr.report_date,
  dr.status,
  dr.total_sales,
  dr.submitted_at
FROM daily_reports dr
LEFT JOIN branches b ON dr.branch_id = b.id
WHERE b.slug = 'malaz' -- فرع الملقا
ORDER BY dr.submitted_at DESC;
