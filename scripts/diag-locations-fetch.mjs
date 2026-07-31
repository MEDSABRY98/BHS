import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const dbUrl = env.match(/DATABASE_URL=(.+)/)[1].trim().replace(':6543/', ':5432/');

const sb = createClient(url, key);

console.log('=== Supabase: web_INVENTORY_LOCATIONS ===');
const r1 = await sb.from('web_INVENTORY_LOCATIONS').select('*').limit(5);
console.log('error:', r1.error?.message || null);
console.log('count:', r1.data?.length ?? 0);
if (r1.data?.length) console.log('sample:', r1.data[0]);

console.log('\n=== Supabase: web_inventory_locations ===');
const r2 = await sb.from('web_inventory_locations').select('*').limit(5);
console.log('error:', r2.error?.message || null);
console.log('count:', r2.data?.length ?? 0);
if (r2.data?.length) console.log('sample:', r2.data[0]);

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
const tables = await client.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%inventory%location%'",
);
console.log('\n=== PG tables ===', tables.rows);
for (const t of tables.rows) {
  const name = t.table_name;
  const q = name === name.toLowerCase() ? `"${name}"` : `"${name}"`;
  const c = await client.query(`SELECT COUNT(*)::int AS n FROM ${q}`);
  console.log(name, 'rows:', c.rows[0].n);
}
await client.end();
