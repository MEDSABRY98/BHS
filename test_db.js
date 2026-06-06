const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  const { data, error } = await supabase
    .from('web_Sales_DB_CUSTOMERSMAPPING')
    .select('USER_ID, "CUSTOMER ID"')
    .limit(10);
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sample rows in DB:', data);
  }
}
checkDb();
