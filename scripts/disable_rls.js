const pkg = require('pg');
const { Client } = pkg;
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=(.*)/);
const client = new Client({ connectionString: dbUrlMatch[1].trim() });

const sql = `
ALTER TABLE "mix_DEBIT" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "debit_EMILS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "debit_EMILS_LULU" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "debit_NOTES" DISABLE ROW LEVEL SECURITY;
`;

client.connect().then(() => {
  return client.query(sql);
}).then(() => {
  console.log('Disabled RLS on new tables.');
  return client.end();
}).catch(console.error);
