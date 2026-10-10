'use server';

import { getSessionUser, isAdminUser, requireSession, UnauthorizedError } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const DOCS = 'web_CUSTOMERSDOCUMENTS';
const CUSTOMERS = 'bhs_CUSTOMERS';
const SYSTEM_ID = 'customers-documents';
const SYNC_EVERY_MS = 10 * 60 * 1000; // new customers are added at most every 10 minutes

const db = () => getSupabaseAdmin();
const key = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Reads the whole table page by page (Supabase returns max 1000 rows per request). */
async function fetchAll(table: string, columns: string, orderBy: string): Promise<any[]> {
  const out: any[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await db()
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + size - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

async function requireDocumentsAccess() {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (isAdminUser(user)) return user;
  try {
    const perms = JSON.parse(String(user.role || '').trim() || '{}');
    if (Array.isArray(perms?.systems) && !perms.systems.includes(SYSTEM_ID)) {
      throw new UnauthorizedError("You don't have access to Customers Documents.");
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
  }
  return user;
}

/** When a customer has more than one row, show the most recently updated one (then the oldest ID). */
function pickRow(a: any, b: any) {
  const ta = a.UPDATED_AT ? new Date(a.UPDATED_AT).getTime() : 0;
  const tb = b.UPDATED_AT ? new Date(b.UPDATED_AT).getTime() : 0;
  if (ta !== tb) return ta > tb ? a : b;
  return Number(a.ID) <= Number(b.ID) ? a : b;
}

let lastSyncAt = 0;
let syncing: Promise<void> | null = null;

/** Adds customers that exist in bhs_CUSTOMERS but have no documents row yet. */
async function syncCustomersFromBhs(customers: any[], docs: any[]) {
  const existing = new Set(docs.map((d) => key(d.CUSTOMER_ID)));
  const toInsert = new Map<string, any>();
  customers.forEach((c) => {
    const id = String(c['CUSTOMER ID'] ?? '').trim();
    if (!id || existing.has(key(id)) || toInsert.has(key(id))) return;
    toInsert.set(key(id), {
      CUSTOMER_ID: id,
      CREDIT_APP: 'No',
      LICENCE: 'No',
      LICENCE_DATE: '',
      TRN: 'No',
      PASSPORT: 'No',
      ID_CARD: 'No',
      CREDIT_APP_DATE: '',
    });
  });
  const rows = Array.from(toInsert.values());
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().from(DOCS).insert(rows.slice(i, i + 500));
    if (error) throw error;
  }
  return rows.length;
}

export async function getCustomersDocuments() {
  await requireDocumentsAccess();
  try {
    const [customers, firstDocs] = await Promise.all([
      fetchAll(CUSTOMERS, '"CUSTOMER ID", "CUSTOMER MAIN NAME"', 'CUSTOMER ID'),
      fetchAll(DOCS, '*', 'ID'),
    ]);
    let docs = firstDocs;

    // Sync new customers (throttled, and only one sync at a time on this server)
    if (Date.now() - lastSyncAt > SYNC_EVERY_MS && !syncing) {
      syncing = (async () => {
        try {
          const added = await syncCustomersFromBhs(customers, docs);
          lastSyncAt = Date.now();
          if (added > 0) docs = await fetchAll(DOCS, '*', 'ID');
        } catch (err) {
          console.error('Customers documents sync failed:', err);
        }
      })().finally(() => {
        syncing = null;
      });
      await syncing;
    }

    const nameById = new Map<string, string>();
    customers.forEach((c) => {
      const id = String(c['CUSTOMER ID'] ?? '').trim();
      if (id) nameById.set(key(id), c['CUSTOMER MAIN NAME'] || 'Unknown Customer');
    });

    // One row per customer (hides duplicates if any exist in the table)
    const byCustomer = new Map<string, any>();
    docs.forEach((r) => {
      const k = key(r.CUSTOMER_ID);
      if (!k) return;
      const prev = byCustomer.get(k);
      byCustomer.set(k, prev ? pickRow(prev, r) : r);
    });

    const mapped = Array.from(byCustomer.values()).map((r: any) => {
      const idStr = String(r.CUSTOMER_ID ?? '').trim();
      return {
        rowIndex: r.ID,
        customerId: idStr,
        customerName: nameById.get(key(idStr)) || idStr || 'Unknown',
        creditApp: r.CREDIT_APP || 'No',
        creditAppDate: r.CREDIT_APP_DATE || '',
        licence: r.LICENCE || 'No',
        licenceDate: r.LICENCE_DATE || '',
        trn: r.TRN || 'No',
        passport: r.PASSPORT || 'No',
        id: r.ID_CARD || 'No',
      };
    });

    mapped.sort((a, b) => a.customerName.localeCompare(b.customerName));
    return { success: true, data: mapped };
  } catch (error: any) {
    console.error('Error in customers-documents GET Service:', error);
    if (String(error?.message || '').includes('does not exist')) {
      return {
        success: false,
        error: 'Table web_CUSTOMERSDOCUMENTS does not exist. Please create the table in Supabase first.',
        needsTableCreation: true,
      };
    }
    return { success: false, error: error?.message || 'Failed to load customer documents' };
  }
}

export async function updateCustomerDocument(rowIndex: number | string, data: any) {
  await requireSession();
  try {
    await requireDocumentsAccess();
    if (!rowIndex) {
      return { success: false, error: 'rowIndex (ID) is required' };
    }

    const updateFields: Record<string, unknown> = {};
    if (data.creditApp !== undefined) updateFields.CREDIT_APP = data.creditApp;
    if (data.creditAppDate !== undefined) updateFields.CREDIT_APP_DATE = data.creditAppDate;
    if (data.licence !== undefined) updateFields.LICENCE = data.licence;
    if (data.licenceDate !== undefined) updateFields.LICENCE_DATE = data.licenceDate;
    if (data.trn !== undefined) updateFields.TRN = data.trn;
    if (data.passport !== undefined) updateFields.PASSPORT = data.passport;
    if (data.id !== undefined) updateFields.ID_CARD = data.id;
    if (Object.keys(updateFields).length === 0) return { success: false, error: 'Nothing to update' };

    updateFields.UPDATED_AT = new Date().toISOString();

    const { data: result, error } = await db().from(DOCS).update(updateFields).eq('ID', rowIndex).select();
    if (error) throw error;
    if (!result || result.length === 0) return { success: false, error: 'Record not found — refresh and try again.' };

    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error in customers-documents update Service:', error);
    return { success: false, error: error?.message || 'Failed to save' };
  }
}
