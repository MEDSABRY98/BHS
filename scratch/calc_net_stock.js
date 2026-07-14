const { createClient } = require('@supabase/supabase-js');

const s = createClient(
  'https://asdaegnucbxgvomtutcf.supabase.co',
  'sb_publishable_BEO5vo3H3RxrWtu6W242UA_2APT73ca'
);

const INTERNAL = new Set(['M/WH/Mazyad', 'S/WH/S20']);

async function calcStock() {
  let from = 0;
  const pageSize = 1000;
  const stockMap = new Map();

  while (true) {
    const { data, error } = await s
      .from('web_INVENTORY_MOVES')
      .select('"PRODUCT ID","LOCATION FROM","LOCATION TO",QTY')
      .range(from, from + pageSize - 1);

    if (error) { console.error(error.message); break; }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const pid = (row['PRODUCT ID'] || '').toString().trim();
      if (!pid) continue;
      const qty = parseFloat(row.QTY) || 0;
      const locFrom = (row['LOCATION FROM'] || '').trim();
      const locTo   = (row['LOCATION TO'] || '').trim();

      if (INTERNAL.has(locTo) && !INTERNAL.has(locFrom)) {
        stockMap.set(pid, (stockMap.get(pid) || 0) + qty);
      } else if (INTERNAL.has(locFrom) && !INTERNAL.has(locTo)) {
        stockMap.set(pid, (stockMap.get(pid) || 0) - qty);
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  let totalQty = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let zeroCount = 0;

  for (const [, qty] of stockMap) {
    totalQty += qty;
    if (qty > 0.01) positiveCount++;
    else if (qty < -0.01) negativeCount++;
    else zeroCount++;
  }

  const sorted = [...stockMap.entries()].sort((a, b) => b[1] - a[1]);

  console.log('=== صافي المخزون الكلي ===');
  console.log('إجمالي الوحدات في المخزن :', totalQty.toFixed(2));
  console.log('عدد المنتجات المختلفة    :', stockMap.size);
  console.log('  - رصيد موجب            :', positiveCount, 'منتج');
  console.log('  - رصيد سالب            :', negativeCount, 'منتج');
  console.log('  - رصيد صفر             :', zeroCount,    'منتج');

  console.log('\n=== أعلى 15 منتج بالمخزون ===');
  sorted.slice(0, 15).forEach(([pid, qty]) => console.log(`  Product ${pid} : ${qty.toFixed(2)}`));

  console.log('\n=== أدنى 10 منتج (سالب أو صفر) ===');
  [...sorted].reverse().slice(0, 10).forEach(([pid, qty]) => console.log(`  Product ${pid} : ${qty.toFixed(2)}`));
}

calcStock().catch(err => console.error('Fatal:', err));
