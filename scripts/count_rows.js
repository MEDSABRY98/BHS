const pkg = require('pg');
const { Client } = pkg;
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=(.*)/);
const client = new Client({ connectionString: dbUrlMatch[1].trim() });
client.connect().then(() => {
  return client.query('SELECT COUNT(*) FROM "mix_DEBIT"');
}).then(res => {
  console.log('Row count:', res.rows[0].count);
  return client.query('SELECT * FROM "mix_DEBIT" LIMIT 1');
}).then(res => {
  console.log('Sample row:', res.rows[0]);
  return client.end();
}).catch(console.error);
