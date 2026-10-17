'use server';

// ════════════════════════════════════════════════════════════════
//  ROI — server side
//  • supports (commission given to a customer in a month) live in web_ROI
//  • the analysis numbers come from the real sales data (same cache as Sales)
// ════════════════════════════════════════════════════════════════

import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSalesDataServer } from '@/app/Sales/Cache/SalesCache';
import { hasFullDebitAccess } from '@/app/CustomersAnalysis/Service/debit_scope';
import { SalesWindow } from '../Utils/RoiCalc';
import type { CustomerOption, RoiData, RoiLine, SalespersonOption, SupportInput, SupportRecord } from '../Utils/Types';

const TABLE = 'web_ROI';
const SYSTEM_ID = 'roi';

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

const db = () => getSupabaseAdmin();
const norm = (v: unknown) => String(v ?? '').trim().toUpperCase();
const dayOf = (v: unknown) => String(v ?? '').split('T')[0].trim();
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function errMsg(error: unknown, fallback: string): string {
  const m = (error as { message?: string })?.message;
  if (m && /(web_ROI|SALESPERSON_ID)/.test(m) && /(does not exist|schema cache|relation|column)/i.test(m)) {
    return 'The ROI table is missing or outdated. Run ROI/sql/roi_tables.sql in Supabase first.';
  }
  return m || fallback;
}

/** Admin Control -> 'roi' must be enabled for the user (admins always). */
async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (isAdminUser(user)) return user;
  try {
    const roleStr = String(user.role || '').trim();
    if (!roleStr || roleStr === 'Admin') return user;
    const perms = JSON.parse(roleStr);
    if (Array.isArray(perms.systems) && !perms.systems.includes(SYSTEM_ID)) {
      throw new UnauthorizedError("You don't have access to ROI.");
    }
  } catch (e) {
    if (e instanceof UnauthorizedError) throw e;
    // unparsable role -> open (same default as the other modules)
  }
  return user;
}

/** Same rule as the Sales module: admins always; FULL DATA ACCESS alone does not unlock costs. */
function canSeeCosts(user: SessionUserRecord): boolean {
  if (isAdminUser(user)) return true;
  try {
    const roleStr = String(user.role || '').trim();
    if (!roleStr || roleStr === 'Admin') return true;
    const perms = JSON.parse(roleStr);
    if (perms['sales-actions'] !== undefined) {
      return Array.isArray(perms['sales-actions']) && perms['sales-actions'].includes('view-costs');
    }
  } catch {
    // default: visible
  }
  return true;
}

type CustomerRow = CustomerOption & { rep: string };

/** ID or NAME of a salesperson -> his ID, plus ID -> NAME (bhs_USERS, same as Salesperson Analysis). */
async function loadUsers() {
  const { data, error } = await db().from('bhs_USERS').select('ID, NAME');
  if (error) throw error;
  const idByKey = new Map<string, string>();
  const nameById = new Map<string, string>();
  for (const u of (data || []) as any[]) {
    const id = norm(u.ID);
    if (!id) continue;
    const name = String(u.NAME || '').trim();
    idByKey.set(id, id);
    if (name) idByKey.set(norm(name), id);
    nameById.set(id, name || id);
  }
  return { idByKey, nameById };
}

async function loadCustomers(): Promise<Map<string, CustomerRow>> {
  const map = new Map<string, CustomerRow>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db()
      .from('bhs_CUSTOMERS')
      .select('"CUSTOMER ID", "CUSTOMER SUB NAME", "CUSTOMER MAIN NAME", "CUSTOMER CITY", "SALES_REP"')
      .order('CUSTOMER ID', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const r of (data || []) as any[]) {
      const id = String(r['CUSTOMER ID'] ?? '').trim();
      if (!id) continue;
      map.set(norm(id), {
        id,
        name: String(r['CUSTOMER SUB NAME'] || r['CUSTOMER MAIN NAME'] || id).trim(),
        mainName: String(r['CUSTOMER MAIN NAME'] || r['CUSTOMER SUB NAME'] || id).trim(),
        city: String(r['CUSTOMER CITY'] || '').trim(),
        rep: norm(r['SALES_REP']),
        salespersonId: norm(r['SALES_REP']),
      });
    }
    if (!data || data.length < pageSize) break;
  }
  return map;
}

/** Customers the user is allowed to see: everyone for full-access users, own customers otherwise. */
function visibleCustomers(user: SessionUserRecord, all: Map<string, CustomerRow>): Map<string, CustomerRow> {
  if (hasFullDebitAccess(user)) return all;
  const mine = new Set([norm(user.id), norm(user.name)].filter(Boolean));
  const out = new Map<string, CustomerRow>();
  all.forEach((c, k) => {
    if (mine.has(c.rep)) out.set(k, c);
  });
  return out;
}

