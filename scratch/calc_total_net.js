const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const s = createClient(
  'https://asdaegnucbxgvomtutcf.supabase.co',
  'sb_publishable_BEO5vo3H3RxrWtu6W242UA_2APT73ca'
);

const INTERNAL = new Set(['M/WH/Mazyad', 'S/WH/S20', 'GM/WH/Game area', 'HA/WH/Hashi']);

async function main() {
  // ─── 2025 من Excel ────────────────────────────────────────────────────────
  const wb = XLSX.readFile('C:\\Users\\MEDSA\\Downloads\\Stock Move (stock.move) (11).xlsx');
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  let in2025 = 0, out2025 = 0;
  for (const row of data) {
    const qty  = parseFloat(row['Quantity']) || 0;
    const from = (row['Source Location'] || '').trim();
    const to   = (row['Intermediate Location'] || '').trim();
    if (INTERNAL.has(to)   && !INTERNAL.has(from)) in2025  += qty;
    if (INTERNAL.has(from) && !INTERNAL.has(to))   out2025 += qty;
  }

  // ─── 2026 من الداتا بيز (بدون INIT-STOCK-2026) ───────────────────────────
  let from2026 = 0;
  let in2026 = 0, out2026 = 0;
  const pageSize = 1000;

  while (true) {
    const { data: rows, error } = await s
      .from('web_INVENTORY_MOVES')
      .select('"LOCATION FROM","LOCATION TO",QTY,REFERENCE')
      .neq('REFERENCE', 'INIT-STOCK-2026')
      .range(from2026, from2026 + pageSize - 1);

    if (error || !rows || rows.length === 0) break;

    for (const r of rows) {
      const qty  = parseFloat(r.QTY) || 0;
      const from_ = (r['LOCATION FROM'] || '').trim();
      const to_   = (r['LOCATION TO'] || '').trim();
      if (INTERNAL.has(to_)   && !INTERNAL.has(from_)) in2026  += qty;
      if (INTERNAL.has(from_) && !INTERNAL.has(to_))   out2026 += qty;
    }

    if (rows.length < pageSize) break;
    from2026 += pageSize;
  }

  const net2025 = in2025 - out2025;
  const net2026 = in2026 - out2026;
  const netTotal = net2025 + net2026;

  console.log('=== الصافي الكلي (2025 + 2026) ===\n');
  console.log('📦 2025 (Excel):');
  console.log(`   استلامات : ${in2025.toFixed(0)}`);
  console.log(`   مبيعات   : ${out2025.toFixed(0)}`);
  console.log(`   صافي 2025: ${net2025.toFixed(0)}`);
  console.log('\n📦 2026 (DB - بدون opening balance):');
  console.log(`   استلامات : ${in2026.toFixed(0)}`);
  console.log(`   مبيعات   : ${out2026.toFixed(0)}`);
  console.log(`   صافي 2026: ${net2026.toFixed(0)}`);
  console.log('\n═══════════════════════════════════');
  console.log(`   الصافي الكلي: ${netTotal.toFixed(0)} وحدة`);
}

main().catch(console.error);
