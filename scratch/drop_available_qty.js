const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    console.log('Dropping AVAILABLE QTY column from bhs_PRODUCTS table...');
    await pool.query('ALTER TABLE "bhs_PRODUCTS" DROP COLUMN IF EXISTS "AVAILABLE QTY";');
    console.log('Successfully dropped "AVAILABLE QTY" column!');
  } catch (err) {
    console.error('Error dropping column:', err);
  } finally {
    await pool.end();
  }
}

run();
