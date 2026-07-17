const fs = require('fs');
const { Client } = require('pg');

function loadEnv(path) {
  const text = fs.readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv('.env.local');

async function main() {
  const sql = fs.readFileSync('scratch/debit_rpc.sql', 'utf8');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(sql);
    console.log('Applied debit_rpc.sql successfully');

    const fnCheck = await client.query(`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'get_debit_metadata',
          'get_debit_transactions',
          'get_debit_customers_aggregated',
          'get_debit_payments_summary'
        )
      ORDER BY p.proname, args
    `);

    console.log('Functions present:');
    for (const row of fnCheck.rows) {
      console.log(`- ${row.proname}(${row.args})`);
    }

    const meta = await client.query('SELECT get_debit_metadata() AS result');
    console.log('Smoke test get_debit_metadata:', JSON.stringify(meta.rows[0]?.result));

    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('Requested PostgREST schema reload');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
