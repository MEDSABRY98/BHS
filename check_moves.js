const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const dbUrl = envFile.match(/DATABASE_URL=(.*)/)[1];
  
  const client = new Client({
    connectionString: dbUrl,
  });
  
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM public."web_INVENTORY_MOVES" LIMIT 10;');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
