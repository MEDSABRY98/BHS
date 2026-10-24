// Value Chain — shared types and small helpers (browser + server).

export const VALUE_CHAIN_SYSTEM_ID = 'value-chain';

export type PriceMode = 'max' | 'min' | 'avg';

/** overall = the product's selling price from all customers; customer = each customer's own price */
export type PriceBasis = 'overall' | 'customer';

export const PRICE_BASES: { id: PriceBasis; label: string; hint: string }[] = [
  { id: 'overall', label: 'Overall', hint: "The product's price from all customers (whole database)" },
  { id: 'customer', label: 'Per Customer', hint: "Each customer's own price (Customers tab and product customers)" },
];

/** all products / profit > 0 / profit < 0 / profit = 0 (on the new cost, with the chosen selling price) */
export type ProfitFilter = 'all' | 'profit' | 'loss' | 'even';

/** does a profit pass the Profit filter? (rounded to fils; no profit = only in "All products") */
export function PassProfit(profit: number | null, filter: ProfitFilter): boolean {
  if (filter === 'all') return true;
  if (profit === null) return false;
  const v = Math.round(profit * 100) / 100;
  return filter === 'profit' ? v > 0 : filter === 'loss' ? v < 0 : v === 0;
}

export const PROFIT_FILTERS: { id: ProfitFilter; label: string }[] = [
  { id: 'all', label: 'All products' },
  { id: 'profit', label: 'Profitable only' },
  { id: 'loss', label: 'Losing only' },
  { id: 'even', label: 'No profit / no loss' },
];

export const PRICE_MODES: { id: PriceMode; label: string; hint: string }[] = [
  { id: 'max', label: 'Highest', hint: 'Highest unit selling price in the period' },
  { id: 'avg', label: 'Average', hint: 'Total amount ÷ total quantity in the period' },
  { id: 'min', label: 'Lowest', hint: 'Lowest unit selling price in the period' },
];

/** Server filters: changing them reloads the data. */
export type ValueChainPeriods = {
  /** the OLD cost = the oldest purchase price in this range */
  oldFrom: string;
  oldTo: string;
  /** selling prices are taken from sales invoices in this range */
  saleFrom: string;
  saleTo: string;
};

/** source 'products' = no purchase invoice, the cost comes from Data Base → Products (PRODUCT COST), no date */
export type CostPoint = { price: number; date: string; supplierId: string; supplierName: string; source?: 'purchase' | 'products' };

/** one supplier's last purchase of a product */
export type SupplierCost = { supplierId: string; name: string; price: number; date: string; qty: number };

export type ValueChainRow = {
  productId: string;
  barcode: string;
  name: string;
  /** Data Base → Products: UNIT */
  unit: string;
  category: string;
  /** PRODUCT PARENT ID ('' = no parent) and the parent's name */
  parentId: string;
  parentName: string;
  /** Data Base → Products: Is Countable? */
  countable: boolean;
  /** only when bought from 2+ suppliers: each supplier's last purchase (Multi Supplier tab), newest first */
  supplierCosts?: SupplierCost[];
  /** oldest purchase price inside the old-cost range */
  oldCost: CostPoint | null;
  /** latest purchase price up to today */
  newCost: CostPoint | null;
  /** unit selling prices in the sales period (sales invoices, qty > 0) */
  sale: { max: number; min: number; avg: number; lines: number } | null;
};

export type ValueChainData = {
  periods: ValueChainPeriods;
  rows: ValueChainRow[];
  suppliers: string[];
  /** every supplier with purchase invoices (Suppliers tab) */
  purchaseSuppliers: { id: string; name: string }[];
  /** customers who bought in the sales period, grouped (Customers tab) */
  customerGroups: CustomerGroup[];
  loadedAt: string;
};

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const round3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;

export function uaeToday(): string {
  return new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Default periods:
 * old cost → from the 1st of the month 3 months before the current one (in October: 1 July) to today;
 * sales → 1 Jan of last year to today.
 */
export function DefaultPeriods(): ValueChainPeriods {
  const today = uaeToday();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 3; // 3 months back, may cross the year
  const oldY = m <= 0 ? y - 1 : y;
  const oldM = m <= 0 ? m + 12 : m;
  const oldFrom = `${oldY}-${String(oldM).padStart(2, '0')}-01`;
  return { oldFrom, oldTo: today, saleFrom: `${y - 1}-01-01`, saleTo: today };
}

/** the date line under a cost: its purchase date, or "Products DB" */
export function CostDateLabel(p: CostPoint | null | undefined): string {
  if (!p) return '';
  return p.source === 'products' ? 'Products DB' : FormatDate(p.date);
}

export function FormatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return y && m && d ? `${d}-${months[Number(m) - 1] || m}-${y}` : String(iso);
}

