const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data } = await supabase.from('bhs_PRODUCTS').select('*').eq('PRODUCT ID', '48964');
  console.log("PRODUCT 48964:", data);
}
main();
