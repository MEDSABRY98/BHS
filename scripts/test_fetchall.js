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

async function fetchAllData(queryFactory) {
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    } else {
      hasMore = false;
    }
  }
  return allData;
}

fetchAllData(() => supabase.from('bhs_CUSTOMERS').select('"CUSTOMER ID", "CUSTOMER CITY"'))
  .then(data => console.log('Total customers:', data.length));
