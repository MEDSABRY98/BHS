import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const sb = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(),
  env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim(),
);

let all = [];
let from = 0;
const pageSize = 1000;
while (true) {
  const { data, error } = await sb
    .from('web_INVENTORY_LOCATIONS')
    .select('ID, "LOCATION NAME", "LOCATION TYPE"')
    .order('ID', { ascending: true })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  if (!data?.length) break;
  all = all.concat(data);
  if (data.length < pageSize) break;
  from += pageSize;
}
console.log('Total fetched:', all.length);
