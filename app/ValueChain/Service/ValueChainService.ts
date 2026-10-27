'use server';

// ════════════════════════════════════════════════════════════════
//  Value Chain — server side
//  • costs: purchase invoice lines (web_Suppliers_Purchase, same data as Purchase Price Tracking)
//      NEW cost = latest purchase price up to today
//      OLD cost = oldest purchase price inside the chosen old-cost range
//  • selling prices: sales invoice lines (same cache as Sales), unit price = amount ÷ qty
//  Only one row per product goes back to the browser.
// ════════════════════════════════════════════════════════════════

import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSalesDataServer } from '@/app/Sales/Cache/SalesCache';
import { isSalesInvoiceNo } from '@/app/Sales/Utils/InvoiceNumber';
import {
  CleanParentId,
  CustomerGroupOf,
  VALUE_CHAIN_SYSTEM_ID,
  round3,
  uaeToday,
  type CostPoint,
  type ValueChainData,
  type ValueChainPeriods,
  type ValueChainRow,
  type ProductCustomerRow,
  type ProductSupplierRow,
  type SupplierProductRow,
  type CustomerGroup,
  type CustomerProductRow,
  COST_DISCOUNT_KEY,
} from '../Utils/Types';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const EXCLUDED_PRODUCTS = new Set(['PACKAGING']); // same as Purchase Price Tracking

const id = (v: unknown) => String(v ?? '').trim();
const dayOf = (v: unknown) => String(v ?? '').split('T')[0].trim().slice(0, 10);
const num = (v: unknown) => Number(String(v ?? 0).replace(/,/g, '')) || 0;

/** Admin Control -> 'value-chain' must be enabled for the user (admins always). */
async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (isAdminUser(user, VALUE_CHAIN_SYSTEM_ID)) return user;
  try {
    const roleStr = String(user.role || '').trim();
    if (!roleStr || roleStr === 'Admin') return user;
    const perms = JSON.parse(roleStr);
    if (Array.isArray(perms.systems) && !perms.systems.includes(VALUE_CHAIN_SYSTEM_ID)) {
      throw new UnauthorizedError("You don't have access to Value Chain.");
    }
  } catch (e) {
    if (e instanceof UnauthorizedError) throw e;
    // unparsable role -> open (same default as the other modules)
  }
  return user;
}

/**
 * The costs this user sees: real cost × (1 − discount %), the % set for him in Admin Control (Value Chain card).
 * Admins (and users with no %) see the real costs. Applied here on the server, so the page never gets the real cost.
 */
function costFactorOf(user: SessionUserRecord): number {
  if (isAdminUser(user, VALUE_CHAIN_SYSTEM_ID)) return 1;
  try {
    const perms = JSON.parse(String(user.role || '').trim() || '{}');
    const pct = Number(perms?.[COST_DISCOUNT_KEY]);
    return Number.isFinite(pct) && pct > 0 && pct < 100 ? 1 - pct / 100 : 1;
  } catch {
    return 1;
  }
}

