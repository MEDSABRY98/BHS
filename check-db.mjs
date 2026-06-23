const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type, column_default, is_identity
    FROM information_schema.columns
    WHERE table_name = 'web_Documents_Tracking';
  `);
  console.log(res.rows);
  
  // also check highest ID to set restart value if we alter it
  const countRes = await client.query(`SELECT MAX("ID") as max_id FROM "web_Documents_Tracking"`);
  console.log("Max ID:", countRes.rows[0]);
  
  await client.end();
}
run();
