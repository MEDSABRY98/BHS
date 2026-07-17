const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const started = Date.now();
  const { data, error } = await supabase.rpc('get_inventory_balance_report', {
    p_date_from: '2025-01-01',
    p_date_to: '2025-01-31',
    p_include_movements: false,
  });
  const elapsed = Date.now() - started;

  if (error) {
    console.error('Supabase RPC error:', error.message);
    process.exit(1);
  }

  const count = Array.isArray(data?.data) ? data.data.length : 0;
  const sample = data?.data?.[0];
  const movementCount = Array.isArray(sample?.periodMovements) ? sample.periodMovements.length : -1;

  console.log(`Supabase RPC ok in ${elapsed}ms`);
  console.log(`success=${data?.success}, products=${count}, sampleMovements=${movementCount}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
