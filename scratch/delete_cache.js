const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  console.log('1. Deleting sales_cache.json from storage...');
  const { data, error } = await supabase
    .storage
    .from('sales-cache')
    .remove(['sales_cache.json']);

  if (error) {
    console.error('Error deleting cache file:', error);
  } else {
    console.log('Successfully deleted cache file from Supabase Storage:', data);
  }
}

run();
