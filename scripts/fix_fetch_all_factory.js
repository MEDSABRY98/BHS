const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'lib', 'supabase.ts');
let code = fs.readFileSync(p, 'utf8');

// Replace the old fetchAllData with the factory based one
code = code.replace(/export async function fetchAllData\(queryBuilder: any\) \{[\s\S]*?return allData;\n\}/, 
`export async function fetchAllData(queryFactory: () => any) {
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    } else {
      hasMore = false;
    }
  }
  return allData;
}`);

// Update usages to use arrow functions
code = code.replace(/fetchAllData\(bhs_supabase\.from\('mix_DEBIT'\)\.select\('\*'\)\)/g, "fetchAllData(() => bhs_supabase.from('mix_DEBIT').select('*'))");
code = code.replace(/fetchAllData\(bhs_supabase\.from\('bhs_CUSTOMERS'\)\.select\('"CUSTOMER ID", "CUSTOMER MAIN NAME"'\)\)/g, "fetchAllData(() => bhs_supabase.from('bhs_CUSTOMERS').select('\"CUSTOMER ID\", \"CUSTOMER MAIN NAME\"'))");
code = code.replace(/fetchAllData\(bhs_supabase\.from\('debit_EMILS'\)\.select\('\*'\)\)/g, "fetchAllData(() => bhs_supabase.from('debit_EMILS').select('*'))");
code = code.replace(/fetchAllData\(bhs_supabase\.from\('debit_EMILS_LULU'\)\.select\('\*'\)\)/g, "fetchAllData(() => bhs_supabase.from('debit_EMILS_LULU').select('*'))");

// For getNotes
// We need to change:
/*
  let query = bhs_supabase.from('debit_NOTES').select('*').order('CREATED_AT', { ascending: false });
  if (customerId) {
    query = query.eq('CUSTOMER ID', customerId);
  }
  let data: any[] = [];
  let error = null;
  try {
    data = await fetchAllData(query);
  } catch (err) {
    error = err;
  }
*/
// To use a factory. Since it's a bit complex with regex, I'll just write the exact replacement.

code = code.replace(/let query = bhs_supabase\.from\('debit_NOTES'\)\.select\('\*'\)\.order\('CREATED_AT', \{ ascending: false \}\);\n\s*if \(customerId\) \{\n\s*query = query\.eq\('CUSTOMER ID', customerId\);\n\s*\}\n\s*let data: any\[\] = \[\];\n\s*let error = null;\n\s*try \{\n\s*data = await fetchAllData\(query\);\n\s*\} catch \(err\) \{\n\s*error = err;\n\s*\}/,
`let data: any[] = [];
  let error = null;
  try {
    data = await fetchAllData(() => {
      let query = bhs_supabase.from('debit_NOTES').select('*').order('CREATED_AT', { ascending: false });
      if (customerId) {
        query = query.eq('CUSTOMER ID', customerId);
      }
      return query;
    });
  } catch (err) {
    error = err;
  }`);

fs.writeFileSync(p, code, 'utf8');
