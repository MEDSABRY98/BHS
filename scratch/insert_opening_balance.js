const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const s = createClient(
  'https://asdaegnucbxgvomtutcf.supabase.co',
  'sb_publishable_BEO5vo3H3RxrWtu6W242UA_2APT73ca'
);

// All internal warehouses
const INTERNAL = new Set(['M/WH/Mazyad', 'S/WH/S20', 'GM/WH/Game area', 'HA/WH/Hashi']);
const INIT_REFERENCE = 'INIT-STOCK-2026';
const INIT_DATE = '2025-12-31';

async function main() {
  // ─── Step 1: Read new Excel ───────────────────────────────────────────────
  const filePath = 'C:\\Users\\MEDSA\\Downloads\\Stock Move (stock.move) (11).xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`📂 Excel rows loaded: ${data.length}`);

  // ─── Step 2: Calculate net stock per product ──────────────────────────────
  const stockMap = new Map();

  for (const row of data) {
    const productId = String(row['PRODUCT ID'] || '').trim();
    if (!productId) continue;

    const qty = parseFloat(row['Quantity'] ?? 0) || 0;
    const from_ = String(row['Source Location'] || '').trim();
    const to_   = String(row['Intermediate Location'] || '').trim();

    const fromInternal = INTERNAL.has(from_);
    const toInternal   = INTERNAL.has(to_);

    if (toInternal && !fromInternal) {
      // Inflow into any internal warehouse
      stockMap.set(productId, (stockMap.get(productId) || 0) + qty);
    } else if (fromInternal && !toInternal) {
      // Outflow from any internal warehouse
      stockMap.set(productId, (stockMap.get(productId) || 0) - qty);
    }
    // internal → internal = transfer = no net change
  }

  const positiveEntries = [...stockMap.entries()].filter(([, qty]) => qty > 0.001);
  const negativeEntries = [...stockMap.entries()].filter(([, qty]) => qty < -0.001);

  console.log(`\n📊 ملخص حسابات 2025:`);
  console.log(`   إجمالي منتجات لها حركات : ${stockMap.size}`);
  console.log(`   منتجات برصيد موجب ✅    : ${positiveEntries.length}`);
  console.log(`   منتجات برصيد سالب ⚠️    : ${negativeEntries.length}`);
  console.log(`   منتجات رصيدها صفر       : ${stockMap.size - positiveEntries.length - negativeEntries.length}`);

  console.log(`\n🔍 أعلى 10 منتجات بالرصيد:`);
  [...stockMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([id, qty]) => console.log(`   Product ${id}: ${qty.toFixed(2)}`));

  console.log(`\n⚠️ أدنى 10 منتجات (سالبة):`);
  [...stockMap.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, 10)
    .forEach(([id, qty]) => console.log(`   Product ${id}: ${qty.toFixed(2)}`));

  // ─── Step 3: Delete existing INIT-STOCK-2026 rows ─────────────────────────
  console.log(`\n🗑️  حذف الرصيد الافتتاحي القديم (${INIT_REFERENCE})...`);
  const { error: deleteError } = await s
    .from('web_INVENTORY_MOVES')
    .delete()
    .eq('REFERENCE', INIT_REFERENCE);

  if (deleteError) {
    console.error('❌ فشل الحذف:', deleteError.message);
    process.exit(1);
  }
  console.log(`   ✅ تم حذف الرصيد القديم`);

  // ─── Step 4: Insert new opening balances ──────────────────────────────────
  const rows = positiveEntries.map(([productId, qty], index) => ({
    ID: `OB-${String(index + 1).padStart(4, '0')}`,
    DATE: INIT_DATE,
    REFERENCE: INIT_REFERENCE,
    'LOCATION FROM': 'Virtual Locations/Inventory adjustment',
    'LOCATION TO': 'M/WH/Mazyad',
    'PRODUCT ID': productId,
    QTY: Math.round(qty * 100) / 100,
  }));

  console.log(`\n⬆️  إدخال ${rows.length} صف رصيد افتتاحي جديد...`);

  const CHUNK_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error: insertError } = await s
      .from('web_INVENTORY_MOVES')
      .insert(chunk);

    if (insertError) {
      console.error(`❌ فشل الإدخال في chunk ${i}:`, insertError.message);
      process.exit(1);
    }

    inserted += chunk.length;
    console.log(`   ✅ تم إدخال ${inserted}/${rows.length} صف`);
  }

  console.log(`\n🎉 تم! ${rows.length} رصيد افتتاحي تم إدخاله (تاريخ: ${INIT_DATE}، مرجع: "${INIT_REFERENCE}")`);
}

main().catch(err => {
  console.error('❌ خطأ:', err);
  process.exit(1);
});
