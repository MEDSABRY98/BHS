'use server';

// Customers Discounts — all writes go through here (server side, session + tab permission checked).

import { getSessionUser, isAdminUser, UnauthorizedError } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { buildOpenBalanceMonthsByCustomer, isPastMonth, monthKey } from '../Utils/OpenBalanceByMonth';
import { buildSettlementId, parseSettlementId } from '../Utils/settlementUtils';

const DISCOUNTS = 'web_CUSTOMERS_DISCOUNTS';
const SETTLEMENTS = 'web_CUSTOMERS_DISCOUNTS_SETTLEMENTS';
const SYSTEM_ID = 'customers-discounts';

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

const db = () => getSupabaseAdmin();

function errMsg(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  const m = (error as { message?: string })?.message;
  return m || fallback;
}

/** Same rules as the sidebar: role JSON -> systems[] and "customers-discounts": [tab ids]. */
async function requireTab(...tabIds: string[]) {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (isAdminUser(user)) return user;
  let perms: Record<string, unknown> = {};
  try {
    perms = JSON.parse(String(user.role || '').trim() || '{}') || {};
  } catch {
    return user; // unparsable role -> full access (same as the UI)
  }
  const systems = perms.systems;
  if (Array.isArray(systems) && !systems.includes(SYSTEM_ID)) {
    throw new UnauthorizedError("You don't have access to Customers Discounts.");
  }
  const tabs = perms[SYSTEM_ID];
  if (Array.isArray(tabs) && !tabIds.some((id) => tabs.includes(id))) {
    throw new UnauthorizedError("You don't have permission for this action.");
  }
  return user;
}

