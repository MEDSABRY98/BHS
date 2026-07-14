const { Client } = require('pg');
const databaseUrl = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const query = `
    SELECT DISTINCT loc FROM (
      SELECT DISTINCT "LOCATION FROM" AS loc FROM "web_INVENTORY_MOVES" WHERE "LOCATION FROM" IS NOT NULL AND "LOCATION FROM" != ''
      UNION
      SELECT DISTINCT "LOCATION TO" AS loc FROM "web_INVENTORY_MOVES" WHERE "LOCATION TO" IS NOT NULL AND "LOCATION TO" != ''
    ) sub
    ORDER BY loc;
  `;

  const res = await client.query(query);
  console.log('--- Unique Locations Count:', res.rows.length, '---');
  console.log(JSON.stringify(res.rows.map(r => r.loc), null, 2));

  await client.end();
}

main().catch(console.error);
