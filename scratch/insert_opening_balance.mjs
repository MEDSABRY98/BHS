const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://asdaegnucbxgvomtutcf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BEO5vo3H3RxrWtu6W242UA_2APT73ca';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const INTERNAL_LOCATIONS = new Set(['M/WH/Mazyad', 'S/WH/S20']);
const INIT_REFERENCE = 'INIT-STOCK-2026';
const INIT_DATE = '2025-12-31';
const INIT_FROM = 'Partners/Vendors';
const INIT_TO = 'M/WH/Mazyad';

// ─── Step 1: Read Excel ────────────────────────────────────────────────────────
const filePath = 'C:\\Users\\MEDSA\\Downloads\\Stock Move (stock.move) (10).xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`📂 Excel rows loaded: ${data.length}`);

// ─── Step 2: Calculate net stock per product ─────────────────────────────────
const stockMap = new Map(); // productId -> net qty

for (const row of data) {
  const productId = String(row['PRODUCT ID'] || '').trim();
  if (!productId) continue;

  const qty = parseFloat(row['Quantity'] ?? 0) || 0;
  const from = String(row['Source Location'] || '').trim();
  const to   = String(row['Intermediate Location'] || '').trim();

  const fromInternal = INTERNAL_LOCATIONS.has(from);
  const toInternal   = INTERNAL_LOCATIONS.has(to);

  if (toInternal && !fromInternal) {
    // Inflow into warehouse
    stockMap.set(productId, (stockMap.get(productId) || 0) + qty);
  } else if (fromInternal && !toInternal) {
    // Outflow from warehouse
    stockMap.set(productId, (stockMap.get(productId) || 0) - qty);
  }
  // internal→internal = 0 net change (skip)
}

// Filter: only positive balances
const positiveEntries = [...stockMap.entries()].filter(([, qty]) => qty > 0);
console.log(`\n📊 Summary:`);
console.log(`   Total products with movements: ${stockMap.size}`);
console.log(`   Products with positive closing balance: ${positiveEntries.length}`);
console.log(`   Products with zero/negative balance (skipped): ${stockMap.size - positiveEntries.length}`);

// Show top 10 for verification
console.log(`\n🔍 Top 10 products by closing balance:`);
[...stockMap.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([id, qty]) => console.log(`   Product ${id}: ${qty.toFixed(2)}`));

// ─── Step 3: Delete existing INIT-STOCK-2026 rows ────────────────────────────
console.log(`\n🗑️  Deleting existing ${INIT_REFERENCE} rows...`);
const { error: deleteError, count: deletedCount } = await supabase
  .from('web_INVENTORY_MOVES')
  .delete()
  .eq('REFERENCE', INIT_REFERENCE);

if (deleteError) {
  console.error('❌ Delete failed:', deleteError.message);
  process.exit(1);
}
console.log(`   ✅ Deleted existing init rows`);

// ─── Step 4: Insert opening balances ─────────────────────────────────────────
const rows = positiveEntries.map(([productId, qty]) => ({
  DATE: INIT_DATE,
  REFERENCE: INIT_REFERENCE,
  'LOCATION FROM': INIT_FROM,
  'LOCATION TO': INIT_TO,
  'PRODUCT ID': productId,
  QTY: Math.round(qty * 100) / 100, // round to 2 decimal places
}));

console.log(`\n⬆️  Inserting ${rows.length} opening balance rows...`);

const CHUNK_SIZE = 500;
let inserted = 0;

for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
  const chunk = rows.slice(i, i + CHUNK_SIZE);
  const { error: insertError } = await supabase
    .from('web_INVENTORY_MOVES')
    .insert(chunk);

  if (insertError) {
    console.error(`❌ Insert failed at chunk ${i}:`, insertError.message);
    process.exit(1);
  }

  inserted += chunk.length;
  console.log(`   ✅ Inserted ${inserted}/${rows.length} rows`);
}

console.log(`\n🎉 Done! ${rows.length} opening balance entries inserted with date ${INIT_DATE} and reference "${INIT_REFERENCE}"`);
