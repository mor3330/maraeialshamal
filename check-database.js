const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yanbsscyclnmvlculxci.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhbmJzc2N5Y2xubXZsY3VseGNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjEzODYxNiwiZXhwIjoyMDkxNzE0NjE2fQ.89xtA8-OT04r9QEhArvhtpK8I3pOPp4apfY2FhYLYHs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('\n========================================');
  console.log('فحص قاعدة البيانات الكامل');
  console.log('========================================\n');

  // 1. فحص جميع الفروع
  console.log('1️⃣ جميع الفروع المسجلة:');
  console.log('─'.repeat(80));
  const { data: branches, error: branchesError } = await supabase
    .from('branches')
    .select('id, name, slug, created_at')
    .order('name');
  
  if (branchesError) {
    console.error('❌ خطأ في جلب الفروع:', branchesError);
  } else {
    console.table(branches.map(b => ({
      'الاسم': b.name,
      'الـ Slug': b.slug,
      'ID (أول 8 أحرف)': b.id.substring(0, 8),
      'تاريخ الإنشاء': b.created_at
    })));
  }

  // 2. فحص جميع التقارير
  console.log('\n2️⃣ جميع التقارير المسجلة:');
  console.log('─'.repeat(80));
  const { data: reports, error: reportsError } = await supabase
    .from('daily_reports')
    .select('id, branch_id, report_date, status, total_sales, submitted_at')
    .order('report_date', { ascending: false });
  
  if (reportsError) {
    console.error('❌ خطأ في جلب التقارير:', reportsError);
  } else {
    console.log(`📊 إجمالي التقارير: ${reports.length}\n`);
    
    // دمج بيانات الفروع مع التقارير
    const reportsWithBranch = reports.map(r => {
      const branch = branches?.find(b => b.id === r.branch_id);
      return {
        'ID (أول 8)': r.id.substring(0, 8),
        'الفرع': branch ? branch.name : 'غير معروف',
        'التاريخ': r.report_date,
        'الحالة': r.status,
        'المبيعات': r.total_sales?.toFixed(2) || '0',
        'وقت الإرسال': r.submitted_at
      };
    });
    
    console.table(reportsWithBranch);
  }

  // 3. فحص التقارير بتاريخ 16
  console.log('\n3️⃣ التقارير بتاريخ 2026-04-16:');
  console.log('─'.repeat(80));
  const { data: reports16, error: reports16Error } = await supabase
    .from('daily_reports')
    .select('*, branches(name, slug)')
    .eq('report_date', '2026-04-16')
    .order('submitted_at');
  
  if (reports16Error) {
    console.error('❌ خطأ في جلب تقارير 16:', reports16Error);
  } else {
    if (reports16.length === 0) {
      console.log('⚠️  لا توجد تقارير بتاريخ 2026-04-16');
    } else {
      console.log(`✅ عدد التقارير: ${reports16.length}\n`);
      console.table(reports16.map(r => ({
        'ID': r.id.substring(0, 8),
        'الفرع': r.branches?.name || 'غير معروف',
        'المبيعات': r.total_sales?.toFixed(2) || '0',
        'الحالة': r.status,
        'وقت الإرسال': r.submitted_at
      })));
    }
  }

  // 4. فحص تقارير فرع مراعي الشمال
  console.log('\n4️⃣ جميع تقارير فرع مراعي الشمال:');
  console.log('─'.repeat(80));
  
  const alshamalBranch = branches?.find(b => b.slug === 'alshamal');
  
  if (!alshamalBranch) {
    console.log('⚠️  فرع مراعي الشمال غير موجود!');
  } else {
    console.log(`✅ ID الفرع: ${alshamalBranch.id}\n`);
    
    const { data: alshamalReports, error: alshamalError } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('branch_id', alshamalBranch.id)
      .order('report_date', { ascending: false });
    
    if (alshamalError) {
      console.error('❌ خطأ في جلب تقارير الفرع:', alshamalError);
    } else {
      console.log(`📊 إجمالي تقارير الفرع: ${alshamalReports.length}\n`);
      
      if (alshamalReports.length > 0) {
        console.table(alshamalReports.map(r => ({
          'ID (أول 8)': r.id.substring(0, 8),
          'التاريخ': r.report_date,
          'الحالة': r.status,
          'المبيعات': r.total_sales?.toFixed(2) || '0',
          'الكاش المتوقع': r.cash_expected?.toFixed(2) || '0',
          'الكاش الفعلي': r.cash_actual?.toFixed(2) || '0',
          'وقت الإرسال': r.submitted_at
        })));
      } else {
        console.log('⚠️  لا توجد تقارير لهذا الفرع');
      }
    }
  }

  // 5. فحص التقارير حسب التاريخ
  console.log('\n5️⃣ ملخص التقارير حسب التاريخ:');
  console.log('─'.repeat(80));
  
  if (reports && reports.length > 0) {
    const reportsByDate = reports.reduce((acc, r) => {
      if (!acc[r.report_date]) {
        acc[r.report_date] = [];
      }
      acc[r.report_date].push(r);
      return acc;
    }, {});
    
    Object.keys(reportsByDate).sort().reverse().forEach(date => {
      const dateReports = reportsByDate[date];
      console.log(`\n📅 ${date} - (${dateReports.length} تقرير):`);
      dateReports.forEach(r => {
        const branch = branches?.find(b => b.id === r.branch_id);
        console.log(`   - ${branch?.name || 'غير معروف'}: ${r.total_sales?.toFixed(2) || '0'} ريال - ${r.status}`);
      });
    });
  }

  console.log('\n========================================');
  console.log('انتهى الفحص');
  console.log('========================================\n');
}

checkDatabase().catch(console.error);
