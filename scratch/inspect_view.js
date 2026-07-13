const { Client } = require('pg');
const databaseUrl = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  const res = await client.query(`SELECT pg_get_viewdef('v_sales_mapped', true)`);
  console.log('v_sales_mapped definition:\n', res.rows[0].pg_get_viewdef);
  await client.end();
}

main().catch(console.error);
