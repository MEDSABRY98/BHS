// ════════════════════════════════════════════════════════════════
//  Salesperson Analysis — one salesperson's data (server only).
//  Used by the module screen (SalespersonService.GetSalespersonData)
//  and by Scheduled Reports (Debit & Collections email).
//  No 'use server' on purpose: these functions must not be callable
//  from the browser — callers decide who may see what.
//  Rules: sales invoice → sub customer's SALES_REP, payments follow
//  MATCHING, the rest split equally (see debit_scope.ts).
// ════════════════════════════════════════════════════════════════

import { getSheetData } from '@/lib/supabase';
import { getSalesDataServer } from '@/app/Sales/Cache/SalesCache';
import { applyDebitScope, buildDebitScopeFor } from '@/app/CustomersAnalysis/Service/debit_scope';
import { getInvoiceType } from '@/app/CustomersAnalysis/Utils/InvoiceType';
import type { InvoiceRow } from '@/types';
import type { LedgerRow, Period, SalesCustomerInfo, SalesLine, SalesProductInfo, SalespersonData } from '../Utils/Types';
import { loadCustomers, loadUsers } from './DailyReportData';

const norm = (v: unknown) => String(v ?? '').trim().toUpperCase();
const dayOf = (v: unknown) => String(v ?? '').split('T')[0].trim();
const pad = (n: number) => String(n).padStart(2, '0');
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function shiftYear(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(y + years, m, 0).getDate();
  return `${y + years}-${pad(m)}-${pad(Math.min(d, last))}`;
}

/** Everything the loader reads — load once and reuse it for several salespersons. */
export type SalespersonInputs = {
  idByKey: Map<string, string>;
  nameById: Map<string, string>;
  customers: Awaited<ReturnType<typeof loadCustomers>>;
  salesAll: any[];
  sheet: InvoiceRow[];
};

export async function LoadSalespersonInputs(): Promise<SalespersonInputs> {
  const [{ idByKey, nameById }, customers, salesAll, sheet] = await Promise.all([
    loadUsers(),
    loadCustomers(),
    getSalesDataServer() as Promise<any[]>,
    getSheetData() as Promise<InvoiceRow[]>,
  ]);
  return { idByKey, nameById, customers, salesAll, sheet };
}

/** Salesperson id (as stored in bhs_USERS) for an id or a name. */
export function ResolveSalespersonId(inputs: Pick<SalespersonInputs, 'idByKey'>, idOrName: string): string {
  return inputs.idByKey.get(norm(idOrName)) || norm(idOrName);
}

/** One salesperson's sales lines + his share of the customers' ledger. */
export async function BuildSalespersonData(opts: {
  salespersonId: string;
  period: Period;
  showCosts: boolean;
  inputs?: SalespersonInputs;
}): Promise<SalespersonData> {
  const { start, end } = opts.period || ({} as Period);
  if (!ISO_DAY.test(String(start)) || !ISO_DAY.test(String(end)) || start > end) {
    throw new Error('Invalid period');
  }
  const { idByKey, nameById, customers, salesAll, sheet } = opts.inputs || (await LoadSalespersonInputs());

  const targetId = idByKey.get(norm(opts.salespersonId)) || norm(opts.salespersonId);
  const salesperson = { id: targetId, name: nameById.get(targetId) || opts.salespersonId };
  const isTarget = (rep: string) => !!rep && (idByKey.get(rep) || rep) === targetId;

  const windowStart = shiftYear(start, -1);
  const showCosts = !!opts.showCosts;

  // ── sales lines of his customers (sub customer's SALES_REP) ──
  const sales: SalesLine[] = [];
  const customerInfo: Record<string, SalesCustomerInfo> = {};
  const productInfo: Record<string, SalesProductInfo> = {};
  for (const s of salesAll) {
    const cust = customers.get(norm(s.customerId));
    if (!cust || !isTarget(cust.rep)) continue;
    const date = dayOf(s.invoiceDate);
    if (!date) continue;

    const info =
      customerInfo[cust.id] ||
      (customerInfo[cust.id] = {
        id: cust.id,
        name: cust.subName,
        mainName: cust.mainName,
        city: cust.city,
        firstPurchase: date,
        lastPurchase: date,
      });
    const amount = Number(s.amount) || 0;
    if (amount > 0) {
      if (date < info.firstPurchase) info.firstPurchase = date;
      if (date > info.lastPurchase) info.lastPurchase = date;
    }

    if (date < windowStart || date > end) continue;
    const productId = String(s.productId ?? '').trim();
    if (productId && !productInfo[productId]) {
      productInfo[productId] = {
        id: productId,
        barcode: String(s.barcode || '').trim(),
        name: String(s.product || productId).trim(),
        category: String(s.productTag || 'Uncategorized').trim() || 'Uncategorized',
      };
    }
    sales.push({
      date,
      invoice: String(s.invoiceNumber ?? '').trim(),
      customerId: cust.id,
      productId,
      amount,
      qty: Number(s.qty) || 0,
      cost: showCosts ? Number(s.productCost) || 0 : 0,
    });
  }

  // ── his share of the ledger ──
  const scope = await buildDebitScopeFor({ id: salesperson.id, name: salesperson.name }, { includeMerchandiser: false });
  const mine = applyDebitScope(sheet, scope);

  // last payment per main customer (all history)
  const lastPaymentByCustomer: Record<string, string> = {};
  // closed matching groups entirely before the window don't change balances / aging.
  // A group is dropped only as a whole: dropping just its old rows would leave a fake
  // residual and make the Debit numbers depend on the selected period.
  const groupNet = new Map<string, number>();
  const groupLastDate = new Map<string, string>();
  for (const r of mine) {
    const key = String(r.matching || '').trim();
    if (key) {
      groupNet.set(key, (groupNet.get(key) || 0) + (Number(r.debit) || 0) - (Number(r.credit) || 0));
      const d = dayOf(r.date);
      if (d > (groupLastDate.get(key) || '')) groupLastDate.set(key, d);
    }
    if (getInvoiceType(r) === 'Payment') {
      const d = dayOf(r.date);
      const name = r.customerName || '';
      if (d && (!lastPaymentByCustomer[name] || d > lastPaymentByCustomer[name])) lastPaymentByCustomer[name] = d;
    }
  }

  const ledger: LedgerRow[] = [];
  for (const r of mine) {
    const date = dayOf(r.date);
    const key = String(r.matching || '').trim();
    const closedOldGroup = key && Math.abs(groupNet.get(key) || 0) < 0.01 && (groupLastDate.get(key) || '') < windowStart;
    if (closedOldGroup) continue;
    ledger.push({
      id: String(r.id),
      date,
      dueDate: dayOf(r.dueDate),
      number: r.number || '',
      customerId: r.customerId || '',
      customerName: r.customerName || '',
      city: r.city || '',
      debit: Number(r.debit) || 0,
      credit: Number(r.credit) || 0,
      matching: key,
      paymentTerm: r.paymentTerm,
      isCustomerVendor: r.isCustomerVendor,
    });
  }

  return {
    salesperson,
    period: { start, end },
    windowStart,
    showCosts,
    sales,
    customers: customerInfo,
    products: productInfo,
    ledger,
    lastPaymentByCustomer,
  };
}
