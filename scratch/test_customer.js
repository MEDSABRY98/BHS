const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function testCustomer() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const userRes = await client.query(`SELECT "ID", "NAME" FROM "bhs_USERS" WHERE "NAME" ILIKE '%sabry%' LIMIT 1`);
    const userId = userRes.rows[0]['ID'];

    const searchName = 'MAIR GROUP - P.J.S.C';
    const rpcRes = await client.query(`
      SELECT get_sales_customer_details_raw(
        $1, $2, '', 'main', NULL, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, NULL
      ) as res;
    `, [userId, searchName]);

    const result = rpcRes.rows[0].res;
    const data = result.data || [];

    console.log('Total items for MAIR GROUP - P.J.S.C:', data.length);

    // Group sub-customers
    const subCustomersMap = new Map();
    data.forEach(item => {
      const sub = item.customerName || item.customername || 'Unknown';
      const amt = Number(item.amount) || 0;
      subCustomersMap.set(sub, (subCustomersMap.get(sub) || 0) + amt);
    });

    console.log(`Unique sub-customers count for ${searchName}:`, subCustomersMap.size);
    console.log('Top 10 Sub-Customers by Amount:');
    const sortedSubs = Array.from(subCustomersMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    sortedSubs.forEach(([sub, amt], idx) => {
      console.log(`  ${idx + 1}. ${sub}: ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

testCustomer();
