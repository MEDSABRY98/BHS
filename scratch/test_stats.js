const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data: managers } = await supabase.from('bhs_USERS').select('ID, NAME, IS_SALESMANAGER').eq('IS_SALESMANAGER', 'true');
  console.log('Sales Managers:', managers);

  if (managers && managers.length > 0) {
    const userId = managers[0].ID;
    const { data, error } = await supabase.rpc('get_sales_stock_raw_data', {
      p_user_id: userId,
      p_invoice_type: 'all',
      p_year: null,
      p_month: null,
      p_date_from: null,
      p_date_to: null,
      p_area: null,
      p_market: null,
      p_merchandiser: null,
      p_sales_rep: null,
      p_product_tag: null
    });

    if (error) console.error('RPC Error:', error);
    else {
      console.log('Sample row from RPC:', data && data.length > 0 ? data[0] : 'No rows');
      console.log('Total rows returned:', data ? data.length : 0);
    }
  }
}

test();
