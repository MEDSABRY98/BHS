const { Client } = require('pg');
const databaseUrl = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  // Check unique locations in web_INVENTORY_MOVES that might represent initial balances or adjustments
  const resLocations = await client.query(`
    SELECT DISTINCT loc FROM (
      SELECT "LOCATION FROM" AS loc FROM "web_INVENTORY_MOVES"
      UNION
      SELECT "LOCATION TO" AS loc FROM "web_INVENTORY_MOVES"
    ) t ORDER BY loc
  `);
  console.log('All Locations in web_INVENTORY_MOVES:', resLocations.rows.map(r => r.loc));

  // Check sample rows from bhs_PRODUCTS
  const resProducts = await client.query(`
    SELECT "PRODUCT ID", "PRODUCT NAME", "AVAILABLE QTY" 
    FROM "bhs_PRODUCTS" 
    LIMIT 5
  `);
  console.log('Sample bhs_PRODUCTS:', resProducts.rows);

  // Check earliest dates in web_INVENTORY_MOVES
  const resDates = await client.query(`
    SELECT MIN("DATE") as earliest_date, MAX("DATE") as latest_date, COUNT(*) as total_moves
    FROM "web_INVENTORY_MOVES"
  `);
  console.log('Moves date range:', resDates.rows[0]);

  await client.end();
}

main().catch(console.error);
