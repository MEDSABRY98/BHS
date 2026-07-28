import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const exists = await client.query(
  "SELECT proname FROM pg_proc WHERE proname = 'get_inventory_products_balance_report'",
);
console.log('exists:', exists.rows.length > 0);

const sample = await client.query(
  "SELECT (get_inventory_products_balance_report(NULL, NULL)->>'success') AS ok, jsonb_array_length((get_inventory_products_balance_report(NULL, NULL)->'data')) AS row_count",
);
console.log('sample:', sample.rows[0]);
await client.end();
