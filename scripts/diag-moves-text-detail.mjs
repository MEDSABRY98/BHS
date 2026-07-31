import pg from 'pg';
import { readFileSync } from 'fs';

const dbUrl = readFileSync('.env.local', 'utf8')
  .match(/DATABASE_URL=(.+)/)[1]
  .trim()
  .replace(':6543/', ':5432/');

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

const textRows = await client.query(`
  SELECT COUNT(*)::int AS n FROM "web_INVENTORY_MOVES"
  WHERE "LOCATION FROM" !~ '^LOC-[0-9]+' OR "LOCATION TO" !~ '^LOC-[0-9]+'
`);
console.log('Rows needing migration:', textRows.rows[0].n);

const fromNames = await client.query(`
  SELECT "LOCATION FROM" AS name, COUNT(*)::int AS c
  FROM "web_INVENTORY_MOVES"
  WHERE "LOCATION FROM" !~ '^LOC-[0-9]+'
  GROUP BY 1 ORDER BY c DESC LIMIT 30
`);
console.log('\nTop text LOCATION FROM:');
fromNames.rows.forEach((r) => console.log(`  ${r.c}x  ${r.name}`));

const toNames = await client.query(`
  SELECT "LOCATION TO" AS name, COUNT(*)::int AS c
  FROM "web_INVENTORY_MOVES"
  WHERE "LOCATION TO" !~ '^LOC-[0-9]+'
  GROUP BY 1 ORDER BY c DESC LIMIT 30
`);
console.log('\nTop text LOCATION TO:');
toNames.rows.forEach((r) => console.log(`  ${r.c}x  ${r.name}`));

const locs = await client.query('SELECT "ID", "LOCATION NAME" FROM "web_INVENTORY_LOCATIONS"');
console.log('\nRegistry (' + locs.rows.length + '):');
locs.rows.forEach((r) => console.log(`  ${r.ID}  ${r['LOCATION NAME']}`));

await client.end();