export function Money(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Selling price of a row for the chosen mode (null = no sales in the period). */
export function SalePrice(row: ValueChainRow, mode: PriceMode): number | null {
  if (!row.sale) return null;
  return mode === 'max' ? row.sale.max : mode === 'min' ? row.sale.min : row.sale.avg;
}

/** Profit / margin on the NEW cost. */
export function Margin(row: ValueChainRow, mode: PriceMode): { price: number | null; profit: number | null; pct: number | null } {
  const price = SalePrice(row, mode);
  const cost = row.newCost?.price ?? null;
  if (price === null || cost === null) return { price, profit: null, pct: null };
  const profit = price - cost;
  return { price, profit, pct: price > 0 ? (profit / price) * 100 : null };
}

/** New cost vs old cost, in % (null when one is missing). */
export function CostChange(row: ValueChainRow): number | null {
  const o = row.oldCost?.price;
  const n = row.newCost?.price;
  if (!o || n === undefined || n === null) return null;
  return ((n - o) / o) * 100;
}

/** Normal = all products; No Parent / With Parent (same idea as Purchase Planning). */
export type ParentView = 'all' | 'noParent' | 'withParent';

/** PRODUCT PARENT ID: empty or 0 = the product has no parent (returns ''). */
export function CleanParentId(value: unknown): string {
  const v = String(value ?? '').trim();
  return v === '' || /^0+$/.test(v) ? '' : v;
}

/** One customer of a product in the sales period (product details). */
export type ProductCustomerRow = {
  customerId: string;
  name: string;
  mainName: string;
  subName: string;
  tag: string;
  city: string;
  max: number;
  min: number;
  avg: number;
  amount: number;
  qty: number;
  /** share of the product's sales amount in the period, % */
  share: number;
  /** last invoice date of the product to this customer in the period */
  lastDate: string;
};

/** One supplier of a product (product details → Suppliers). Prices are unit purchase prices. */
export type ProductSupplierRow = {
  supplierId: string;
  name: string;
  first: { price: number; date: string };
  last: { price: number; date: string };
  min: number;
  max: number;
  purchases: number;
  qty: number;
  /** share of the product's purchased quantity, % */
  share: number;
};

/** Suppliers tab: one product bought from the chosen supplier (all purchase history up to today). */
export type SupplierProductRow = {
  productId: string;
  first: { price: number; date: string };
  last: { price: number; date: string };
  min: number;
  max: number;
  purchases: number;
  qty: number;
  /** Σ unit price × qty */
  amount: number;
};

export type ValueChainTab = 'products' | 'multi' | 'suppliers' | 'customers';

/**
 * Customers grouping (same rule everywhere in this module):
 * main name ≠ sub name → by MAIN NAME; main = sub → by CUSTOMER TAG; main = sub and no tag → the customer on his own.
 */
export type CustomerGroup = { key: string; name: string; kind: 'main' | 'tag' | 'customer'; customerIds: string[] };

export function CustomerGroupOf(c: { customerId: string; name: string; mainName: string; subName: string; tag: string }): Omit<CustomerGroup, 'customerIds'> {
  const main = c.mainName.trim();
  const sub = c.subName.trim();
  const same = !main || !sub || main.toUpperCase() === sub.toUpperCase();
  if (!same) return { key: `M|${main.toUpperCase()}`, name: main, kind: 'main' };
  if (c.tag.trim()) return { key: `T|${c.tag.trim().toUpperCase()}`, name: c.tag.trim(), kind: 'tag' };
  return { key: `C|${c.customerId}`, name: c.name, kind: 'customer' };
}

/** Customers tab: one product sold to the chosen customer group in the sales period. */
export type CustomerProductRow = {
  productId: string;
  max: number;
  min: number;
  avg: number;
  amount: number;
  qty: number;
  lastDate: string;
  /** share of the group's sales amount, % */
  share: number;
};
