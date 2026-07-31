import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbUrl = readFileSync(join(root, '.env.local'), 'utf8')
  .match(/DATABASE_URL=(.+)/)[1]
  .trim()
  .replace(':6543/', ':5432/');

const sql = readFileSync(join(root, 'app/DataBase/docs/inventory_locations_table.sql'), 'utf8');

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
await client.query(sql);
await client.end();
console.log('Applied inventory_locations_table.sql (incl. RLS policies)');
