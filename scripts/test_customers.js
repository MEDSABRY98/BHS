const pkg = require('pg');
const { Client } = pkg;
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=(.*)/);
const client = new Client({ connectionString: dbUrlMatch[1].trim() });
client.connect().then(() => {
  return client.query('SELECT * FROM "bhs_CUSTOMERS" LIMIT 1');
}).then(res => {
  console.log('Sample row from bhs_CUSTOMERS:', res.rows[0]);
  return client.end();
}).catch(console.error);
