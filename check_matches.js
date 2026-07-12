const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data: purchases } = await supabase.from('web_Suppliers_Purchase').select('PRODUCT ID');
  const { data: products } = await supabase.from('bhs_PRODUCTS').select('PRODUCT ID');
  
  const purchaseProductIds = new Set(purchases.map(p => String(p['PRODUCT ID']).trim()));
  const productIds = new Set(products.map(p => String(p['PRODUCT ID']).trim()));
  
  let matches = 0;
  for (const pid of purchaseProductIds) {
    if (productIds.has(pid)) matches++;
  }
  
  console.log(`Total unique Product IDs in purchases: ${purchaseProductIds.size}`);
  console.log(`Matches in bhs_PRODUCTS: ${matches}`);

  const { data: purchasesSuppliers } = await supabase.from('web_Suppliers_Purchase').select('SUPPLIER ID');
  const { data: suppliers } = await supabase.from('bhs_SUPPLIERS').select('SUPPLIER ID');
  
  const purchaseSupplierIds = new Set(purchasesSuppliers.map(p => String(p['SUPPLIER ID']).trim()));
  const supplierIds = new Set(suppliers.map(p => String(p['SUPPLIER ID']).trim()));
  
  let sMatches = 0;
  for (const sid of purchaseSupplierIds) {
    if (supplierIds.has(sid)) sMatches++;
  }
  
  console.log(`Total unique Supplier IDs in purchases: ${purchaseSupplierIds.size}`);
  console.log(`Matches in bhs_SUPPLIERS: ${sMatches}`);
}
main();
