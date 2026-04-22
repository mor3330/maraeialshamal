-- فحص IDs الفروع وتقاريرها
SELECT 
  b.id as branch_id,
  b.name as branch_name,
  b.slug as branch_slug,
  COUNT(dr.id) as reports_count
FROM branches b
LEFT JOIN daily_reports dr ON b.id = dr.branch_id
GROUP BY b.id, b.name, b.slug
ORDER BY b.name;

-- فحص التقارير لفرع الملقا بالتفصيل
SELECT 
  b.id as branch_id,
  b.name,
  b.slug,
  dr.id as report_id,
  dr.report_date,
  dr.status,
  dr.total_sales,
  dr.submitted_at
FROM branches b
LEFT JOIN daily_reports dr ON b.id = dr.branch_id
WHERE b.slug = 'malaz'
ORDER BY dr.report_date DESC;
