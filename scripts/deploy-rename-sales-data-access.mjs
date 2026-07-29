import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '../app/DataBase/docs/rename_is_salesmanager_to_sales_data_access.sql');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    await client.query(sql);
    console.log('Renamed bhs_USERS.IS_SALESMANAGER to SALES_DATA_ACCESS successfully.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Deploy failed:', error.message);
  process.exit(1);
});
