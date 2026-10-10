// ════════════════════════════════════════════════════════════════
//  Secure database gateway for browser code (server only).
//  Browser screens describe a query (table + supabase-style steps) and send
//  it to /api/secure-db; it runs HERE with the server-only key, after checking:
//    • the user is logged in (signed session cookie)
//    • the table is one the website screens are allowed to use
//    • only normal query methods are used
//    • master-data writes follow the Database permissions (edit / delete)
//    • user passwords / secrets are never returned or filtered on
// ════════════════════════════════════════════════════════════════

import { getSessionUser, isAdminUser, type SessionUserRecord } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { hasSalesDataAccess } from '@/lib/supabase';

export type SecureStep = [string, unknown[]];
export type SecureRequest = { table: string; steps: SecureStep[] };
export type SecureResult = {
  data: any;
  error: { message: string; code?: string; details?: string; hint?: string } | null;
  count: number | null;
  status: number;
};

// Tables the browser screens may use through this gateway
const ALLOWED_TABLES = new Set([
  'app_lpos_DRIVERS',
  'app_lpos_ORDERS',
  'bhs_CUSTOMERS',
  'bhs_CUSTOMERS_MAX_ID',
  'bhs_PRODUCTS',
  'bhs_PRODUCTS_MAX_ID',
  'bhs_SUPPLIERS',
  'bhs_USERS',
  'mix_DEBIT',
  'mix_INVENTORY_COUNT_DETAILS',
  'mix_INVENTORY_COUNT_TOTALS',
  'web_CUSTOMERS_DISCOUNTS',
  'web_CUSTOMERS_DISCOUNTS_SETTLEMENTS',
  'web_INVENTORY_ITEM_CODE',
  'web_INVENTORY_LOCATIONS',
  'web_INVENTORY_MOVES',
  'web_SUPPLIERS_ANALYSIS',
  'web_Sales_DB',
  'web_Sales_DB_Cache',
  'web_Suppliers_Purchase',
]);

// Master data managed from the Database screens: writes need Database permissions
const DATABASE_TABLES = new Set([
  'bhs_CUSTOMERS',
  'bhs_PRODUCTS',
  'bhs_SUPPLIERS',
  'mix_DEBIT',
  'web_INVENTORY_ITEM_CODE',
  'web_INVENTORY_LOCATIONS',
  'web_SUPPLIERS_ANALYSIS',
  'web_Sales_DB',
]);

// Tables nobody may change through the gateway
const READ_ONLY_TABLES = new Set(['bhs_USERS', 'bhs_CUSTOMERS_MAX_ID', 'bhs_PRODUCTS_MAX_ID']);

const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);
const ALLOWED_METHODS = new Set([
  'select', 'insert', 'update', 'upsert', 'delete',
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in',
  'contains', 'containedBy', 'overlaps', 'not', 'or', 'filter', 'match', 'textSearch',
  'order', 'range', 'limit', 'single', 'maybeSingle',
]);

const SECRET_COLUMN = /PASS|SECRET|TOKEN/i;

function fail(message: string, status = 400, code?: string): SecureResult {
  return { data: null, error: { message, code }, count: null, status };
}

function parsePerms(user: SessionUserRecord): any | null {
  try {
    return JSON.parse(String(user.role || '').trim() || 'null');
  } catch {
    return null;
  }
}

/** Same rule as the Database screens (usePermissions): database-actions → edit / delete. */
function canWriteDatabase(user: SessionUserRecord, action: 'edit' | 'delete'): boolean {
  if (isAdminUser(user)) return true;
  const perms = parsePerms(user);
  const actions = perms?.['database-actions'];
  if (!Array.isArray(actions)) return false;
  if (action === 'delete') return actions.includes('delete');
  return actions.includes('edit') || actions.includes('delete');
}

/** Full data access flag, or access to the Database module. */
function canSeeAllDebit(user: SessionUserRecord): boolean {
  if (isAdminUser(user) || hasSalesDataAccess({ name: user.name, userAdmin: user.userAdmin, salesDataAccess: user.salesDataAccess })) {
    return true;
  }
  const systems = parsePerms(user)?.systems;
  return Array.isArray(systems) && systems.includes('database');
}

function stripSecrets(value: any): any {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value)) if (!SECRET_COLUMN.test(k)) out[k] = value[k];
    return out;
  }
  return value;
}

function mentionsSecret(steps: SecureStep[]): boolean {
  return steps.some(([, args]) => JSON.stringify(args ?? []).match(SECRET_COLUMN) !== null);
}

export async function runSecureRequest(user: SessionUserRecord, req: SecureRequest): Promise<SecureResult> {
  const table = String(req?.table || '');
  const steps = Array.isArray(req?.steps) ? req.steps : [];

  if (!ALLOWED_TABLES.has(table)) return fail(`Table "${table}" is not available.`, 403, '42501');
  for (const [m] of steps) {
    if (!ALLOWED_METHODS.has(m)) return fail(`Query method "${m}" is not allowed.`, 400);
  }

  const writeStep = steps.find(([m]) => WRITE_METHODS.has(m));
  if (writeStep) {
    if (READ_ONLY_TABLES.has(table)) return fail('This data can only be changed from its own screen.', 403, '42501');
    if (DATABASE_TABLES.has(table)) {
      const action = writeStep[0] === 'delete' ? 'delete' : 'edit';
      if (!canWriteDatabase(user, action)) {
        return fail(`You don't have permission to ${action === 'delete' ? 'delete' : 'change'} this data.`, 403, '42501');
      }
    }
  }

  // Customer debts: only users with full data access or the Database screens
  if (table === 'mix_DEBIT' && !canSeeAllDebit(user)) {
    return fail("You don't have permission to see all customers' balances.", 403, '42501');
  }

  const touchesUsers = table === 'bhs_USERS' || JSON.stringify(steps).includes('bhs_USERS');
  if (touchesUsers && mentionsSecret(steps)) {
    return fail('Not allowed.', 403, '42501');
  }

  let query: any = getSupabaseAdmin().from(table);
  for (const [method, args] of steps) {
    if (typeof query?.[method] !== 'function') return fail(`Query method "${method}" is not available here.`, 400);
    query = query[method](...(Array.isArray(args) ? args : []));
  }

  const res = await query;
  const data = touchesUsers ? stripSecrets(res.data) : res.data;
  return {
    data: data ?? null,
    error: res.error
      ? { message: res.error.message, code: res.error.code, details: res.error.details, hint: res.error.hint }
      : null,
    count: typeof res.count === 'number' ? res.count : null,
    status: res.status ?? (res.error ? 400 : 200),
  };
}
