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

  let started = Date.now();
  const months = await supabase.rpc('get_inventory_moves_months_summary');
  console.log(
    `months: ${Date.now() - started}ms, error=${months.error?.message || 'none'}, rows=${months.data?.length}, total=${months.data?.reduce((s, r) => s + Number(r.count), 0)}`,
  );

  const latest = months.data?.[0];
  if (latest) {
    started = Date.now();
    const days = await supabase.rpc('get_inventory_moves_days_summary', {
      p_year: latest.year,
      p_month: latest.month,
    });
    console.log(
      `days (${latest.year}-${latest.month}): ${Date.now() - started}ms, error=${days.error?.message || 'none'}, rows=${days.data?.length}`,
    );
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
