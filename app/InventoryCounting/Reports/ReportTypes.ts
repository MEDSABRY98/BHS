'use client';

// Inventory Count report - data model, Excel parsing and grouping.

export type CountRow = {
  barcode: string;
  product: string;
  category: string;
  cost: number;
  available: number;
  counted: number;
  qtyAmount: number;
  diffQty: number;
  diffAmount: number;
};

export type CommitteeMember = { id: string; name: string; role: string };

export type CoverInfo = {
  countDate: string;
  serialNo: string;
  store: string;
  committee: CommitteeMember[];
  ceoName: string;
};

export type CategoryGroup = {
  category: string;
  rows: CountRow[];
  totals: Totals;
};

export type Totals = {
  available: number;
  counted: number;
  qtyAmount: number;
  diffQty: number;
  diffAmount: number;
};

export const TEMPLATE_HEADERS = [
  'Barcode',
  'Product Name',
  'Product Category',
  'Product Cost',
  'Available Qty',
  'QTY Count',
  'QTY Amount',
  'Diff QTY',
  'Diff Amount',
];

export const UNCATEGORIZED = 'Uncategorized';

const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const HEADER_KEYS: Record<string, keyof CountRow> = {
  barcode: 'barcode',
  productname: 'product',
  product: 'product',
  productcategory: 'category',
  category: 'category',
  productcost: 'cost',
  cost: 'cost',
  availableqty: 'available',
  available: 'available',
  qtycount: 'counted',
  countqty: 'counted',
  countedqty: 'counted',
  qtyamount: 'qtyAmount',
  diffqty: 'diffQty',
  diffamount: 'diffAmount',
};

function cellValue(v: any): unknown {
  if (v && typeof v === 'object') {
    if ('result' in v) return v.result;
    if ('text' in v) return v.text;
    if (Array.isArray(v.richText)) return v.richText.map((r: any) => r.text).join('');
  }
  return v;
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const s = v.replace(/,/g, '').replace(/[()\s]/g, (m) => (m === '(' ? '-' : '')).trim();
    if (!s || s === '-') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Reads the first worksheet of an .xlsx file. Throws an Error with a readable message. */
export async function parseCountExcel(file: File): Promise<CountRow[]> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('The file has no worksheet.');

  // find the header row (first 10 rows)
  let headerRow = 0;
  let colMap: Record<number, keyof CountRow> = {};
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    const map: Record<number, keyof CountRow> = {};
    sheet.getRow(r).eachCell((cell, col) => {
      const key = HEADER_KEYS[norm(cellValue(cell.value))];
      if (key) map[col] = key;
    });
    const keys = new Set(Object.values(map));
    if (keys.has('product') && keys.has('counted')) {
      headerRow = r;
      colMap = map;
      break;
    }
  }
  if (!headerRow) {
    throw new Error('Could not find the columns. Expected: ' + TEMPLATE_HEADERS.join(', '));
  }
  const present = new Set(Object.values(colMap));
  const missing = ['product', 'category', 'cost', 'available', 'counted'].filter((k) => !present.has(k as keyof CountRow));
  if (missing.length) {
    throw new Error('Missing columns in the file. Expected: ' + TEMPLATE_HEADERS.join(', '));
  }

  const rows: CountRow[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const raw: Partial<Record<keyof CountRow, unknown>> = {};
    Object.entries(colMap).forEach(([col, key]) => {
      raw[key] = cellValue(row.getCell(Number(col)).value);
    });
    const product = String(raw.product ?? '').trim();
    const barcode = String(raw.barcode ?? '').trim();
    if (!product && !barcode) continue;

    const cost = toNumber(raw.cost) ?? 0;
    const available = toNumber(raw.available) ?? 0;
    const counted = toNumber(raw.counted) ?? 0;
    const diffQty = toNumber(raw.diffQty) ?? counted - available;
    rows.push({
      barcode,
      product,
      category: String(raw.category ?? '').trim() || UNCATEGORIZED,
      cost,
      available,
      counted,
      qtyAmount: toNumber(raw.qtyAmount) ?? counted * cost,
      diffQty,
      diffAmount: toNumber(raw.diffAmount) ?? diffQty * cost,
    });
  }
  if (!rows.length) throw new Error('No product rows were found in the file.');
  return rows;
}

export function sumTotals(rows: CountRow[]): Totals {
  return rows.reduce<Totals>(
    (t, r) => ({
      available: t.available + r.available,
      counted: t.counted + r.counted,
      qtyAmount: t.qtyAmount + r.qtyAmount,
      diffQty: t.diffQty + r.diffQty,
      diffAmount: t.diffAmount + r.diffAmount,
    }),
    { available: 0, counted: 0, qtyAmount: 0, diffQty: 0, diffAmount: 0 },
  );
}

/** Groups by product category (A-Z), products inside each category by name (A-Z). */
export function groupByCategory(rows: CountRow[]): CategoryGroup[] {
  const map = new Map<string, CountRow[]>();
  rows.forEach((r) => {
    const list = map.get(r.category) || [];
    list.push(r);
    map.set(r.category, list);
  });
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  return Array.from(map.entries())
    .sort(([a], [b]) => (a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : cmp(a, b)))
    .map(([category, list]) => {
      const sorted = [...list].sort((a, b) => cmp(a.product, b.product));
      return { category, rows: sorted, totals: sumTotals(sorted) };
    });
}

export const fmtMoney = (n: number) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtQty = (n: number) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const DEFAULT_COVER: CoverInfo = {
  countDate: '',
  serialNo: '',
  store: '',
  committee: [{ id: 'm1', name: '', role: '' }],
  ceoName: '',
};

const COVER_KEY = 'inventoryCountingReportCover';

export function loadCover(): CoverInfo {
  try {
    const raw = localStorage.getItem(COVER_KEY);
    if (!raw) return DEFAULT_COVER;
    const p = JSON.parse(raw);
    return {
      ...DEFAULT_COVER,
      ...p,
      committee: Array.isArray(p?.committee) && p.committee.length ? p.committee : DEFAULT_COVER.committee,
    };
  } catch {
    return DEFAULT_COVER;
  }
}

export function saveCover(cover: CoverInfo) {
  try {
    localStorage.setItem(COVER_KEY, JSON.stringify(cover));
  } catch {
    /* storage unavailable */
  }
}

export function formatCoverDate(d: string): string {
  if (!d) return '';
  const t = new Date(d);
  if (isNaN(t.getTime())) return d;
  return `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`;
}
