import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}

const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const tests = [
  ['web_Suppliers_Invoices', 'DATE'],
  ['web_Suppliers_Matching', 'ID'],
];

for (const [table, select] of tests) {
  const { data, error, count } = await c.from(table).select(select, { count: 'exact', head: true });
  console.log(`${table}:`, error ? `ERROR: ${error.message}` : `OK (count=${count})`);
}
