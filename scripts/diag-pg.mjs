import pg from 'pg';
import { readFileSync } from 'fs';

const raw = readFileSync('.env.local', 'utf8');
const m = raw.match(/DATABASE_URL=(.+)/);
let url = m[1].trim();
console.log('Original port:', url.match(/:(\d+)\//)?.[1]);

for (const port of ['5432', '6543']) {
  const testUrl = url.replace(/:\d+\//, `:${port}/`);
  const client = new pg.Client({ connectionString: testUrl });
  try {
    await client.connect();
    console.log(`\n--- Port ${port} connected ---`);
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS web_INVENTORY_LOCATIONS (
          "ID" text PRIMARY KEY,
          "LOCATION NAME" text NOT NULL UNIQUE,
          "LOCATION TYPE" text NOT NULL
        )
      `);
      console.log('CREATE TABLE ok');
    } catch (e) {
      console.log('CREATE TABLE error:', e.message);
    }
    const r = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name ILIKE '%inventory%location%'
    `);
    console.log('Found tables:', r.rows);
    const r2 = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name ILIKE 'web_%'
      ORDER BY 1
    `);
    console.log('All web_ tables:', r2.rows.map((x) => x.table_name));
  } catch (e) {
    console.log(`Port ${port} connect error:`, e.message);
  } finally {
    await client.end().catch(() => {});
  }
}
