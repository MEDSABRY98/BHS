const { Client } = require('pg');
const databaseUrl = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const start = Date.now();
  const res = await client.query(`
    SELECT get_sales_customer_details_raw(
      'R-0017',
      'MAIR GROUP - P.J.S.C',
      '',
      'sub',
      NULL, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, NULL
    )
  `);
  console.log('Non-manager RPC Time:', Date.now() - start, 'ms');

  await client.end();
}

main().catch(console.error);
