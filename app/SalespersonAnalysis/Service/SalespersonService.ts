'use server';

// ════════════════════════════════════════════════════════════════
//  Salesperson Analysis — server side
//  • listSalespersons: who can be picked (admins / full data access: everyone;
//    other users: only themselves)
//  • getSalespersonData: the salesperson's sales lines + his share of the
//    customers' ledger (same rules as everywhere else: sales invoice → sub
//    customer's SALES_REP, payments follow MATCHING, the rest split equally)
// ════════════════════════════════════════════════════════════════

import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import { hasFullDebitAccess } from '@/app/CustomersAnalysis/Service/debit_scope';
import type { Period, SalespersonData, SalespersonOption } from '../Utils/Types';
import { loadCustomers, loadUsers } from './DailyReportData';
import { BuildSalespersonData, LoadSalespersonInputs, ResolveSalespersonId } from './SalespersonData';

const norm = (v: unknown) => String(v ?? '').trim().toUpperCase();
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (!hasModuleAccess(user)) throw new UnauthorizedError("You don't have access to Salesperson Analysis.");
  return user;
}

/** Admin Control → 'salesperson-analysis' must be enabled for the user (admins always). */
function hasModuleAccess(user: SessionUserRecord): boolean {
  if (isAdminUser(user, 'salesperson-analysis')) return true;
  try {
    const roleStr = String(user.role || '').trim();
    if (!roleStr || roleStr === 'Admin') return true;
    const perms = JSON.parse(roleStr);
    if (Array.isArray(perms.systems)) return perms.systems.includes('salesperson-analysis');
  } catch {
    // no permissions JSON: open (same default as the other modules)
  }
  return true;
}

/** Same rule as the Sales module: admins always; FULL DATA ACCESS alone does not unlock costs. */
function canSeeCosts(user: SessionUserRecord): boolean {
  if (isAdminUser(user, 'salesperson-analysis')) return true;
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

/** Salespersons that can be picked by the logged-in user. */
export async function ListSalespersons(): Promise<{ canChoose: boolean; salespersons: SalespersonOption[] }> {
  const user = await requireUser();
  const [{ idByKey, nameById }, customers] = await Promise.all([loadUsers(), loadCustomers()]);

  if (!hasFullDebitAccess(user, 'salesperson-analysis')) {
    const id = idByKey.get(norm(user.id)) || norm(user.id);
    return { canChoose: false, salespersons: [{ id, name: nameById.get(id) || user.name }] };
  }

  const options = new Map<string, SalespersonOption>();
  customers.forEach((c) => {
    if (!c.rep) return;
    const id = idByKey.get(c.rep) || c.rep;
    if (!options.has(id)) options.set(id, { id, name: nameById.get(id) || c.rep });
  });
  return {
    canChoose: true,
    salespersons: Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Everything the module needs for one salesperson and one period. */
export async function GetSalespersonData(input: { salespersonId: string; period: Period }): Promise<SalespersonData> {
  const user = await requireUser();
  const { start, end } = input.period || ({} as Period);
  if (!ISO_DAY.test(String(start)) || !ISO_DAY.test(String(end)) || start > end) {
    throw new Error('Invalid period');
  }

  const inputs = await LoadSalespersonInputs();
  const ownId = ResolveSalespersonId(inputs, user.id);
  const targetId = ResolveSalespersonId(inputs, input.salespersonId);
  if (!hasFullDebitAccess(user, 'salesperson-analysis') && targetId !== ownId) {
    throw new UnauthorizedError("You can only see your own analysis.");
  }
  return BuildSalespersonData({ salespersonId: input.salespersonId, period: { start, end }, showCosts: canSeeCosts(user), inputs });
}
