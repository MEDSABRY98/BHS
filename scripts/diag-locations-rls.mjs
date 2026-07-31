import pg from 'pg';
import { readFileSync } from 'fs';

const dbUrl = readFileSync('.env.local', 'utf8')
  .match(/DATABASE_URL=(.+)/)[1]
  .trim()
  .replace(':6543/', ':5432/');

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

const rls = await client.query(`
  SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('web_INVENTORY_LOCATIONS', 'web_INVENTORY_ITEM_CODE', 'web_INVENTORY_MOVES')
  ORDER BY 1
`);
console.log('RLS enabled:', rls.rows);

const policies = await client.query(`
  SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE tablename IN ('web_INVENTORY_LOCATIONS', 'web_INVENTORY_ITEM_CODE', 'web_INVENTORY_MOVES')
  ORDER BY tablename, policyname
`);
console.log('\nPolicies:', policies.rows);

const sample = await client.query('SELECT * FROM "web_INVENTORY_LOCATIONS" LIMIT 3');
console.log('\nSample rows:', sample.rows);

await client.end();
