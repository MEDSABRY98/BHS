/**
 * One-time import: Inventory Google Sheets → Supabase
 * Run: node scripts/import-inventory-to-supabase.mjs
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { google } from 'googleapis';

function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env.local');
    readFileSync(envPath, 'utf-8').split('\n').forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    });
  } catch {
    /* ignore */
  }
}

loadEnv();

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1s1G42Qd0FNDyvz42qi_6SPoKMAy8Kvx8eMm7iyR8pds';

function getCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  }
  return JSON.parse(readFileSync(join(process.cwd(), 'assets', 'BHAPPS.json'), 'utf-8'));
}

function formatRecordId(num) {
  return `R-${String(num).padStart(4, '0')}`;
}

function parseNum(val) {
  const n = parseFloat(String(val ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function fetchRange(sheets, range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  return res.data.values || [];
}

function mapProductHeader(header) {
  const h = header.map((x) => x.toString().toLowerCase().trim());
  const idx = {
    id: h.findIndex((x) => x === 'product id' || x.includes('id') || x.includes('code')),
    barcode: h.findIndex((x) => x === 'product barcode' || x.includes('barcode')),
    name: h.findIndex((x) => x === 'product name' || ((x.includes('name') || x.includes('product') || x.includes('item')) && !x.includes('id') && !x.includes('code'))),
    minQ: h.findIndex((x) => x === 'min q by ctn' || x.includes('min q') || x.includes('min')),
    maxQ: h.findIndex((x) => x === 'max q by ctn' || x.includes('max q') || x.includes('max')),
    qinc: h.findIndex((x) => x === 'qinc'),
    tags: h.findIndex((x) => x === 'tags' || x.includes('tag')),
    onHand: h.findIndex((x) => x === 'qty' || x.includes('on hand') || x.includes('stock')),
    free: h.findIndex((x) => x.includes('free') || x.includes('avail')),
  };
  if (idx.id === -1) idx.id = 0;
  if (idx.barcode === -1) idx.barcode = 1;
  if (idx.name === -1) idx.name = 2;
  if (idx.tags === -1) idx.tags = 3;
  if (idx.minQ === -1) idx.minQ = 4;
  if (idx.maxQ === -1) idx.maxQ = 5;
  if (idx.qinc === -1) idx.qinc = 6;
  if (idx.onHand === -1) idx.onHand = 7;
  if (idx.free === -1) idx.free = idx.onHand;
  return idx;
}

function mapMoveHeader(header) {
  const h = header.map((x) => x.toString().toLowerCase().trim());
  return {
    date: h.indexOf('date') !== -1 ? h.indexOf('date') : 0,
    reference: h.indexOf('reference') !== -1 ? h.indexOf('reference') : 1,
    from: h.indexOf('location from') !== -1 ? h.indexOf('location from') : 2,
    to: h.indexOf('location to') !== -1 ? h.indexOf('location to') : 3,
    productId: h.indexOf('product id') !== -1 ? h.indexOf('product id') : 4,
    qty: h.indexOf('qty') !== -1 ? h.indexOf('qty') : 8,
  };
}

async function runSql(token, ref, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL failed (${res.status}): ${text}`);
  }
}

function sqlStr(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function batchInsertSql(token, ref, table, rows, batchSize = 200) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]).map((c) => `"${c}"`).join(', ');
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const values = chunk.map((row) => {
      const vals = Object.keys(rows[0]).map((col) => {
        const v = row[col];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
        return sqlStr(v);
      });
      return `(${vals.join(', ')})`;
    }).join(',\n');
    await runSql(token, ref, `INSERT INTO "${table}" (${cols}) VALUES ${values};`);
    process.stdout.write(`  inserted ${Math.min(i + batchSize, rows.length)}/${rows.length}\r`);
  }
  console.log('');
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF || 'asdaegnucbxgvomtutcf';
  if (!token) throw new Error('Missing SUPABASE_ACCESS_TOKEN in .env.local');

  const sheets = await getSheets();

  await runSql(token, ref, 'DELETE FROM "web_INVENTORY_MOVES";');
  await runSql(token, ref, 'DELETE FROM "web_INVENTORY_ITEM_CODE";');
  await runSql(token, ref, 'DELETE FROM "web_INVENTORY_PRODUCTS";');

  console.log('Importing PRODUCTS...');
  const productRows = await fetchRange(sheets, `'Inventory - PRODUCTS'!A:Z`);
  if (productRows.length < 2) throw new Error('No product rows');
  const pIdx = mapProductHeader(productRows[0]);
  const productInserts = [];
  let pNum = 0;
  const productIdSet = new Set();

  productRows.slice(1).forEach((row, index) => {
    let productId = row[pIdx.id]?.toString().trim() || '';
    const barcode = row[pIdx.barcode]?.toString().trim() || '';
    const productName = row[pIdx.name]?.toString().trim() || '';
    if (!productName) return;
    if (!productId) {
      if (barcode) productId = `BAR-${barcode}`;
      else productId = `NAME-${productName.replace(/\s+/g, '_')}`;
      if (productIdSet.has(productId)) productId = `${productId}-${index}`;
    }
    productIdSet.add(productId);
    pNum += 1;
    const onHand = parseNum(row[pIdx.onHand]);
    const free = parseNum(row[pIdx.free]);
    productInserts.push({
      ID: formatRecordId(pNum),
      'PRODUCT ID': productId,
      'PRODUCT BARCODE': barcode,
      'PRODUCT NAME': productName,
      TAGS: row[pIdx.tags]?.toString().trim() || '',
      'MIN Q BY CTN': parseNum(row[pIdx.minQ]),
      'MAX Q BY CTN': parseNum(row[pIdx.maxQ]),
      QINC: parseNum(row[pIdx.qinc]),
      'QTY ON HAND': onHand,
      'QTY FREE TO USE': free || onHand,
    });
  });

  await batchInsertSql(token, ref, 'web_INVENTORY_PRODUCTS', productInserts);
  console.log(`Products: ${productInserts.length}`);

  console.log('Importing MOVES...');
  const moveRows = await fetchRange(sheets, `'Inventory - MOVES'!A:I`);
  const mIdx = mapMoveHeader(moveRows[0] || []);
  const moveInserts = [];
  let mNum = 0;
  let skippedMoves = 0;

  moveRows.slice(1).forEach((row) => {
    const productId = row[mIdx.productId]?.toString().trim();
    const qty = parseNum(row[mIdx.qty]);
    if (!productId || qty === 0) return;
    if (!productIdSet.has(productId)) {
      skippedMoves += 1;
      return;
    }
    const dateStr = row[mIdx.date]?.toString().trim();
    let dateVal = null;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) dateVal = d.toISOString();
    }
    mNum += 1;
    moveInserts.push({
      ID: formatRecordId(mNum),
      DATE: dateVal,
      REFERENCE: row[mIdx.reference]?.toString().trim() || '',
      'LOCATION FROM': row[mIdx.from]?.toString().trim() || '',
      'LOCATION TO': row[mIdx.to]?.toString().trim() || '',
      'PRODUCT ID': productId,
      QTY: qty,
    });
  });

  await batchInsertSql(token, ref, 'web_INVENTORY_MOVES', moveInserts);
  console.log(`Moves: ${moveInserts.length} (skipped orphans: ${skippedMoves})`);

  console.log('Importing ITEM CODE...');
  const itemRows = await fetchRange(sheets, `'Inventory - Item Code'!A:C`);
  const itemInserts = [];
  let iNum = 0;
  itemRows.slice(1).forEach((row) => {
    const tags = row[0]?.toString().trim() || '';
    const itemCode = row[1]?.toString().trim() || '';
    const barcode = row[2]?.toString().trim() || '';
    if (!itemCode && !barcode) return;
    iNum += 1;
    itemInserts.push({
      ID: formatRecordId(iNum),
      TAGS: tags,
      'ITEM CODE': itemCode,
      BARCODE: barcode,
    });
  });

  await batchInsertSql(token, ref, 'web_INVENTORY_ITEM_CODE', itemInserts);
  console.log(`Item codes: ${itemInserts.length}`);
  console.log('Import complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
