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
  console.log('Testing Products Balance calculations...');
  const { data: products } = await supabase.from('bhs_PRODUCTS').select('*');
  console.log('Total bhs_PRODUCTS:', products ? products.length : 0);

  const { data: moves, error } = await supabase
    .from('web_INVENTORY_MOVES')
    .select('ID,DATE,REFERENCE,"LOCATION FROM","LOCATION TO","PRODUCT ID",QTY')
    .order('DATE', { ascending: true })
    .limit(100);

  if (error) console.error('Moves error:', error);
  else console.log('Sample moves count:', moves ? moves.length : 0);
}

test();