/** Reads a whole table page by page with a fixed order (throws on any error). */
async function fetchAll(table: string, columns: string, orderBy: string, filter?: (q: any) => any): Promise<any[]> {
  const out: any[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    let q = db().from(table).select(columns);
    if (filter) q = filter(q);
    const { data, error } = await q.order(orderBy, { ascending: true }).range(from, from + size - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

function monthsRange(startYear: number, startMonth: number, endYear: number) {
  const rows: { year: number; month: number }[] = [];
  for (let y = startYear; y <= endYear; y++) {
    for (let m = y === startYear ? startMonth : 1; m <= 12; m++) rows.push({ year: y, month: m });
  }
  return rows;
}

async function nextDiscountId(): Promise<string> {
  const rows = await fetchAll(DISCOUNTS, 'ID', 'ID');
  const max = rows.reduce((acc: number, r: any) => {
    const m = String(r.ID || '').match(/^R-(\d+)$/i);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `R-${String(max + 1).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────
//  Discounts
// ─────────────────────────────────────────────────────────────
export async function addDiscount(input: {
  customerId: string;
  name: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  startYear: number;
  startMonth: number;
  settlementType?: string;
}): Promise<Result<{ id: string }>> {
  try {
    await requireTab('add');
    const customerId = String(input.customerId || '').trim();
    const name = String(input.name || '').trim();
    const value = Number(input.value);
    const startYear = Math.trunc(Number(input.startYear));
    const startMonth = Math.trunc(Number(input.startMonth));
    if (!customerId) return { success: false, error: 'Please select a customer.' };
    if (!name) return { success: false, error: 'Please enter a discount/rent name.' };
    if (!(value > 0)) return { success: false, error: 'Please enter a valid positive value.' };
    if (!(startYear >= 2000 && startYear <= 2100) || !(startMonth >= 1 && startMonth <= 12)) {
      return { success: false, error: 'Please choose a valid start month.' };
    }

    const currentYear = new Date().getFullYear();
    const endYear = Math.max(startYear, currentYear);

    // Reserve the next R-xxxx number (retry if another user took it at the same moment)
    let id = '';
    for (let attempt = 0; attempt < 5 && !id; attempt++) {
      const candidate = await nextDiscountId();
      const { error } = await db().from(DISCOUNTS).insert({
        ID: candidate,
        CUSTOMER_ID: customerId,
        DISCOUNT_NAME: name,
        DISCOUNT_TYPE: input.type === 'percentage' ? 'percentage' : 'fixed_amount',
        DISCOUNT_VALUE: value,
        SETTLEMENT_TYPE: input.settlementType || 'monthly',
      });
      if (!error) id = candidate;
      else if (error.code !== '23505') throw error;
    }
    if (!id) return { success: false, error: 'Could not reserve a discount number, please try again.' };

    const settlements = monthsRange(startYear, startMonth, endYear).map(({ year, month }) => ({
      ID: buildSettlementId(id, year, month),
      CUSTOMER_ID: customerId,
      MONTH: month,
      YEAR: year,
      STATUS: 'Pending',
      NOTES: '',
    }));
    const { error: sErr } = await db().from(SETTLEMENTS).insert(settlements);
    if (sErr) {
      await db().from(DISCOUNTS).delete().eq('ID', id); // don't leave a discount without months
      throw sErr;
    }
    return { success: true, id };
  } catch (error) {
    console.error('addDiscount', error);
    return { success: false, error: errMsg(error, 'An error occurred while saving.') };
  }
}

export async function updateDiscount(input: {
  id: string;
  name: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
}): Promise<Result> {
  try {
    await requireTab('grid');
    const name = String(input.name || '').trim();
    const value = Number(input.value);
    if (!name || !(value > 0)) return { success: false, error: 'Please provide valid inputs.' };
    const { data, error } = await db()
      .from(DISCOUNTS)
      .update({ DISCOUNT_NAME: name, DISCOUNT_TYPE: input.type === 'percentage' ? 'percentage' : 'fixed_amount', DISCOUNT_VALUE: value })
      .eq('ID', input.id)
      .select('ID');
    if (error) throw error;
    if (!data?.length) return { success: false, error: 'Discount not found.' };
    return { success: true };
  } catch (error) {
    console.error('updateDiscount', error);
    return { success: false, error: errMsg(error, 'Error updating discount.') };
  }
}

export async function deleteDiscount(discountId: string): Promise<Result> {
  try {
    await requireTab('grid');
    const id = String(discountId || '').trim();
    if (!id) return { success: false, error: 'Discount ID is missing.' };
    const { error: sErr } = await db().from(SETTLEMENTS).delete().like('ID', `S-${id}-%`);
    if (sErr) throw sErr;
    const { error } = await db().from(DISCOUNTS).delete().eq('ID', id);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('deleteDiscount', error);
    return { success: false, error: errMsg(error, 'An error occurred while deleting.') };
  }
}

export async function updateSettlementType(customerId: string, newType: 'monthly' | 'with_payment'): Promise<Result> {
  try {
    await requireTab('grid');
    const { error } = await db()
      .from(DISCOUNTS)
      .update({ SETTLEMENT_TYPE: newType === 'with_payment' ? 'with_payment' : 'monthly' })
      .eq('CUSTOMER_ID', String(customerId || '').trim());
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('updateSettlementType', error);
    return { success: false, error: errMsg(error, 'Failed to update settlement mode.') };
  }
}

// ─────────────────────────────────────────────────────────────
//  Settlements
// ─────────────────────────────────────────────────────────────
export async function setSettlementStatus(ids: string[], status: 'Settled' | 'Pending'): Promise<Result> {
  try {
    await requireTab('grid', 'months');
    const clean = Array.from(new Set((ids || []).map((x) => String(x || '').trim()).filter(Boolean)));
    if (clean.length === 0) return { success: true };
    for (let i = 0; i < clean.length; i += 200) {
      const { error } = await db()
        .from(SETTLEMENTS)
        .update({ STATUS: status === 'Settled' ? 'Settled' : 'Pending' })
        .in('ID', clean.slice(i, i + 200));
      if (error) throw error;
    }
    return { success: true };
  } catch (error) {
    console.error('setSettlementStatus', error);
    return { success: false, error: errMsg(error, 'An error occurred while updating the months.') };
  }
}

/**
 * New year: every discount whose months stop before this year gets Jan–Dec of the missing years.
 * Safe to call on every page load (only inserts what is missing).
 */
export async function ensureCurrentYearSettlements(): Promise<Result<{ created: number }>> {
  try {
    const user = await getSessionUser();
    if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
    const year = new Date().getFullYear();

    const [discounts, rows] = await Promise.all([
      fetchAll(DISCOUNTS, 'ID, CUSTOMER_ID', 'ID'),
      fetchAll(SETTLEMENTS, 'ID, YEAR', 'ID'),
    ]);
    // Latest year each discount already has months for
    const latestYear = new Map<string, number>();
    rows.forEach((r: any) => {
      const parsed = parseSettlementId(String(r.ID || ''));
      const y = Number(r.YEAR);
      if (!parsed || !Number.isFinite(y)) return;
      latestYear.set(parsed.discountId, Math.max(latestYear.get(parsed.discountId) ?? 0, y));
    });

    const toInsert: any[] = [];
    discounts.forEach((d: any) => {
      const id = String(d.ID || '').trim();
      const last = latestYear.get(id);
      // Only roll forward discounts whose months stop before this year
      // (no months at all, or months starting in a future year -> leave as is)
      if (!id || last === undefined || last >= year) return;
      for (let y = last + 1; y <= year; y++) {
        for (let month = 1; month <= 12; month++) {
          toInsert.push({
            ID: buildSettlementId(id, y, month),
            CUSTOMER_ID: String(d.CUSTOMER_ID || '').trim(),
            MONTH: month,
            YEAR: y,
            STATUS: 'Pending',
            NOTES: '',
          });
        }
      }
    });

    for (let i = 0; i < toInsert.length; i += 500) {
      const { error } = await db()
        .from(SETTLEMENTS)
        .upsert(toInsert.slice(i, i + 500), { onConflict: 'ID', ignoreDuplicates: true });
      if (error) throw error;
    }
    return { success: true, created: toInsert.length };
  } catch (error) {
    console.error('ensureCurrentYearSettlements', error);
    return { success: false, error: errMsg(error, 'Could not prepare this year’s months.') };
  }
}

export type AutoSettleResult = {
  settledCount: number;
  settledIds: string[];
  scannedPending: number;
  customerCount: number;
  skippedNoLedger: number;
};

/**
 * Past-month Pending settlements -> Settled when the customer has no open balance
 * for that invoice-date month. Current month never included.
 * apply=false only counts (for the confirmation); apply=true writes.
 * Stops if the Debit ledger can't be read, and skips customers with no ledger rows at all.
 */
export async function autoSettleClearedMonths(apply: boolean): Promise<Result<AutoSettleResult>> {
  try {
    await requireTab('grid', 'months');

    const pendingRows = await fetchAll(SETTLEMENTS, 'ID, CUSTOMER_ID, MONTH, YEAR, STATUS', 'ID', (q) => q.eq('STATUS', 'Pending'));
    const pastPending = pendingRows.filter((r: any) => {
      const month = Number(r.MONTH);
      const year = Number(r.YEAR);
      return Number.isFinite(month) && Number.isFinite(year) && isPastMonth(year, month);
    });
    const empty: AutoSettleResult = { settledCount: 0, settledIds: [], scannedPending: 0, customerCount: 0, skippedNoLedger: 0 };
    if (pastPending.length === 0) return { success: true, ...empty };

    const customerIds = new Set(pastPending.map((r: any) => String(r.CUSTOMER_ID || '').trim()).filter(Boolean));

    // Read the ledger directly — any error stops the whole operation
    const ledger = await fetchAll(
      'mix_DEBIT',
      'ID, DATE, "CUSTOMER ID", DEBIT, CREDIT, "RESIDUAL AMOUNT", MATCHING',
      'ID',
    );
    if (ledger.length === 0) {
      return { success: false, error: 'The Debit ledger is empty or could not be read — nothing was settled.' };
    }

    const relevant = ledger
      .map((r: any) => ({
        customerId: String(r['CUSTOMER ID'] || '').trim(),
        date: r.DATE,
        debit: Number(r.DEBIT) || 0,
        credit: Number(r.CREDIT) || 0,
        residualAmount: r['RESIDUAL AMOUNT'] == null ? null : Number(r['RESIDUAL AMOUNT']),
        matching: r.MATCHING || '',
      }))
      .filter((r) => r.customerId && customerIds.has(r.customerId));

    const customersWithLedger = new Set(relevant.map((r) => r.customerId));
    const openMonthsByCustomer = buildOpenBalanceMonthsByCustomer(relevant);

    const toSettle: string[] = [];
    let skippedNoLedger = 0;
    for (const row of pastPending) {
      const customerId = String(row.CUSTOMER_ID || '').trim();
      if (!customersWithLedger.has(customerId)) {
        skippedNoLedger++;
        continue; // no transactions at all for this ID -> don't guess
      }
      const key = monthKey(Number(row.YEAR), Number(row.MONTH));
      if (openMonthsByCustomer.get(customerId)?.has(key)) continue;
      const id = String(row.ID || '').trim();
      if (id) toSettle.push(id);
    }

    if (apply) {
      for (let i = 0; i < toSettle.length; i += 200) {
        const { error } = await db().from(SETTLEMENTS).update({ STATUS: 'Settled' }).in('ID', toSettle.slice(i, i + 200));
        if (error) throw error;
      }
    }

    return {
      success: true,
      settledCount: toSettle.length,
      settledIds: apply ? toSettle : [],
      scannedPending: pastPending.length,
      customerCount: customerIds.size,
      skippedNoLedger,
    };
  } catch (error) {
    console.error('autoSettleClearedMonths', error);
    return { success: false, error: errMsg(error, 'Failed to auto-settle cleared months.') };
  }
}
