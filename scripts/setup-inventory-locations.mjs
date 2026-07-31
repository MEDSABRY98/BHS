/**
 * One-shot: create web_INVENTORY_LOCATIONS, seed LOC- IDs, migrate moves to IDs.
 * Uses DATABASE_URL (pg) when available to avoid PostgREST schema-cache lag.
 * Usage: node scripts/setup-inventory-locations.mjs
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  try {
    const raw = readFileSync(join(root, '.env.local'), 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    });
  } catch {
    /* ignore */
  }
}

loadEnv();

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}
// DDL needs session/direct connection — transaction pooler (6543) can fail silently.
if (databaseUrl.includes(':6543/')) {
  databaseUrl = databaseUrl.replace(':6543/', ':5432/');
}

const LOCATIONS_TABLE = 'web_INVENTORY_LOCATIONS';
const MOVES_TABLE = 'web_INVENTORY_MOVES';

const INTERNAL_WAREHOUSES = [
  'M/WH/Mazyad',
  'S/WH/S20',
  'WA/WH/Water',
  'WA/WH/Ahmed Magdy',
  'WA/WH/Omer & Salam',
  'GM/WH/Game area',
  'HA/WH/Hashi',
];

const INFLOW_SOURCES = [
  'Partners/Vendors',
  'Partners/Customers',
  'Virtual Locations/Inventory adjustment',
  'Virtual Locations/Production',
  'Physical Locations/Subcontracting Location',
];

const OUTFLOW_DESTINATIONS = [
  'Partners/Customers',
  'Partners/Vendors',
  'Virtual Locations/Inventory adjustment',
  'Virtual Locations/Production',
  'Physical Locations/Subcontracting Location',
];

const WATER_CLUSTER = new Set(['WA/WH/Water', 'WA/WH/Ahmed Magdy', 'WA/WH/Omer & Salam']);
const INTERNAL_CORE = new Set(['M/WH/Mazyad', 'S/WH/S20', 'GM/WH/Game area', 'HA/WH/Hashi']);
const INFLOW_SET = new Set(INFLOW_SOURCES);
const OUTFLOW_SET = new Set(OUTFLOW_DESTINATIONS);
const INTERNAL_SET = new Set(INTERNAL_WAREHOUSES);

const CANONICAL = [...INTERNAL_WAREHOUSES, ...INFLOW_SOURCES, ...OUTFLOW_DESTINATIONS];
const CANONICAL_BY_LOWER = new Map(CANONICAL.map((l) => [l.toLowerCase(), l]));

function normalizeLocation(loc) {
  const trimmed = String(loc || '').trim();
  if (!trimmed) return trimmed;
  return CANONICAL_BY_LOWER.get(trimmed.toLowerCase()) ?? trimmed;
}

function getLocationSortKey(loc) {
  const slashIndex = loc.lastIndexOf('/');
  return slashIndex === -1 ? loc.trim() : loc.slice(slashIndex + 1).trim();
}

function isLocationRecordId(value) {
  const base = String(value || '').split('#')[0].trim().toUpperCase();
  if (!base.startsWith('LOC-')) return false;
  const num = parseInt(base.substring(4), 10);
  return !Number.isNaN(num);
}

function formatLocationRecordId(num) {
  return `LOC-${String(num).padStart(4, '0')}`;
}

function assignLocationType(name) {
  const canonical = normalizeLocation(name);
  if (WATER_CLUSTER.has(canonical)) return 'internal_water_cluster';
  if (INTERNAL_CORE.has(canonical)) return 'internal_core';
  const inInflow = INFLOW_SET.has(canonical);
  const inOutflow = OUTFLOW_SET.has(canonical);
  if (inInflow && !inOutflow) return 'inflow';
  if (inOutflow && !inInflow) return 'outflow';
  if (inInflow && inOutflow) return 'external';
  if (INTERNAL_SET.has(canonical)) return 'internal';
  return 'external';
}

async function createTable(client) {
  // Drop wrongly-cased table if a previous run created web_inventory_locations (unquoted DDL).
  await client.query(`DROP TABLE IF EXISTS web_inventory_locations`);

  const sql = readFileSync(join(root, 'app/DataBase/docs/inventory_locations_table.sql'), 'utf8');
  await client.query(sql);
  const check = await client.query(`SELECT to_regclass('public."web_INVENTORY_LOCATIONS"') AS reg`);
  if (!check.rows[0]?.reg) {
    throw new Error('CREATE TABLE did not persist — check DATABASE_URL / permissions');
  }
  console.log('✓ Table web_INVENTORY_LOCATIONS ready');
}