async function fetchAll(table: string, select: string, orderBy: string): Promise<any[]> {
  const db = getSupabaseAdmin();
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(select).order(orderBy, { ascending: true }).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function checkPeriods(p: ValueChainPeriods): ValueChainPeriods {
  const v = {
    oldFrom: dayOf(p?.oldFrom),
    oldTo: dayOf(p?.oldTo),
    saleFrom: dayOf(p?.saleFrom),
    saleTo: dayOf(p?.saleTo),
  };
  if (![v.oldFrom, v.oldTo, v.saleFrom, v.saleTo].every((d) => ISO_DAY.test(d))) throw new Error('Choose valid dates');
  if (v.oldFrom > v.oldTo) throw new Error('The old cost range must end on or after its start');
  if (v.saleFrom > v.saleTo) throw new Error('The sales period must end on or after its start');
  return v;
}

export async function GetValueChainData(periodsInput: ValueChainPeriods): Promise<ValueChainData> {
  const costFactor = costFactorOf(await requireUser());
  const periods = checkPeriods(periodsInput);
  const today = uaeToday();

  const [purchases, products, suppliers, sales, customers] = await Promise.all([
    fetchAll('web_Suppliers_Purchase', 'ID, DATE, "SUPPLIER ID", "PRODUCT ID", "UNIT PRICE", QTY', 'ID'),
    fetchAll('bhs_PRODUCTS', '"PRODUCT ID", "PRODUCT NAME", "PRODUCT BARCODE", "PRODUCT CATEGORY", "PRODUCT PARENT ID", "PRODUCT COST", "UNIT", IS_ACTIVE, IS_COUNTABLE', 'PRODUCT ID'),
    fetchAll('bhs_SUPPLIERS', '"SUPPLIER ID", "SUPPLIER NAME"', 'SUPPLIER ID'),
    getSalesDataServer() as Promise<any[]>,
    fetchAll('bhs_CUSTOMERS', '"CUSTOMER ID", "CUSTOMER SUB NAME", "CUSTOMER MAIN NAME", "CUSTOMER TAG"', 'CUSTOMER ID'),
  ]);
  const custById = new Map<string, any>();
  for (const c of customers) custById.set(id(c['CUSTOMER ID']).toUpperCase(), c);
  const buyers = new Set<string>(); // customers with sales in the period

  const productById = new Map<string, any>();
  const nameById = new Map<string, string>(); // every product, for the parent's name
  for (const p of products) {
    nameById.set(id(p['PRODUCT ID']), id(p['PRODUCT NAME']));
    const name = id(p['PRODUCT NAME']).toUpperCase();
    if (EXCLUDED_PRODUCTS.has(name)) continue;
    // cancelled products: the name has ملغي / ملغى
    if (/ملغ[يى]/.test(String(p['PRODUCT NAME'] ?? ''))) continue;
    // inactive products (Data Base → Products, IS_ACTIVE = false) are left out; empty = active
    const active = p.IS_ACTIVE;
    if (active === false || String(active).trim().toLowerCase() === 'false' || active === 0) continue;
    productById.set(id(p['PRODUCT ID']), p);
  }
  const supplierName = new Map<string, string>();
  for (const s of suppliers) supplierName.set(id(s['SUPPLIER ID']), id(s['SUPPLIER NAME']) || id(s['SUPPLIER ID']));

  // ── costs ──
  type Buy = { id: number; date: string; price: number; supplierId: string; qty: number };
  const buysByProduct = new Map<string, Buy[]>();
  const purchaseSuppliers = new Map<string, string>();
  for (const r of purchases) {
    const pid = id(r['PRODUCT ID']);
    const price = num(r['UNIT PRICE']) * costFactor;
    const date = dayOf(r.DATE);
    if (!pid || !productById.has(pid) || !(price > 0) || !ISO_DAY.test(date) || date > today) continue;
    const list = buysByProduct.get(pid) || [];
    list.push({ id: Number(r.ID) || 0, date, price, supplierId: id(r['SUPPLIER ID']), qty: Math.max(0, num(r.QTY)) });
    buysByProduct.set(pid, list);
    const sid = id(r['SUPPLIER ID']);
    if (sid) purchaseSuppliers.set(sid, supplierName.get(sid) || sid);
  }
  const point = (b: Buy): CostPoint => ({
    price: round3(b.price),
    date: b.date,
    supplierId: b.supplierId,
    supplierName: supplierName.get(b.supplierId) || b.supplierId || '',
    source: 'purchase',
  });

  // ── selling prices ──
  type Agg = { max: number; min: number; amount: number; qty: number; lines: number };
  const saleByProduct = new Map<string, Agg>();
  for (const s of sales) {
    const date = dayOf(s.invoiceDate);
    if (date < periods.saleFrom || date > periods.saleTo) continue;
    if (!isSalesInvoiceNo(s.invoiceNumber)) continue;
    const qty = num(s.qty);
    const amount = num(s.amount);
    if (!(qty > 0) || !(amount > 0)) continue;
    const pid = id(s.productId);
    if (!pid || !productById.has(pid)) continue;
    const cid = id(s.customerId).toUpperCase();
    if (cid) buyers.add(cid);
    const unit = amount / qty;
    const a = saleByProduct.get(pid) || { max: -Infinity, min: Infinity, amount: 0, qty: 0, lines: 0 };
    a.max = Math.max(a.max, unit);
    a.min = Math.min(a.min, unit);
    a.amount += amount;
    a.qty += qty;
    a.lines += 1;
    saleByProduct.set(pid, a);
  }

  // ── one row per product that was bought or sold ──
  const rows: ValueChainRow[] = [];
  const usedSuppliers = new Set<string>();
  for (const pid of new Set([...buysByProduct.keys(), ...saleByProduct.keys()])) {
    const p = productById.get(pid);
    const buys = (buysByProduct.get(pid) || []).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const latest = buys.length ? buys[buys.length - 1] : null;
    const oldest = buys.find((b) => b.date >= periods.oldFrom && b.date <= periods.oldTo) || null;
    const agg = saleByProduct.get(pid);
    const row: ValueChainRow = {
      productId: pid,
      barcode: id(p?.['PRODUCT BARCODE']),
      name: id(p?.['PRODUCT NAME']) || pid,
      unit: id(p?.['UNIT']),
      category: id(p?.['PRODUCT CATEGORY']) || 'Uncategorized',
      parentId: CleanParentId(p?.['PRODUCT PARENT ID']),
      parentName: nameById.get(CleanParentId(p?.['PRODUCT PARENT ID'])) || '',
      countable: p?.IS_COUNTABLE === true || String(p?.IS_COUNTABLE ?? '').trim().toLowerCase() === 'true',
      oldCost: oldest ? point(oldest) : null,
      // no purchase invoice → the cost from Data Base → Products
      newCost: latest
        ? point(latest)
        : num(p?.['PRODUCT COST']) > 0
          ? { price: round3(num(p?.['PRODUCT COST']) * costFactor), date: '', supplierId: '', supplierName: '', source: 'products' }
          : null,
      sale: agg
        ? { max: round3(agg.max), min: round3(agg.min), avg: round3(agg.qty ? agg.amount / agg.qty : 0), lines: agg.lines }
        : null,
    };
    // bought from 2+ suppliers → each supplier's last purchase (buys are oldest → newest)
    const bySupp = new Map<string, { last: Buy; qty: number }>();
    for (const b of buys) {
      const cur = bySupp.get(b.supplierId);
      bySupp.set(b.supplierId, { last: b, qty: (cur?.qty || 0) + b.qty });
    }
    if (bySupp.size >= 2) {
      row.supplierCosts = [...bySupp]
        .map(([sid, v]) => ({ supplierId: sid, name: supplierName.get(sid) || sid || 'Unknown supplier', price: round3(v.last.price), date: v.last.date, qty: v.qty }))
        .sort((a, b) => b.date.localeCompare(a.date) || a.price - b.price);
    }
    if (row.newCost?.supplierName) usedSuppliers.add(row.newCost.supplierName);
    rows.push(row);
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  // customer groups for the Customers tab
  const groups = new Map<string, CustomerGroup>();
  for (const cid of buyers) {
    const c = custById.get(cid);
    const sub = id(c?.['CUSTOMER SUB NAME']);
    const main = id(c?.['CUSTOMER MAIN NAME']);
    const g = CustomerGroupOf({ customerId: cid, name: sub || main || cid, mainName: main, subName: sub, tag: id(c?.['CUSTOMER TAG']) });
    const cur = groups.get(g.key) || { ...g, customerIds: [] };
    cur.customerIds.push(cid);
    groups.set(g.key, cur);
  }

  return {
    periods,
    rows,
    customerGroups: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    suppliers: [...usedSuppliers].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    purchaseSuppliers: [...purchaseSuppliers]
      .map(([sid, name]) => ({ id: sid, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    loadedAt: new Date().toISOString(),
  };
}

/** Product details: the customers who bought the product in the sales period (sales invoices, qty > 0). */
export async function GetProductCustomers(productId: string, saleFrom: string, saleTo: string): Promise<ProductCustomerRow[]> {
  await requireUser();
  const pid = id(productId);
  const from = dayOf(saleFrom);
  const to = dayOf(saleTo);
  if (!pid) throw new Error('Choose a product');
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || from > to) throw new Error('Choose a valid sales period');

  const [sales, customers] = await Promise.all([
    getSalesDataServer() as Promise<any[]>,
    fetchAll('bhs_CUSTOMERS', '"CUSTOMER ID", "CUSTOMER SUB NAME", "CUSTOMER MAIN NAME", "CUSTOMER CITY", "CUSTOMER TAG"', 'CUSTOMER ID'),
  ]);
  const custById = new Map<string, any>();
  for (const c of customers) custById.set(id(c['CUSTOMER ID']).toUpperCase(), c);

  type Agg = { max: number; min: number; amount: number; qty: number; lastDate: string };
  const byCustomer = new Map<string, Agg>();
  let total = 0;
  for (const s of sales) {
    if (id(s.productId) !== pid) continue;
    const date = dayOf(s.invoiceDate);
    if (date < from || date > to || !isSalesInvoiceNo(s.invoiceNumber)) continue;
    const qty = num(s.qty);
    const amount = num(s.amount);
    if (!(qty > 0) || !(amount > 0)) continue;
    const cid = id(s.customerId).toUpperCase();
    const unit = amount / qty;
    const a = byCustomer.get(cid) || { max: -Infinity, min: Infinity, amount: 0, qty: 0, lastDate: '' };
    a.max = Math.max(a.max, unit);
    a.min = Math.min(a.min, unit);
    a.amount += amount;
    a.qty += qty;
    if (date > a.lastDate) a.lastDate = date;
    byCustomer.set(cid, a);
    total += amount;
  }

  return [...byCustomer]
    .map(([cid, a]) => {
      const c = custById.get(cid);
      return {
        customerId: cid,
        name: id(c?.['CUSTOMER SUB NAME']) || id(c?.['CUSTOMER MAIN NAME']) || cid,
        mainName: id(c?.['CUSTOMER MAIN NAME']),
        subName: id(c?.['CUSTOMER SUB NAME']),
        tag: id(c?.['CUSTOMER TAG']),
        city: id(c?.['CUSTOMER CITY']),
        max: round3(a.max),
        min: round3(a.min),
        avg: round3(a.qty ? a.amount / a.qty : 0),
        amount: Math.round(a.amount * 100) / 100,
        qty: a.qty,
        share: total ? (a.amount / total) * 100 : 0,
        lastDate: a.lastDate,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Product details → Suppliers: every supplier the product was bought from (all purchase history up to today). */
export async function GetProductSuppliers(productId: string): Promise<ProductSupplierRow[]> {
  const costFactor = costFactorOf(await requireUser());
  const pid = id(productId);
  if (!pid) throw new Error('Choose a product');
  const today = uaeToday();
  const db = getSupabaseAdmin();

  const lines: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('web_Suppliers_Purchase')
      .select('ID, DATE, "SUPPLIER ID", "UNIT PRICE", QTY')
      .eq('PRODUCT ID', pid)
      .order('ID', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    lines.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const suppliers = await fetchAll('bhs_SUPPLIERS', '"SUPPLIER ID", "SUPPLIER NAME"', 'SUPPLIER ID');
  const nameOf = new Map<string, string>();
  for (const s of suppliers) nameOf.set(id(s['SUPPLIER ID']), id(s['SUPPLIER NAME']));

  type Buy = { id: number; date: string; price: number; qty: number };
  const bySupplier = new Map<string, Buy[]>();
  let totalQty = 0;
  for (const r of lines) {
    const price = num(r['UNIT PRICE']) * costFactor;
    const date = dayOf(r.DATE);
    if (!(price > 0) || !ISO_DAY.test(date) || date > today) continue;
    const sid = id(r['SUPPLIER ID']);
    const qty = Math.max(0, num(r.QTY));
    const list = bySupplier.get(sid) || [];
    list.push({ id: Number(r.ID) || 0, date, price, qty });
    bySupplier.set(sid, list);
    totalQty += qty;
  }

  return [...bySupplier]
    .map(([sid, buys]) => {
      buys.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
      const first = buys[0];
      const last = buys[buys.length - 1];
      const qty = buys.reduce((s, b) => s + b.qty, 0);
      return {
        supplierId: sid,
        name: nameOf.get(sid) || sid || 'Unknown supplier',
        first: { price: round3(first.price), date: first.date },
        last: { price: round3(last.price), date: last.date },
        min: round3(Math.min(...buys.map((b) => b.price))),
        max: round3(Math.max(...buys.map((b) => b.price))),
        purchases: buys.length,
        qty,
        share: totalQty ? (qty / totalQty) * 100 : 0,
      };
    })
    .sort((a, b) => b.last.date.localeCompare(a.last.date)); // latest supplier first
}

/** Suppliers tab: every product bought from one supplier, with its purchase prices (all history up to today). */
export async function GetSupplierProducts(supplierId: string): Promise<SupplierProductRow[]> {
  const costFactor = costFactorOf(await requireUser());
  const sid = id(supplierId);
  if (!sid) throw new Error('Choose a supplier');
  const today = uaeToday();
  const db = getSupabaseAdmin();

  const lines: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('web_Suppliers_Purchase')
      .select('ID, DATE, "PRODUCT ID", "UNIT PRICE", QTY')
      .eq('SUPPLIER ID', sid)
      .order('ID', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    lines.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  type Buy = { id: number; date: string; price: number; qty: number };
  const byProduct = new Map<string, Buy[]>();
  for (const r of lines) {
    const price = num(r['UNIT PRICE']) * costFactor;
    const date = dayOf(r.DATE);
    const pid = id(r['PRODUCT ID']);
    if (!pid || !(price > 0) || !ISO_DAY.test(date) || date > today) continue;
    const list = byProduct.get(pid) || [];
    list.push({ id: Number(r.ID) || 0, date, price, qty: Math.max(0, num(r.QTY)) });
    byProduct.set(pid, list);
  }

  return [...byProduct].map(([pid, buys]) => {
    buys.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const first = buys[0];
    const last = buys[buys.length - 1];
    return {
      productId: pid,
      first: { price: round3(first.price), date: first.date },
      last: { price: round3(last.price), date: last.date },
      min: round3(Math.min(...buys.map((b) => b.price))),
      max: round3(Math.max(...buys.map((b) => b.price))),
      purchases: buys.length,
      qty: buys.reduce((s, b) => s + b.qty, 0),
      amount: Math.round(buys.reduce((s, b) => s + b.price * b.qty, 0) * 100) / 100,
    };
  });
}

/** Customers tab: every product sold to a group of customers in the sales period (sales invoices, qty > 0). */
export async function GetCustomerProducts(customerIds: string[], saleFrom: string, saleTo: string): Promise<CustomerProductRow[]> {
  await requireUser();
  const ids = new Set((Array.isArray(customerIds) ? customerIds : []).map((c) => id(c).toUpperCase()).filter(Boolean));
  const from = dayOf(saleFrom);
  const to = dayOf(saleTo);
  if (!ids.size) throw new Error('Choose a customer');
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || from > to) throw new Error('Choose a valid sales period');

  const sales = (await getSalesDataServer()) as any[];
  type Agg = { max: number; min: number; amount: number; qty: number; lastDate: string };
  const byProduct = new Map<string, Agg>();
  let total = 0;
  for (const s of sales) {
    if (!ids.has(id(s.customerId).toUpperCase())) continue;
    const date = dayOf(s.invoiceDate);
    if (date < from || date > to || !isSalesInvoiceNo(s.invoiceNumber)) continue;
    const qty = num(s.qty);
    const amount = num(s.amount);
    if (!(qty > 0) || !(amount > 0)) continue;
    const pid = id(s.productId);
    if (!pid) continue;
    const unit = amount / qty;
    const a = byProduct.get(pid) || { max: -Infinity, min: Infinity, amount: 0, qty: 0, lastDate: '' };
    a.max = Math.max(a.max, unit);
    a.min = Math.min(a.min, unit);
    a.amount += amount;
    a.qty += qty;
    if (date > a.lastDate) a.lastDate = date;
    byProduct.set(pid, a);
    total += amount;
  }

  return [...byProduct].map(([pid, a]) => ({
    productId: pid,
    max: round3(a.max),
    min: round3(a.min),
    avg: round3(a.qty ? a.amount / a.qty : 0),
    amount: Math.round(a.amount * 100) / 100,
    qty: a.qty,
    lastDate: a.lastDate,
    share: total ? (a.amount / total) * 100 : 0,
  }));
}
