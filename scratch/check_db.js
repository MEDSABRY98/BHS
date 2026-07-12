const fs = require('fs');
const { Client } = require('pg');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const dbUrlMatch = envLocal.match(/DATABASE_URL=(.+)/);
const connectionString = dbUrlMatch[1].trim();

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();

    const indexRes = await client.query(`
      SELECT tablename, indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename IN ('bhs_CUSTOMERS', 'bhs_PRODUCTS');
    `);
    console.log('\n--- Indexes on bhs_CUSTOMERS and bhs_PRODUCTS ---');
    indexRes.rows.forEach(r => {
      console.log(`Table: ${r.tablename} | Index: ${r.indexname} | Def: ${r.indexdef}`);
    });
    
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await client.end();
  }
}

run();
