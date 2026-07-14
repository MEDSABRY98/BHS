const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const s = createClient(
  'https://asdaegnucbxgvomtutcf.supabase.co',
  'sb_publishable_BEO5vo3H3RxrWtu6W242UA_2APT73ca'
);

const INTERNAL = new Set(['M/WH/Mazyad', 'S/WH/S20']);
const TARGET_PID = '10441';

async function analyze() {
  // ─── 1. Analyze 2025 Excel for this product ───────────────────────────────
  const filePath = 'C:\\Users\\MEDSA\\Downloads\\Stock Move (stock.move) (10).xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(sheet);

  const rows2025 = excelData.filter(r => String(r['PRODUCT ID']).trim() === TARGET_PID);
  console.log(`\n=== المنتج ${TARGET_PID} في Excel 2025 ===`);
  console.log(`عدد الحركات في 2025: ${rows2025.length}`);

  let excel_in = 0, excel_out = 0;
  for (const row of rows2025) {
    const qty = parseFloat(row['Quantity']) || 0;
    const from_ = (row['Source Location'] || '').trim();
    const to_ = (row['Intermediate Location'] || '').trim();
    console.log(`  ${from_} --> ${to_} | QTY: ${qty}`);
    if (INTERNAL.has(to_) && !INTERNAL.has(from_)) excel_in += qty;
    else if (INTERNAL.has(from_) && !INTERNAL.has(to_)) excel_out += qty;
  }
  console.log(`\nإجمالي دخول 2025 : +${excel_in}`);
  console.log(`إجمالي خروج 2025 : -${excel_out}`);
  console.log(`صافي 2025        : ${excel_in - excel_out}`);

  // ─── 2. Check what opening balance was inserted ───────────────────────────
  const { data: initRows } = await s
    .from('web_INVENTORY_MOVES')
    .select('*')
    .eq('PRODUCT ID', TARGET_PID)
    .eq('REFERENCE', 'INIT-STOCK-2026');

  console.log(`\n=== الرصيد الافتتاحي المدخل (INIT-STOCK-2026) ===`);
  if (initRows && initRows.length > 0) {
    initRows.forEach(r => console.log(`  ID: ${r.ID} | QTY: ${r.QTY} | DATE: ${r.DATE}`));
  } else {
    console.log('  ❌ لا يوجد رصيد افتتاحي مدخل لهذا المنتج (رصيده كان سالب في 2025 فاتتخطى)');
  }

  // ─── 3. All 2026 movements from DB ───────────────────────────────────────
  const { data: dbRows } = await s
    .from('web_INVENTORY_MOVES')
    .select('*')
    .eq('PRODUCT ID', TARGET_PID)
    .order('DATE', { ascending: true });

  console.log(`\n=== كل الحركات في الداتا بيز (${dbRows?.length || 0} حركة) ===`);
  let running = 0;
  for (const r of (dbRows || [])) {
    const qty = parseFloat(r.QTY) || 0;
    const from_ = (r['LOCATION FROM'] || '').trim();
    const to_   = (r['LOCATION TO'] || '').trim();
    let effect = 0;
    if (INTERNAL.has(to_) && !INTERNAL.has(from_)) effect = +qty;
    else if (INTERNAL.has(from_) && !INTERNAL.has(to_)) effect = -qty;
    running += effect;
    const sign = effect > 0 ? `+${qty}` : effect < 0 ? `-${qty}` : `0 (transfer)`;
    console.log(`  [${r.DATE}] ${r.REFERENCE} | ${from_} --> ${to_} | ${sign} | صافي تراكمي: ${running}`);
  }

  console.log(`\n=== الخلاصة ===`);
  console.log(`صافي 2025 (Excel)           : ${excel_in - excel_out}`);
  console.log(`ما اتحشر كـ Opening Balance : ${initRows?.length ? initRows[0].QTY : 'لا شيء (كان سالب)'}`);
  console.log(`صافي الكلي الحالي (DB)      : ${running}`);
}

analyze().catch(err => console.error('Fatal:', err));
