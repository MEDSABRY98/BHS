const fs = require('fs');
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Database.');

    const sqlOverview = fs.readFileSync('scratch/sales_overview_rpc.sql', 'utf8');
    console.log('Deploying get_sales_overview_data...');
    await client.query(sqlOverview);
    console.log('Successfully deployed get_sales_overview_data!');

    const sqlCustomerDetails = fs.readFileSync('scratch/sales_customer_details_rpc.sql', 'utf8');
    console.log('Deploying get_sales_customer_details_raw...');
    await client.query(sqlCustomerDetails);
    console.log('Successfully deployed get_sales_customer_details_raw!');

  } catch (err) {
    console.error('Error executing SQL migration:', err);
  } finally {
    await client.end();
  }
}

run();
