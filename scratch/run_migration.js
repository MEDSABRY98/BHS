const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const databaseUrl = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to PostgreSQL database');

  const sqlPath = path.join(__dirname, 'sales_customer_details_rpc.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await client.query(sql);
  console.log('Successfully deployed optimized get_sales_customer_details_raw function!');

  await client.end();
}

main().catch(err => {
  console.error('Error executing migration:', err);
  process.exit(1);
});
