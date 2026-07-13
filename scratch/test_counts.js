const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    let res = await client.query('SELECT COUNT(*) FROM "web_Suppliers_Purchase"');
    console.log('web_Suppliers_Purchase count:', res.rows[0].count);

    res = await client.query('SELECT COUNT(*) FROM "bhs_SUPPLIERS"');
    console.log('bhs_SUPPLIERS count:', res.rows[0].count);

    res = await client.query('SELECT COUNT(*) FROM "bhs_PRODUCTS"');
    console.log('bhs_PRODUCTS count:', res.rows[0].count);

  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

run();
