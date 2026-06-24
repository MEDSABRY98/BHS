const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'lib', 'supabase.ts');
let code = fs.readFileSync(p, 'utf8');

const fetchHelper = `
export async function fetchAllData(queryBuilder: any) {
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await queryBuilder.range(from, from + pageSize - 1);
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
}
`;

// Insert the helper at the top, just below export const bhs_supabase...
code = code.replace(/export const bhs_supabase = bhs_supabas;/, 'export const bhs_supabase = bhs_supabas;\n' + fetchHelper);

// Update getMixDebit
code = code.replace(/const \{ data: debitData, error: debitError \} = await bhs_supabase\.from\('mix_DEBIT'\)\.select\('\*'\);/, 
`let debitData: any[] = [];
  let debitError = null;
  try {
    debitData = await fetchAllData(bhs_supabase.from('mix_DEBIT').select('*'));
  } catch (err) {
    debitError = err;
  }`);

code = code.replace(/const \{ data: customersData, error: customersError \} = await bhs_supabase\s*\.from\('bhs_CUSTOMERS'\)\s*\.select\('"CUSTOMER ID", "CUSTOMER MAIN NAME"'\);/,
`let customersData: any[] = [];
  let customersError = null;
  try {
    customersData = await fetchAllData(bhs_supabase.from('bhs_CUSTOMERS').select('"CUSTOMER ID", "CUSTOMER MAIN NAME"'));
  } catch (err) {
    customersError = err;
  }`);

// Update getNotes
code = code.replace(/const \{ data, error \} = await query;/,
`let data: any[] = [];
  let error = null;
  try {
    data = await fetchAllData(query);
  } catch (err) {
    error = err;
  }`);

// Update getAllCustomerEmails
code = code.replace(/const \{ data, error \} = await bhs_supabase\.from\('debit_EMILS'\)\.select\('\*'\);/,
`let data: any[] = [];
  let error = null;
  try {
    data = await fetchAllData(bhs_supabase.from('debit_EMILS').select('*'));
  } catch (err) {
    error = err;
  }`);

// Update getLuluEmails
code = code.replace(/const \{ data, error \} = await bhs_supabase\.from\('debit_EMILS_LULU'\)\.select\('\*'\);/,
`let data: any[] = [];
  let error = null;
  try {
    data = await fetchAllData(bhs_supabase.from('debit_EMILS_LULU').select('*'));
  } catch (err) {
    error = err;
  }`);

fs.writeFileSync(p, code, 'utf8');
