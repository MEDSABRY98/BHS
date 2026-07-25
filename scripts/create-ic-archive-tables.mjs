import fs from 'fs';
import pg from 'pg';

function loadDatabaseUrl() {
  const envPath = '.env.local';
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found');
  }
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((row) => row.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL missing in .env.local');
  return line.slice('DATABASE_URL='.length).trim();
}

const sql = fs.readFileSync('app/InventoryCounting/docs/archive_tables.sql', 'utf8');
const client = new pg.Client({
  connectionString: loadDatabaseUrl(),
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);

  const { rows } = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename ILIKE '%inventory_count%archive%'
    ORDER BY tablename
  `);

  if (rows.length === 0) {
    const allWeb = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename ILIKE 'web_%'
      ORDER BY tablename
    `);
    console.log('No archive tables matched. web_* tables sample:', allWeb.rows.slice(-10));
  }

  console.log('Created/verified tables:');
  for (const row of rows) {
    console.log(' -', row.tablename);
  }
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
