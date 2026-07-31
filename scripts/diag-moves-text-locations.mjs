import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const sb = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(),
  env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim(),
);
const dbUrl = env.match(/DATABASE_URL=(.+)/)[1].trim().replace(':6543/', ':5432/');

function isLocId(v) {
  const base = String(v || '').split('#')[0].trim().toUpperCase();
  return base.startsWith('LOC-') && !Number.isNaN(parseInt(base.slice(4), 10));
}

const { data: moves, error } = await sb
  .from('web_INVENTORY_MOVES')
  .select('ID, "LOCATION FROM", "LOCATION TO"')
  .limit(5000);
if (error) throw error;

const textFrom = new Set();
const textTo = new Set();
let rowsWithText = 0;

for (const row of moves || []) {
  const from = String(row['LOCATION FROM'] ?? '').trim();
  const to = String(row['LOCATION TO'] ?? '').trim();
  const fromText = from && !isLocId(from);
  const toText = to && !isLocId(to);
  if (fromText || toText) {
    rowsWithText++;
    if (fromText) textFrom.add(from);
    if (toText) textTo.add(to);
  }
}

console.log('Sampled moves:', moves?.length ?? 0);
console.log('Rows with text locations:', rowsWithText);
console.log('\nDistinct text LOCATION FROM (' + textFrom.size + '):');
[...textFrom].sort().forEach((x) => console.log(' ', x));
console.log('\nDistinct text LOCATION TO (' + textTo.size + '):');
[...textTo].sort().forEach((x) => console.log(' ', x));

const { data: locs } = await sb.from('web_INVENTORY_LOCATIONS').select('ID, "LOCATION NAME"');
console.log('\nRegistry locations:', locs?.length ?? 0);

const registry = new Map();
(locs || []).forEach((r) => {
  registry.set(String(r['LOCATION NAME']).toLowerCase(), r.ID);
});

const unmapped = new Set([...textFrom, ...textTo]);
const missing = [...unmapped].filter((n) => !registry.has(n.toLowerCase()));
console.log('\nUnmapped names not in registry (' + missing.length + '):');
missing.sort().forEach((x) => console.log(' ', x));

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
const total = await client.query('SELECT COUNT(*)::int n FROM "web_INVENTORY_MOVES"');
const textCount = await client.query(`
  SELECT COUNT(*)::int n FROM "web_INVENTORY_MOVES"
  WHERE "LOCATION FROM" !~ '^LOC-[0-9]+'
     OR "LOCATION TO" !~ '^LOC-[0-9]+'
`);
console.log('\n=== Full DB ===');
console.log('Total moves:', total.rows[0].n);
console.log('Rows with non-LOC FROM or TO:', textCount.rows[0].n);
await client.end();
