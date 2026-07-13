const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const userRes = await client.query(`SELECT "ID", "NAME" FROM "bhs_USERS" WHERE "NAME" ILIKE '%sabry%' LIMIT 1`);
    console.log('User found:', userRes.rows[0]);
    const userId = userRes.rows[0]['ID'];

    const sample = await client.query(`SELECT customerid, customername, customermainname FROM v_sales_mapped WHERE customername IS NOT NULL LIMIT 1`);
    console.log('Sample customer:', sample.rows[0]);
    const cust = sample.rows[0];

    const rpcRes = await client.query(`
      SELECT get_sales_customer_details_raw(
        $1,
        $2,
        $3,
        'sub',
        NULL, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, NULL
      ) as res;
    `, [userId, cust.customername, cust.customerid]);

    const result = rpcRes.rows[0].res;
    console.log('Result data length:', result.data ? result.data.length : 'no data');
    if (result.data && result.data.length > 0) {
      console.log('Sample data item 0 keys:', Object.keys(result.data[0]));
      console.log('Sample data item 0 content:', result.data[0]);
    }
  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

run();
