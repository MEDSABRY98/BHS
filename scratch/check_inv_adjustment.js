const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const s = createClient(
  'https://asdaegnucbxgvomtutcf.supabase.co',
  'sb_publishable_BEO5vo3H3RxrWtu6W242UA_2APT73ca'
);

async function run() {
  // ─── 1. Check Excel 2025 ──────────────────────────────────────────────────
  const wb = XLSX.readFile('C:\\Users\\MEDSA\\Downloads\\Stock Move (stock.move) (10).xlsx');
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const adjExcel = data.filter(r =>
    (r['Source Location'] || '').toLowerCase().includes('inventory') ||
    (r['Intermediate Location'] || '').toLowerCase().includes('inventory')
  );

  console.log('=== Excel 2025 - Inventory Adjustment ===');
  console.log('عدد الحركات:', adjExcel.length);
  adjExcel.forEach(r => {
    console.log(`  [${r['PRODUCT ID']}] ${r['Source Location']} --> ${r['Intermediate Location']} | QTY: ${r['Quantity']}`);
  });

  // ─── 2. Check DB ──────────────────────────────────────────────────────────
  const { data: dbRows, error } = await s
    .from('web_INVENTORY_MOVES')
    .select('*')
    .or('"LOCATION FROM".ilike.%Inventory%,"LOCATION TO".ilike.%Inventory%');

  console.log('\n=== DB 2026 - Inventory Adjustment ===');
  if (error) { console.error('Error:', error.message); return; }
  console.log('عدد الحركات:', dbRows?.length || 0);
  (dbRows || []).forEach(r => {
    console.log(`  [${r['PRODUCT ID']}] ${r['LOCATION FROM']} --> ${r['LOCATION TO']} | QTY: ${r.QTY} | REF: ${r.REFERENCE}`);
  });
}

run().catch(console.error);
