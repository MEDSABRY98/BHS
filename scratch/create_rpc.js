const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.asdaegnucbxgvomtutcf:BHSu2389102005%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

const sql = `
CREATE OR REPLACE FUNCTION get_inventory_movements_summary()
RETURNS TABLE (
    product_id text,
    sales numeric,
    returns numeric,
    net_purchases numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        "PRODUCT ID"::text as product_id,
        COALESCE(SUM(CASE WHEN "LOCATION TO" = 'Partners/Customers' THEN NULLIF(REPLACE("QTY"::text, ',', ''), '')::numeric ELSE 0 END), 0) as sales,
        COALESCE(SUM(CASE WHEN "LOCATION FROM" = 'Partners/Customers' THEN NULLIF(REPLACE("QTY"::text, ',', ''), '')::numeric ELSE 0 END), 0) as returns,
        COALESCE(SUM(CASE WHEN "LOCATION FROM" = 'Partners/Vendors' THEN NULLIF(REPLACE("QTY"::text, ',', ''), '')::numeric ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN "LOCATION TO" = 'Partners/Vendors' THEN NULLIF(REPLACE("QTY"::text, ',', ''), '')::numeric ELSE 0 END), 0) as net_purchases
    FROM "web_INVENTORY_MOVES"
    WHERE "PRODUCT ID" IS NOT NULL AND "PRODUCT ID" != ''
    GROUP BY "PRODUCT ID";
END;
$$ LANGUAGE plpgsql;
`;

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');
    await client.query(sql);
    console.log('RPC created successfully!');
  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

run();
