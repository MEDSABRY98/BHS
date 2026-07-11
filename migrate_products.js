const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    await client.connect();

    console.log("Adding new columns to bhs_PRODUCTS...");
    await client.query(`
      ALTER TABLE "bhs_PRODUCTS"
      ADD COLUMN IF NOT EXISTS "QTY" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "QTY IN BOX" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "AVAILABLE QTY" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "IS_COUNTABLE" boolean DEFAULT false;
    `);

    console.log("Fetching web_INVENTORY_PRODUCTS...");
    const invRes = await client.query('SELECT * FROM "web_INVENTORY_PRODUCTS"');
    const invProducts = invRes.rows;

    console.log("Fetching mix_INVENTORY_COUNT_PRODUCTS...");
    const countRes = await client.query('SELECT * FROM "mix_INVENTORY_COUNT_PRODUCTS"');
    const countProducts = countRes.rows;

    console.log("Fetching bhs_PRODUCTS...");
    const masterRes = await client.query('SELECT * FROM "bhs_PRODUCTS"');
    const masterProducts = masterRes.rows;

    const masterMap = new Map();
    masterProducts.forEach(p => {
      if (p['PRODUCT ID']) {
        masterMap.set(p['PRODUCT ID'].trim(), p);
      }
    });

    console.log("Migrating Inventory Products...");
    for (const p of invProducts) {
      const pid = p['PRODUCT ID'] ? p['PRODUCT ID'].trim() : null;
      if (!pid) continue;

      let master = masterMap.get(pid);
      if (master) {
        // Update
        const newTags = (p['TAGS'] && p['TAGS'].trim() !== '') ? p['TAGS'] : null;
        let finalCat = master['PRODUCT CATEGORY'];
        if (newTags && newTags !== finalCat) {
          if (!finalCat) finalCat = newTags;
          else if (!finalCat.includes(newTags)) finalCat = finalCat + ' / ' + newTags;
        }

        await client.query(`
          UPDATE "bhs_PRODUCTS"
          SET "QTY" = $1, "PRODUCT CATEGORY" = $2
          WHERE "PRODUCT ID" = $3
        `, [p['QTY'] || 0, finalCat, pid]);
        
        master['PRODUCT CATEGORY'] = finalCat;
      } else {
        // Insert new record
        const nextIdRes = await client.query(`SELECT COUNT(*) FROM "bhs_PRODUCTS"`);
        const nextId = 'P-' + (parseInt(nextIdRes.rows[0].count) + 1).toString().padStart(4, '0');
        await client.query(`
          INSERT INTO "bhs_PRODUCTS" ("ID", "PRODUCT ID", "PRODUCT BARCODE", "PRODUCT NAME", "PRODUCT CATEGORY", "QTY")
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [p['ID'] || nextId, pid, p['PRODUCT BARCODE'], p['PRODUCT NAME'], p['TAGS'], p['QTY'] || 0]);
        masterMap.set(pid, { ...p, 'PRODUCT CATEGORY': p['TAGS'] });
      }
    }

    console.log("Migrating Count Products...");
    for (const p of countProducts) {
      const pid = p['PRODUCT ID'] ? p['PRODUCT ID'].trim() : null;
      if (!pid) continue;

      let master = masterMap.get(pid);
      if (master) {
        await client.query(`
          UPDATE "bhs_PRODUCTS"
          SET "AVAILABLE QTY" = $1, "QTY IN BOX" = $2, "IS_COUNTABLE" = true
          WHERE "PRODUCT ID" = $3
        `, [p['AVAILABLE QTY'] || 0, p['QTY IN BOX'] || 0, pid]);
      } else {
        // Insert new record
        const nextIdRes = await client.query(`SELECT COUNT(*) FROM "bhs_PRODUCTS"`);
        const nextId = 'P-' + (parseInt(nextIdRes.rows[0].count) + 1).toString().padStart(4, '0');
        await client.query(`
          INSERT INTO "bhs_PRODUCTS" ("ID", "PRODUCT ID", "PRODUCT NAME", "AVAILABLE QTY", "QTY IN BOX", "IS_COUNTABLE")
          VALUES ($1, $2, $3, $4, $5, true)
        `, [p['ID'] || nextId, pid, p['PRODUCT NAME'], p['AVAILABLE QTY'] || 0, p['QTY IN BOX'] || 0]);
        masterMap.set(pid, { ...p });
      }
    }

    console.log("Dropping old tables...");
    await client.query('DROP TABLE IF EXISTS "web_INVENTORY_PRODUCTS" CASCADE');
    await client.query('DROP TABLE IF EXISTS "mix_INVENTORY_COUNT_PRODUCTS" CASCADE');

    console.log("Migration complete!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

run();
