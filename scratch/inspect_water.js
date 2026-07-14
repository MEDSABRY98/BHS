const { Client } = require('pg');
const databaseUrl = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const movesRes = await client.query(`
    SELECT m."DATE", m."REFERENCE", m."LOCATION FROM", m."LOCATION TO", m."PRODUCT ID", p."PRODUCT NAME", m."QTY"
    FROM "web_INVENTORY_MOVES" m
    LEFT JOIN "bhs_PRODUCTS" p ON m."PRODUCT ID" = p."PRODUCT ID"
    WHERE m."LOCATION FROM" ILIKE '%Production%' OR m."LOCATION TO" ILIKE '%Production%'
    ORDER BY m."DATE" ASC
  `);

  console.log(`Moves related to Production (${movesRes.rows.length} rows):`);
  movesRes.rows.forEach(r => {
    console.log(`${r.DATE} | ${r.REFERENCE} | ${r['PRODUCT NAME']} | FROM: '${r['LOCATION FROM']}' | TO: '${r['LOCATION TO']}' | QTY: ${r.QTY}`);
  });

  await client.end();
}

main().catch(console.error);
