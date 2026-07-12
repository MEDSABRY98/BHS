const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: pData } = await supabase.from('bhs_PRODUCTS').select('*').limit(1);
  console.log("PRODUCT:", pData);
  const { data: sData } = await supabase.from('bhs_SUPPLIERS').select('*').limit(1);
  console.log("SUPPLIER:", sData);
}

main();
