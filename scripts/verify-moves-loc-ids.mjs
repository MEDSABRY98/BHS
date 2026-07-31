import pg from 'pg';
import { readFileSync } from 'fs';

const dbUrl = readFileSync('.env.local', 'utf8')
  .match(/DATABASE_URL=(.+)/)[1]
  .trim()
  .replace(':6543/', ':5432/');

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

const total = await client.query('SELECT COUNT(*)::int AS n FROM "web_INVENTORY_MOVES"');
const textFrom = await client.query(
  `SELECT COUNT(*)::int AS n FROM "web_INVENTORY_MOVES" WHERE "LOCATION FROM" !~ '^LOC-[0-9]+'`,
);
const textTo = await client.query(
  `SELECT COUNT(*)::int AS n FROM "web_INVENTORY_MOVES" WHERE "LOCATION TO" !~ '^LOC-[0-9]+'`,
);
const eitherText = await client.query(
  `SELECT COUNT(*)::int AS n FROM "web_INVENTORY_MOVES" WHERE "LOCATION FROM" !~ '^LOC-[0-9]+' OR "LOCATION TO" !~ '^LOC-[0-9]+'`,
);

const samples = await client.query(`
  SELECT "LOCATION FROM", "LOCATION TO", COUNT(*)::int AS c
  FROM "web_INVENTORY_MOVES"
  GROUP BY 1, 2
  ORDER BY c DESC
  LIMIT 8
`);

const badFrom = await client.query(`
  SELECT DISTINCT "LOCATION FROM" AS v
  FROM "web_INVENTORY_MOVES"
  WHERE "LOCATION FROM" !~ '^LOC-[0-9]+'
  LIMIT 20
`);
const badTo = await client.query(`
  SELECT DISTINCT "LOCATION TO" AS v
  FROM "web_INVENTORY_MOVES"
  WHERE "LOCATION TO" !~ '^LOC-[0-9]+'
  LIMIT 20
`);

console.log('Total moves:', total.rows[0].n);
console.log('Non-LOC LOCATION FROM:', textFrom.rows[0].n);
console.log('Non-LOC LOCATION TO:', textTo.rows[0].n);
console.log('Rows with any non-LOC location:', eitherText.rows[0].n);
console.log('\nTop location pairs:');
samples.rows.forEach((r) =>
  console.log(`  ${r.c}x  ${r['LOCATION FROM']} → ${r['LOCATION TO']}`),
);

if (badFrom.rows.length) {
  console.log('\nText LOCATION FROM still in DB:');
  badFrom.rows.forEach((r) => console.log(' ', r.v));
}
if (badTo.rows.length) {
  console.log('\nText LOCATION TO still in DB:');
  badTo.rows.forEach((r) => console.log(' ', r.v));
}

await client.end();
