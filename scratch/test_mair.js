const { Client } = require('pg');
const databaseUrl = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to DB');

  const start = Date.now();

  const res1 = await client.query(`
    SELECT COUNT(*) 
    FROM v_sales_mapped 
    WHERE customername = 'MAIR GROUP - P.J.S.C' OR customermainname = 'MAIR GROUP - P.J.S.C'
  `);
  console.log('Count of MAIR GROUP rows:', res1.rows[0].count, `Time taken: ${Date.now() - start}ms`);

  const start2 = Date.now();
  try {
    const res2 = await client.query(`
      SELECT get_sales_customer_details_raw(
        'R-0027',
        'MAIR GROUP - P.J.S.C',
        '',
        'sub',
        NULL, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, NULL
      )
    `);
    console.log('RPC execution time:', Date.now() - start2, 'ms');
  } catch (err) {
    console.error('RPC Error:', err.message);
  }

  await client.end();
}

main().catch(console.error);
