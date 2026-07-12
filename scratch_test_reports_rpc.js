const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function test() {
  console.log('Testing get_sales_reports_data RPC...');
  console.time('reports_rpc');
  const { data, error } = await supabase.rpc('get_sales_reports_data', {
    p_user_id: 'R-0001',
    p_year: 2026,
    p_month: 6,
    p_invoice_type: 'all'
  });
  console.timeEnd('reports_rpc');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! Data returned keys:', Object.keys(data));
    console.log('KPIs:', JSON.stringify(data.kpis));
    console.log('Top Products count:', data.topProducts?.length);
    console.log('Top Categories count:', data.topCategories?.length);
  }
}

test();
