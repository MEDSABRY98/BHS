const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
let envs = {};
envFile.split('\n').forEach(l => {
  let parts = l.split('=');
  if(parts.length > 1) {
    envs[parts[0]] = parts.slice(1).join('=').trim();
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envs.NEXT_PUBLIC_SUPABASE_URL, envs.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkCities() {
  const { data } = await supabase.from('bhs_CUSTOMERS').select('"CUSTOMER CITY"');
  let empty = 0;
  let hasCity = 0;
  data.forEach(d => {
    if (!d['CUSTOMER CITY'] || d['CUSTOMER CITY'].trim() === '') empty++;
    else hasCity++;
  });
  console.log(`Total: ${data.length}, Empty cities: ${empty}, Has city: ${hasCity}`);
}
checkCities();
