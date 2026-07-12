const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function test() {
  console.log('Testing get_sales_top_10 RPC...');
  console.time('top10_rpc');
  const { data, error } = await supabase.rpc('get_sales_top_10', {
    p_user_id: 'R-0001',
    p_year: 2026,
    p_invoice_type: 'all'
  });
  console.timeEnd('top10_rpc');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! Data keys:', Object.keys(data));
    console.log('ProductsData count:', data.productsData?.length);
    console.log('MainCustomersData count:', data.mainCustomersData?.length);
    console.log('SubCustomersData count:', data.subCustomersData?.length);
  }
}

test();
