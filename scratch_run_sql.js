const fs = require('fs');
const { Client } = require('pg');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const dbUrlMatch = envLocal.match(/DATABASE_URL=(.+)/);
const connectionString = dbUrlMatch[1].trim();

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const sql = fs.readFileSync('D:\\BHS\\WEB\\scratch\\sales_top10_rpc.sql', 'utf8');
    await client.query(sql);
    console.log('SQL updated successfully!');
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await client.end();
  }
}

run();
