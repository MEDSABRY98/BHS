const XLSX = require('xlsx');

const INTERNAL = new Set(['M/WH/Mazyad', 'S/WH/S20', 'GM/WH/Game area', 'HA/WH/Hashi']);

const wb = XLSX.readFile('C:\\Users\\MEDSA\\Downloads\\Stock Move (stock.move) (11).xlsx');
const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const summary = {
  purchase:         { qty: 0, count: 0 },   // Partners/Vendors → Internal
  customer_return:  { qty: 0, count: 0 },   // Partners/Customers → Internal
  production_in:    { qty: 0, count: 0 },   // Virtual/Production → Internal
  subcontracting_in:{ qty: 0, count: 0 },   // Subcontracting → Internal
  adjustment_in:    { qty: 0, count: 0 },   // Inventory Adjustment → Internal
  other_in:         { qty: 0, count: 0 },   // Any other inflow
};

let totalIn = 0;

for (const row of data) {
  const qty  = parseFloat(row['Quantity']) || 0;
  const from = (row['Source Location'] || '').trim();
  const to   = (row['Intermediate Location'] || '').trim();

  if (!INTERNAL.has(to) || INTERNAL.has(from)) continue; // only inflows

  totalIn += qty;

  if (from === 'Partners/Vendors')                              { summary.purchase.qty += qty;          summary.purchase.count++; }
  else if (from === 'Partners/Customers')                       { summary.customer_return.qty += qty;   summary.customer_return.count++; }
  else if (from === 'Virtual Locations/Production')             { summary.production_in.qty += qty;     summary.production_in.count++; }
  else if (from === 'Physical Locations/Subcontracting Location'){ summary.subcontracting_in.qty += qty; summary.subcontracting_in.count++; }
  else if (from === 'Virtual Locations/Inventory adjustment')   { summary.adjustment_in.qty += qty;     summary.adjustment_in.count++; }
  else                                                          { summary.other_in.qty += qty;          summary.other_in.count++; }
}

console.log('=== إجمالي الاستلامات في 2025 (كل أنواع الدخول) ===\n');
console.log(`${'النوع'.padEnd(35)} ${'الكمية'.padStart(12)} ${'عدد الحركات'.padStart(15)}`);
console.log('─'.repeat(65));
console.log(`${'مشتريات من موردين'.padEnd(35)} ${summary.purchase.qty.toFixed(2).padStart(12)} ${String(summary.purchase.count).padStart(15)}`);
console.log(`${'مرتجعات من عملاء'.padEnd(35)} ${summary.customer_return.qty.toFixed(2).padStart(12)} ${String(summary.customer_return.count).padStart(15)}`);
console.log(`${'من إنتاج (Production In)'.padEnd(35)} ${summary.production_in.qty.toFixed(2).padStart(12)} ${String(summary.production_in.count).padStart(15)}`);
console.log(`${'من تصنيع خارجي (Subcontracting)'.padEnd(35)} ${summary.subcontracting_in.qty.toFixed(2).padStart(12)} ${String(summary.subcontracting_in.count).padStart(15)}`);
console.log(`${'تسوية جرد (Inventory Adjustment)'.padEnd(35)} ${summary.adjustment_in.qty.toFixed(2).padStart(12)} ${String(summary.adjustment_in.count).padStart(15)}`);
console.log(`${'أخرى'.padEnd(35)} ${summary.other_in.qty.toFixed(2).padStart(12)} ${String(summary.other_in.count).padStart(15)}`);
console.log('─'.repeat(65));
console.log(`${'الإجمالي الكلي'.padEnd(35)} ${totalIn.toFixed(2).padStart(12)}`);
