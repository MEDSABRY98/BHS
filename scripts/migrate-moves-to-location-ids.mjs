/**
 * Bulk migrate web_INVENTORY_MOVES location text → LOC- IDs via SQL JOIN.
 * Usage: node scripts/migrate-moves-to-location-ids.mjs
 */
import pg from 'pg';
import { readFileSync } from 'fs';

const dbUrl = readFileSync('.env.local', 'utf8')
  .match(/DATABASE_URL=(.+)/)[1]
  .trim()
  .replace(':6543/', ':5432/');

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

async function countTextRows() {
  const r = await client.query(`
    SELECT COUNT(*)::int AS n FROM "web_INVENTORY_MOVES"
    WHERE "LOCATION FROM" !~ '^LOC-[0-9]+' OR "LOCATION TO" !~ '^LOC-[0-9]+'
  `);
  return r.rows[0].n;
}

const before = await countTextRows();
console.log('Rows with text locations (before):', before);

if (before === 0) {
  console.log('Nothing to migrate.');
  await client.end();
  process.exit(0);
}

const unmappedFrom = await client.query(`
  SELECT DISTINCT m."LOCATION FROM" AS name
  FROM "web_INVENTORY_MOVES" m
  LEFT JOIN "web_INVENTORY_LOCATIONS" l ON l."LOCATION NAME" = m."LOCATION FROM"
  WHERE m."LOCATION FROM" !~ '^LOC-[0-9]+' AND l."ID" IS NULL
`);
const unmappedTo = await client.query(`
  SELECT DISTINCT m."LOCATION TO" AS name
  FROM "web_INVENTORY_MOVES" m
  LEFT JOIN "web_INVENTORY_LOCATIONS" l ON l."LOCATION NAME" = m."LOCATION TO"
  WHERE m."LOCATION TO" !~ '^LOC-[0-9]+' AND l."ID" IS NULL
`);

const unmapped = [...new Set([
  ...unmappedFrom.rows.map((r) => r.name),
  ...unmappedTo.rows.map((r) => r.name),
])].filter(Boolean);

if (unmapped.length > 0) {
  console.error('Unmapped location names — add to web_INVENTORY_LOCATIONS first:');
  unmapped.sort().forEach((n) => console.error(' ', n));
  await client.end();
  process.exit(1);
}

console.log('Updating LOCATION FROM...');
const fromRes = await client.query(`
  UPDATE "web_INVENTORY_MOVES" m
  SET "LOCATION FROM" = l."ID"
  FROM "web_INVENTORY_LOCATIONS" l
  WHERE m."LOCATION FROM" = l."LOCATION NAME"
    AND m."LOCATION FROM" !~ '^LOC-[0-9]+'
`);
console.log('  updated:', fromRes.rowCount);

console.log('Updating LOCATION TO...');
const toRes = await client.query(`
  UPDATE "web_INVENTORY_MOVES" m
  SET "LOCATION TO" = l."ID"
  FROM "web_INVENTORY_LOCATIONS" l
  WHERE m."LOCATION TO" = l."LOCATION NAME"
    AND m."LOCATION TO" !~ '^LOC-[0-9]+'
`);
console.log('  updated:', toRes.rowCount);

const after = await countTextRows();
console.log('Rows with text locations (after):', after);

const sample = await client.query(`
  SELECT "ID", "LOCATION FROM", "LOCATION TO"
  FROM "web_INVENTORY_MOVES"
  WHERE "LOCATION FROM" ~ '^LOC-[0-9]+'
  LIMIT 3
`);
console.log('\nSample migrated rows:');
sample.rows.forEach((r) => console.log(`  ${r.ID}: ${r['LOCATION FROM']} → ${r['LOCATION TO']}`));

await client.end();
console.log('\nDone.');
