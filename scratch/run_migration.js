const { Client } = require('pg');

const connectionString = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');
    
    // 1. Drop created_at from web_CUSTOMERS_DISCOUNTS
    await client.query(`
      ALTER TABLE "web_CUSTOMERS_DISCOUNTS" 
      DROP COLUMN IF EXISTS "created_at";
    `);
    console.log('Removed created_at column from web_CUSTOMERS_DISCOUNTS.');

    // 2. Fetch all discounts to normalize IDs
    const { rows: discounts } = await client.query(`
      SELECT * FROM "web_CUSTOMERS_DISCOUNTS" ORDER BY "ID" ASC;
    `);
    
    console.log(`Found ${discounts.length} discount records to normalize.`);

    // Begin Transaction
    await client.query('BEGIN');

    for (let i = 0; i < discounts.length; i++) {
      const d = discounts[i];
      const oldId = d.ID;
      const newId = `R-${String(i + 1).padStart(4, '0')}`;

      if (oldId !== newId) {
        console.log(`Normalizing: ${oldId} -> ${newId}`);

        // Update settlements associated with this oldId
        // The settlement ID format is S-[discountId]-[month]
        for (let month = 1; month <= 12; month++) {
          const oldSettlementId = `S-${oldId}-${month}`;
          const newSettlementId = `S-${newId}-${month}`;
          
          await client.query(`
            UPDATE "web_CUSTOMERS_DISCOUNTS_SETTLEMENTS"
            SET "ID" = $1
            WHERE "ID" = $2;
          `, [newSettlementId, oldSettlementId]);
        }

        // Update discount ID in web_CUSTOMERS_DISCOUNTS
        await client.query(`
          UPDATE "web_CUSTOMERS_DISCOUNTS"
          SET "ID" = $1
          WHERE "ID" = $2;
        `, [newId, oldId]);
      }
    }

    await client.query('COMMIT');
    console.log('Transaction committed successfully. All IDs normalized.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', err);
  } finally {
    await client.end();
  }
}

main();
