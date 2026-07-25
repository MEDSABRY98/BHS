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

const client = new pg.Client({
  connectionString: loadDatabaseUrl(),
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  const { rowCount } = await client.query(`
    UPDATE "web_Sales_DB_CUSTOMERSMAPPING" AS m
    SET "AREA" = TRIM(c."CUSTOMER CITY")
    FROM "bhs_CUSTOMERS" AS c
    WHERE m."CUSTOMER ID" = c."CUSTOMER ID"
      AND TRIM(COALESCE(c."CUSTOMER CITY", '')) <> ''
      AND COALESCE(m."AREA", '') IS DISTINCT FROM TRIM(c."CUSTOMER CITY")
  `);

  console.log(`Updated ${rowCount ?? 0} mapping row(s) with customer city as AREA.`);

  const { rows: sample } = await client.query(`
    SELECT m."CUSTOMER ID", m."AREA", c."CUSTOMER CITY"
    FROM "web_Sales_DB_CUSTOMERSMAPPING" m
    JOIN "bhs_CUSTOMERS" c ON m."CUSTOMER ID" = c."CUSTOMER ID"
    WHERE TRIM(COALESCE(c."CUSTOMER CITY", '')) <> ''
    LIMIT 5
  `);

  console.log('Sample rows:', sample);
} finally {
  await client.end();
}
