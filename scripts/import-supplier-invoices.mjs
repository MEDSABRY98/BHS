import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const envText = readFileSync('.env.local', 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { SPREADSHEET_ID, getServiceAccountCredentials } = require('../lib/Sheets/Core.ts');

function parseSupplierDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    let year = dmy[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
}

function parseSupplierAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(String(value).replace(/,/g, '').trim());
  if (Number.isNaN(num)) return null;
  return num;
}

function formatRecordId(num) {
  return `R-${String(num).padStart(4, '0')}`;
}

async function allocateIds(table, count) {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data, error } = await c.from(table).select('ID');
  if (error) throw error;
  let maxNum = 0;
  for (const row of data || []) {
    const id = String(row.ID || '');
    if (!id.startsWith('R-')) continue;
    const num = parseInt(id.substring(2), 10);
    if (!Number.isNaN(num) && num > maxNum) maxNum = num;
  }
  return Array.from({ length: count }, (_, i) => formatRecordId(maxNum + 1 + i));
}

const credentials = getServiceAccountCredentials();
const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });

const [purchaseRes, refundRes] = await Promise.all([
  sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "'S-Invoices - Purchase'!A:D" }),
  sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "'S-Invoices - Refund'!A:D" }),
]);

const parseRows = (rows, type) => {
  if (!rows || rows.length < 2) return [];
  return rows.slice(1).map((row) => ({
    date: row[0] || '',
    number: row[1]?.toString() || '',
    supplierName: row[2]?.toString() || '',
    amount: parseFloat(row[3]?.toString().replace(/,/g, '') || '0'),
    type,
  })).filter((r) => r.supplierName);
};

const transactions = [
  ...parseRows(purchaseRes.data.values || [], 'Purchase'),
  ...parseRows(refundRes.data.values || [], 'Refund'),
];

let valid = 0;
let invalid = 0;
const payload = [];
for (const row of transactions) {
  const date = parseSupplierDate(row.date);
  const supplierName = String(row.supplierName || '').trim();
  const amount = parseSupplierAmount(row.amount);
  if (!date || !supplierName || amount === null) {
    invalid++;
    if (invalid <= 3) console.log('invalid row:', row, { date, amount });
    continue;
  }
  valid++;
  payload.push({
    DATE: date,
    TYPE: row.type,
    'INVOICE NUMBER': String(row.number || '').trim(),
    'SUPPLIER NAME': supplierName,
    AMOUNT: amount,
  });
}

console.log('transactions:', transactions.length, 'valid:', valid, 'invalid:', invalid);

if (payload.length === 0) process.exit(0);

const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { count } = await c.from('web_Suppliers_Invoices').select('*', { count: 'exact', head: true });
if ((count || 0) > 0) {
  console.log('Table already has', count, 'rows — skipping insert');
  process.exit(0);
}

const ids = await allocateIds('web_Suppliers_Invoices', payload.length);
const rows = payload.map((row, i) => ({ ID: ids[i], ...row }));

for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500);
  const { error } = await c.from('web_Suppliers_Invoices').insert(chunk);
  if (error) throw error;
}

console.log('Inserted', rows.length, 'invoice rows');