async function seedLocations(client) {
  const { rows: moveRows } = await client.query(
    `SELECT "LOCATION FROM", "LOCATION TO" FROM "${MOVES_TABLE}"`,
  );

  const names = new Set();
  CANONICAL.forEach((n) => names.add(normalizeLocation(n)));
  moveRows.forEach((row) => {
    const from = String(row['LOCATION FROM'] ?? '').trim();
    const to = String(row['LOCATION TO'] ?? '').trim();
    if (from && !isLocationRecordId(from)) names.add(normalizeLocation(from));
    if (to && !isLocationRecordId(to)) names.add(normalizeLocation(to));
  });

  const sortedNames = [...names].filter(Boolean).sort((a, b) =>
    getLocationSortKey(a).localeCompare(getLocationSortKey(b), undefined, { sensitivity: 'base' }),
  );

  const { rows: existing } = await client.query(
    `SELECT "LOCATION NAME" FROM "${LOCATIONS_TABLE}"`,
  );
  const existingNames = new Set(
    existing.map((r) => String(r['LOCATION NAME'] || '').trim().toLowerCase()),
  );

  const toInsert = sortedNames.filter((n) => !existingNames.has(n.toLowerCase()));
  if (toInsert.length === 0) {
    console.log(`✓ Seed: ${sortedNames.length} locations already in DB (0 new)`);
    return;
  }

  const { rows: maxRow } = await client.query(
    `SELECT "ID" FROM "${LOCATIONS_TABLE}" ORDER BY "ID" DESC LIMIT 1`,
  );
  let nextNum = 1;
  if (maxRow[0]?.ID) {
    const base = String(maxRow[0].ID).split('#')[0].trim().toUpperCase();
    const num = parseInt(base.substring(4), 10);
    if (!Number.isNaN(num)) nextNum = num + 1;
  }

  for (let i = 0; i < toInsert.length; i++) {
    const name = toInsert[i];
    const id = formatLocationRecordId(nextNum + i);
    const type = assignLocationType(name);
    await client.query(
      `INSERT INTO "${LOCATIONS_TABLE}" ("ID", "LOCATION NAME", "LOCATION TYPE") VALUES ($1, $2, $3)`,
      [id, name, type],
    );
  }

  console.log(`✓ Seed: inserted ${toInsert.length} locations (${sortedNames.length} total)`);
}

async function migrateMoves(client) {
  const { rows: locRows } = await client.query(
    `SELECT "ID", "LOCATION NAME" FROM "${LOCATIONS_TABLE}"`,
  );

  const nameToId = new Map();
  locRows.forEach((row) => {
    const id = String(row.ID || '').trim();
    const name = String(row['LOCATION NAME'] || '').trim();
    if (!id || !name) return;
    nameToId.set(name.toLowerCase(), id);
    nameToId.set(normalizeLocation(name).toLowerCase(), id);
  });

  if (nameToId.size === 0) throw new Error('No locations in registry');

  const { rows: moves } = await client.query(
    `SELECT "ID", "LOCATION FROM", "LOCATION TO" FROM "${MOVES_TABLE}"`,
  );

  const unmapped = new Set();
  const updates = [];

  function resolve(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return trimmed;
    if (isLocationRecordId(trimmed)) return trimmed.toUpperCase();
    const normalized = normalizeLocation(trimmed);
    return (
      nameToId.get(trimmed.toLowerCase()) ??
      nameToId.get(normalized.toLowerCase()) ??
      null
    );
  }

  moves.forEach((row) => {
    const id = String(row.ID || '').trim();
    const rawFrom = String(row['LOCATION FROM'] ?? '').trim();
    const rawTo = String(row['LOCATION TO'] ?? '').trim();
    if (!id) return;

    const from = resolve(rawFrom);
    const to = resolve(rawTo);
    if (rawFrom && from === null) unmapped.add(rawFrom);
    if (rawTo && to === null) unmapped.add(rawTo);
    if (from === null || to === null) return;
    if (from === rawFrom && to === rawTo) return;

    updates.push({ id, from, to });
  });

  if (unmapped.size > 0) {
    console.error('✗ Unmapped location names:', [...unmapped].sort());
    throw new Error(`${unmapped.size} location name(s) could not be mapped`);
  }

  let updated = 0;
  for (const item of updates) {
    await client.query(
      `UPDATE "${MOVES_TABLE}" SET "LOCATION FROM" = $1, "LOCATION TO" = $2 WHERE "ID" = $3`,
      [item.from, item.to, item.id],
    );
    updated += 1;
  }

  const skipped = moves.length - updates.length;
  console.log(`✓ Migrate: updated ${updated} moves (${skipped} already had IDs)`);
}

async function verify(client) {
  const { rows: locs } = await client.query(
    `SELECT "ID", "LOCATION NAME", "LOCATION TYPE" FROM "${LOCATIONS_TABLE}" ORDER BY "ID"`,
  );
  console.log(`\nLocations (${locs.length}):`);
  locs.forEach((r) =>
    console.log(`  ${r.ID}  ${r['LOCATION NAME']}  [${r['LOCATION TYPE']}]`),
  );

  const { rows: sample } = await client.query(
    `SELECT "ID", "LOCATION FROM", "LOCATION TO" FROM "${MOVES_TABLE}" LIMIT 5`,
  );
  console.log(`\nSample moves (first ${sample.length}):`);
  sample.forEach((r) =>
    console.log(`  ${r.ID}: ${r['LOCATION FROM']} → ${r['LOCATION TO']}`),
  );
}

async function main() {
  console.log('Inventory Locations setup\n');
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await createTable(client);
    await seedLocations(client);
    await migrateMoves(client);
    await verify(client);
    console.log('\nDone.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\nFailed:', err.message || err);
  process.exit(1);
});
