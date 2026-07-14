const { Client } = require('pg');
const databaseUrl = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const query = `
    SELECT 
      "LOCATION FROM" AS location_from, 
      "LOCATION TO" AS location_to, 
      COUNT(*) AS total_moves
    FROM "web_INVENTORY_MOVES"
    GROUP BY "LOCATION FROM", "LOCATION TO"
    ORDER BY total_moves DESC;
  `;

  const res = await client.query(query);
  console.log('--- Movement Pairs (LOCATION FROM -> LOCATION TO) ---');
  res.rows.forEach(r => {
    console.log(`${r.location_from}  -->  ${r.location_to}  (Count: ${r.total_moves})`);
  });

  await client.end();
}

main().catch(console.error);
