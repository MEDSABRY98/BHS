const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissingProducts() {
  const { data: sales, error: sErr } = await supabase
    .from('web_Sales_DB')
    .select('"PRODUCT ID"')
    .limit(5000);
    
  if (sErr) return console.error('Sales Error:', sErr);

  const { data: products, error: pErr } = await supabase
    .from('bhs_PRODUCTS')
    .select('"PRODUCT ID", "PRODUCT NAME"');

  if (pErr) return console.error('Products Error:', pErr);

  const prodSet = new Set(products.map(p => String(p["PRODUCT ID"]).trim()));
  
  const missingIds = new Set();
  sales.forEach(s => {
    const id = String(s["PRODUCT ID"] || '').trim();
    if (id && !prodSet.has(id)) {
      missingIds.add(id);
    }
  });

  console.log(Found  unique PRODUCT IDs in first 5000 sales that are missing from bhs_PRODUCTS.);
  console.log('Sample missing IDs:', Array.from(missingIds).slice(0, 10));
}
checkMissingProducts();
