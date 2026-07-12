const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function test() {
  console.log('Testing get_sales_products_aggregated RPC...');
  console.time('products_rpc');
  const { data: pData, error: pErr } = await supabase.rpc('get_sales_products_aggregated', {
    p_user_id: 'R-0001',
    p_year: 2026,
    p_invoice_type: 'all'
  });
  console.timeEnd('products_rpc');
  if (pErr) console.error('Products error:', pErr);
  else console.log('Products Success! Rows count:', pData?.length);

  console.log('Testing get_sales_categories_aggregated RPC...');
  console.time('categories_rpc');
  const { data: cData, error: cErr } = await supabase.rpc('get_sales_categories_aggregated', {
    p_user_id: 'R-0001',
    p_year: 2026,
    p_invoice_type: 'all'
  });
  console.timeEnd('categories_rpc');
  if (cErr) console.error('Categories error:', cErr);
  else console.log('Categories Success! Rows count:', cData?.length);

  console.log('Testing get_sales_new_listings RPC...');
  console.time('new_listings_rpc');
  const { data: nlData, error: nlErr } = await supabase.rpc('get_sales_new_listings', {
    p_user_id: 'R-0001',
    p_year: 2026
  });
  console.timeEnd('new_listings_rpc');
  if (nlErr) console.error('New Listings error:', nlErr);
  else console.log('New Listings Success! Rows count:', nlData?.length);
}

test();
