const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('web_Suppliers_Purchase').select('*');
  if (error) {
    console.error("ERROR fetching:", error);
    return;
  }
  
  let successCount = 0;
  for (const row of data) {
    // Swap them
    const newProductId = row['SUPPLIER ID'];
    const newSupplierId = row['PRODUCT ID'];
    
    const { error: updateError } = await supabase.from('web_Suppliers_Purchase')
      .update({
        'SUPPLIER ID': newSupplierId,
        'PRODUCT ID': newProductId
      })
      .eq('ID', row.ID);
      
    if (!updateError) successCount++;
  }
  
  console.log(`Successfully swapped IDs for ${successCount} rows.`);
}
main();
