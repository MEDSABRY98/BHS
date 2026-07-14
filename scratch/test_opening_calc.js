const { Client } = require('pg');
const databaseUrl = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const INTERNAL = ['M/WH/Mazyad', 'S/WH/S20'];

  // Test 5 products
  const productsRes = await client.query(`
    SELECT "PRODUCT ID", "PRODUCT NAME", "AVAILABLE QTY" 
    FROM "bhs_PRODUCTS" 
    WHERE "AVAILABLE QTY" IS NOT NULL AND "AVAILABLE QTY" != '0' 
    LIMIT 10
  `);

  console.log('--- Testing Initial Balance Reconciliation ---');
  for (const prod of productsRes.rows) {
    const pid = prod['PRODUCT ID'];
    const currentQty = parseFloat(prod['AVAILABLE QTY']) || 0;

    const movesRes = await client.query(`
      SELECT "LOCATION FROM", "LOCATION TO", "QTY"
      FROM "web_INVENTORY_MOVES"
      WHERE "PRODUCT ID" = $1
    `, [pid]);

    let netMoves = 0;
    movesRes.rows.forEach(m => {
      const q = parseFloat(m.QTY) || 0;
      const fromInt = INTERNAL.includes(m['LOCATION FROM']);
      const toInt = INTERNAL.includes(m['LOCATION TO']);

      if (toInt && !fromInt) netMoves += q;
      else if (fromInt && !toInt) netMoves -= q;
    });

    const calculatedOpening2026 = currentQty - netMoves;
    console.log(`Product: "${prod['PRODUCT NAME']}" (${pid})`);
    console.log(`  Current OnHand in bhs_PRODUCTS: ${currentQty}`);
    console.log(`  Total Net Movements (2026): ${netMoves}`);
    console.log(`  Calculated Opening Balance (01-01-2026): ${calculatedOpening2026}`);
    console.log('--------------------------------------------------');
  }

  await client.end();
}

main().catch(console.error);
