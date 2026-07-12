const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('web_Suppliers_Purchase').select('*');
  if (error) {
    console.error("ERROR:", error);
    return;
  }
  let missingQty = 0;
  let missingPrice = 0;
  let nanQty = 0;
  let nanPrice = 0;

  for (const row of data) {
    if (row['QTY'] === null || row['QTY'] === undefined) missingQty++;
    else if (isNaN(Number(row['QTY']))) nanQty++;

    if (row['UNIT PRICE'] === null || row['UNIT PRICE'] === undefined) missingPrice++;
    else if (isNaN(Number(row['UNIT PRICE']))) nanPrice++;
  }

  console.log(`TOTAL ROWS: ${data.length}`);
  console.log(`Missing QTY: ${missingQty}, NaN QTY: ${nanQty}`);
  console.log(`Missing PRICE: ${missingPrice}, NaN PRICE: ${nanPrice}`);
  
  if (data.length > 0) {
     console.log("Random sample of 3 rows:", data.slice(0, 3));
  }
}

main();
