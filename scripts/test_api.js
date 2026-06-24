const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

supabase.from('mix_DEBIT').select('*').limit(5).then(({ data, error }) => {
  if (error) console.error('Supabase error:', error);
  else console.log('Supabase data:', data);
});
