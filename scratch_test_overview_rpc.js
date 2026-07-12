const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function test() {
  console.log('Testing get_sales_overview_data RPC...');
  console.time('overview_rpc');
  const { data, error } = await supabase.rpc('get_sales_overview_data', {
    p_user_id: 'R-0001',
    p_year: 2026,
    p_invoice_type: 'all'
  });
  console.timeEnd('overview_rpc');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! Data keys:', Object.keys(data));
    console.log('Metrics:', data.metrics);
    console.log('ChartData count:', data.chartData?.length);
    console.log('Yearly Table row count:', data.yearlyTableData?.length);
    console.log('Monthly Table row count:', data.monthlyTableData?.length);
  }
}

test();
