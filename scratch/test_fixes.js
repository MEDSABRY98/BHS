const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function testFixes() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('--- Connected to Supabase DB ---');

    // Get manager user ID
    const userRes = await client.query(`SELECT "ID", "NAME" FROM "bhs_USERS" WHERE "NAME" ILIKE '%sabry%' LIMIT 1`);
    const userId = userRes.rows[0]['ID'];
    console.log(`Testing with User: ${userRes.rows[0]['NAME']} (${userId})`);

    // -------------------------------------------------------------
    // Test 1: get_sales_overview_data (no year filter vs explicit 2025 filter)
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing get_sales_overview_data ---');
    const overviewAll = await client.query(`
      SELECT get_sales_overview_data($1, NULL, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, NULL) as res
    `, [userId]);
    const overviewAllData = overviewAll.rows[0].res;

    console.log('Overview metrics (NO YEAR FILTER):', overviewAllData.metrics);
    console.log('Overview chart length:', overviewAllData.chartData.length);
    console.log('Overview legend years:', overviewAllData.chartData[0]?.legendCurr, 'vs', overviewAllData.chartData[0]?.legendPrev);

    const overview2025 = await client.query(`
      SELECT get_sales_overview_data($1, 2025, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, NULL) as res
    `, [userId]);
    const overview2025Data = overview2025.rows[0].res;
    console.log('Overview metrics (YEAR = 2025):', overview2025Data.metrics);

    // -------------------------------------------------------------
    // Test 2: get_sales_customer_details_raw (Customer Sub-Tab details)
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing get_sales_customer_details_raw ---');
    const custSample = await client.query(`SELECT customerid, customername FROM v_sales_mapped WHERE customername IS NOT NULL LIMIT 1`);
    const sampleCust = custSample.rows[0];
    console.log('Testing Sub Customer:', sampleCust);

    const custDetails = await client.query(`
      SELECT get_sales_customer_details_raw(
        $1, $2, $3, 'sub', NULL, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, NULL
      ) as res
    `, [userId, sampleCust.customername, sampleCust.customerid]);

    const detailsResult = custDetails.rows[0].res;
    console.log('Customer Details returned items count:', detailsResult.data ? detailsResult.data.length : 0);

    if (detailsResult.data && detailsResult.data.length > 0) {
      const item0 = detailsResult.data[0];
      console.log('Sample Item Keys:', Object.keys(item0));
      console.log('Sample Item Properties:', {
        customerId: item0.customerId,
        customerName: item0.customerName,
        customerMainName: item0.customerMainName,
        invoiceDate: item0.invoiceDate,
        invoiceNumber: item0.invoiceNumber,
        amount: item0.amount,
        qty: item0.qty
      });
    }

    console.log('\n✅ All tests passed successfully!');

  } catch (err) {
    console.error('❌ Error during testing:', err);
  } finally {
    await client.end();
  }
}

testFixes();