async function nextNumber(): Promise<number> {
  const data = await fetchAllRows('ID', 'ID');
  const max = data.reduce((acc, r) => {
    const m = String(r.ID || '').match(/^ROI-(\d+)$/i);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return max + 1;
}

async function nextId(): Promise<string> {
  return `ROI-${String(await nextNumber()).padStart(4, '0')}`;
}

/** Reads a whole table page by page (Supabase returns at most 1000 rows per request). */
async function fetchAllRows(select: string, order: string): Promise<any[]> {
  const pageSize = 1000;
  const out: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db().from(TABLE).select(select).order(order, { ascending: true }).range(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...((data || []) as any[]));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

function validate(input: SupportInput): string | null {
  if (!String(input.customerId || '').trim()) return 'Please select a customer.';
  if (!MONTH.test(String(input.month || ''))) return 'Please choose the support month.';
  if (!(Number(input.amount) > 0)) return 'Please enter a valid support amount.';
  return null;
}

// ─────────────────────────────────────────────────────────────
//  Reads
// ─────────────────────────────────────────────────────────────
export async function GetRoiData(): Promise<RoiData> {
  const user = await requireUser();
  const [allCustomers, { idByKey, nameById }] = await Promise.all([loadCustomers(), loadUsers()]);
  const customers = visibleCustomers(user, allCustomers);

  let rowsAll: any[];
  try {
    rowsAll = await fetchAllRows('*', 'ID');
  } catch (e) {
    throw new Error(errMsg(e, 'Failed to load the supports'));
  }

  const supports: SupportRecord[] = [];
  for (const r of rowsAll) {
    const c = customers.get(norm(r.CUSTOMER_ID));
    if (!c) continue;
    // his own SALESPERSON_ID, or (older rows) the customer's current SALES_REP
    const spId = idByKey.get(norm(r.SALESPERSON_ID || c.rep)) || norm(r.SALESPERSON_ID || c.rep);
    supports.push({
      id: String(r.ID),
      customerId: c.id,
      customerName: c.name,
      salespersonId: spId,
      salespersonName: nameById.get(spId) || spId || 'Unassigned',
      mainName: c.mainName,
      city: c.city,
      month: String(r.SUPPORT_MONTH),
      amount: Number(r.SUPPORT_AMOUNT) || 0,
      notes: String(r.NOTES || ''),
    });
  }

  const wanted = new Set(supports.map((s) => norm(s.customerId)));
  const sales: RoiLine[] = [];
  const lastSale: Record<string, string> = {};
  // sales: always the last 3 full months (not the support month, not the current month)
  const win = SalesWindow();
  if (wanted.size) {
    const from = `${win[0]}-01`;
    const to = `${win[win.length - 1]}-31`;
    const showCosts = canSeeCosts(user);
    const salesAll = (await getSalesDataServer()) as any[];
    for (const s of salesAll) {
      if (!wanted.has(norm(s.customerId))) continue;
      const date = dayOf(s.invoiceDate);
      if (!date) continue;
      const cust = customers.get(norm(s.customerId));
      if ((Number(s.amount) || 0) > 0 && cust && date > (lastSale[cust.id] || '')) lastSale[cust.id] = date;
      if (date < from || date > to) continue;
      sales.push({
        date,
        invoice: String(s.invoiceNumber ?? '').trim(),
        customerId: cust ? cust.id : String(s.customerId),
        productId: String(s.productId ?? '').trim(),
        amount: Number(s.amount) || 0,
        qty: Number(s.qty) || 0,
        cost: showCosts ? Number(s.productCost) || 0 : 0,
      });
    }
  }

  return { supports, sales, showCosts: canSeeCosts(user), window: win, lastSale };
}

/** Customers + salespersons for the "add customer" form. */
export async function ListCustomerOptions(): Promise<{ customers: CustomerOption[]; salespersons: SalespersonOption[] }> {
  const user = await requireUser();
  const [allCustomers, { idByKey, nameById }] = await Promise.all([loadCustomers(), loadUsers()]);
  const customers = visibleCustomers(user, allCustomers);
  const spMap = new Map<string, SalespersonOption>();
  const list: CustomerOption[] = [];
  customers.forEach((c) => {
    const spId = idByKey.get(c.rep) || c.rep;
    if (spId && !spMap.has(spId)) spMap.set(spId, { id: spId, name: nameById.get(spId) || spId });
    list.push({ id: c.id, name: c.name, mainName: c.mainName, city: c.city, salespersonId: spId });
  });
  // everyone who can be chosen as the salesperson of a support (any user is allowed for full-access users)
  if (hasFullDebitAccess(user)) nameById.forEach((name, id) => spMap.set(id, { id, name }));
  return {
    customers: list.sort((a, b) => a.name.localeCompare(b.name)),
    salespersons: Array.from(spMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ─────────────────────────────────────────────────────────────
//  Writes
// ─────────────────────────────────────────────────────────────
async function assertCustomerAllowed(user: SessionUserRecord, customerId: string) {
  const customers = visibleCustomers(user, await loadCustomers());
  const c = customers.get(norm(customerId));
  if (!c) throw new UnauthorizedError("You can't add support for this customer.");
  return c;
}

/** The chosen salesperson (ID or name) -> his bhs_USERS ID; falls back to the customer's SALES_REP. */
async function resolveSalesperson(chosen: string, customer: CustomerRow): Promise<string> {
  const { idByKey } = await loadUsers();
  const key = norm(chosen || customer.rep);
  return idByKey.get(key) || key;
}

export async function AddSupport(input: SupportInput): Promise<Result<{ id: string }>> {
  try {
    const user = await requireUser();
    const bad = validate(input);
    if (bad) return { success: false, error: bad };
    const customer = await assertCustomerAllowed(user, input.customerId);

    let id = '';
    for (let attempt = 0; attempt < 5 && !id; attempt++) {
      const candidate = await nextId();
      const { error } = await db().from(TABLE).insert({
        ID: candidate,
        CUSTOMER_ID: customer.id,
        SALESPERSON_ID: await resolveSalesperson(input.salespersonId, customer),
        SUPPORT_MONTH: input.month,
        SUPPORT_AMOUNT: Number(input.amount),
        NOTES: String(input.notes || '').trim(),
        CREATED_BY: String(user.id || user.name || ''),
      });
      if (!error) id = candidate;
      else if (error.code !== '23505') throw error;
    }
    if (!id) return { success: false, error: 'Could not reserve a number, please try again.' };
    return { success: true, id };
  } catch (error) {
    console.error('AddSupport', error);
    return { success: false, error: errMsg(error, 'An error occurred while saving.') };
  }
}

/** Adds several supports at once (the Overview rows). All rows are validated first; nothing is saved if one is wrong. */
export async function AddSupports(inputs: SupportInput[]): Promise<Result<{ count: number }>> {
  try {
    const user = await requireUser();
    if (!Array.isArray(inputs) || inputs.length === 0) return { success: false, error: 'Add at least one customer.' };
    if (inputs.length > 200) return { success: false, error: 'Too many rows at once (max 200).' };
    for (let i = 0; i < inputs.length; i++) {
      const bad = validate(inputs[i]);
      if (bad) return { success: false, error: `Row ${i + 1}: ${bad}` };
    }

    const [allCustomers, { idByKey }] = await Promise.all([loadCustomers(), loadUsers()]);
    const customers = visibleCustomers(user, allCustomers);
    const rows = inputs.map((input, i) => {
      const c = customers.get(norm(input.customerId));
      if (!c) throw new UnauthorizedError(`Row ${i + 1}: you can't add support for this customer.`);
      const key = norm(input.salespersonId || c.rep);
      return {
        CUSTOMER_ID: c.id,
        SALESPERSON_ID: idByKey.get(key) || key,
        SUPPORT_MONTH: input.month,
        SUPPORT_AMOUNT: Number(input.amount),
        NOTES: String(input.notes || '').trim(),
        CREATED_BY: String(user.id || user.name || ''),
      };
    });

    // reserve consecutive ROI-xxxx numbers (retry if another user took them at the same moment)
    for (let attempt = 0; attempt < 5; attempt++) {
      const first = await nextNumber();
      const withIds = rows.map((r, i) => ({ ID: `ROI-${String(first + i).padStart(4, '0')}`, ...r }));
      const { error } = await db().from(TABLE).insert(withIds);
      if (!error) return { success: true, count: withIds.length };
      if (error.code !== '23505') throw error;
    }
    return { success: false, error: 'Could not reserve numbers, please try again.' };
  } catch (error) {
    console.error('AddSupports', error);
    return { success: false, error: errMsg(error, 'An error occurred while saving.') };
  }
}

export async function UpdateSupport(id: string, input: SupportInput): Promise<Result> {
  try {
    const user = await requireUser();
    const bad = validate(input);
    if (bad) return { success: false, error: bad };
    const customer = await assertCustomerAllowed(user, input.customerId);
    // the entry being edited must also belong to a customer this user may see
    const { data: existing, error: readErr } = await db().from(TABLE).select('CUSTOMER_ID').eq('ID', id).maybeSingle();
    if (readErr) throw readErr;
    if (!existing) return { success: false, error: 'Support not found.' };
    await assertCustomerAllowed(user, String((existing as any).CUSTOMER_ID));
    const { error } = await db()
      .from(TABLE)
      .update({
        CUSTOMER_ID: customer.id,
        SALESPERSON_ID: await resolveSalesperson(input.salespersonId, customer),
        SUPPORT_MONTH: input.month,
        SUPPORT_AMOUNT: Number(input.amount),
        NOTES: String(input.notes || '').trim(),
      })
      .eq('ID', id);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('UpdateSupport', error);
    return { success: false, error: errMsg(error, 'An error occurred while saving.') };
  }
}

export async function DeleteSupport(id: string): Promise<Result> {
  try {
    const user = await requireUser();
    const { data, error: readErr } = await db().from(TABLE).select('CUSTOMER_ID').eq('ID', id).maybeSingle();
    if (readErr) throw readErr;
    if (!data) return { success: false, error: 'Support not found.' };
    await assertCustomerAllowed(user, String((data as any).CUSTOMER_ID));
    const { error } = await db().from(TABLE).delete().eq('ID', id);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('DeleteSupport', error);
    return { success: false, error: errMsg(error, 'An error occurred while deleting.') };
  }
}
