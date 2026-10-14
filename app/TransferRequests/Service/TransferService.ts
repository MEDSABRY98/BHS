'use server';

// Transfer Requests (Al Ain ↔ Dubai + internal transfers)
// Tables: web_TRANSFER_REQUESTS, web_TRANSFER_BENEFICIARIES, web_TRANSFER_BANKS (RLS on, no public access)
// Each user sees only his own requests; the admin sees all.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import {
  CURRENCIES,
  TRANSFER_SYSTEM_ID,
  cleanIban,
  cleanText,
  round2,
  type TransferBank,
  type TransferBeneficiary,
  type TransferPermissions,
  type TransferRequest,
  type TransferRequestInput,
  type TransferTabId,
  type TransferType,
} from '../Utils/TransferTypes';

const REQUESTS = 'web_TRANSFER_REQUESTS';
const BENEFICIARIES = 'web_TRANSFER_BENEFICIARIES';
const BANKS = 'web_TRANSFER_BANKS';
const ALL_TABS: TransferTabId[] = ['new', 'requests', 'beneficiaries'];
const TYPES: TransferType[] = ['INTERNAL', 'AIN_TO_DUBAI', 'DUBAI_TO_AIN'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────
//  Permissions (Admin Control → 'transfer-requests', tabs: new / requests / beneficiaries)
// ─────────────────────────────────────────────────────────────
function permissionsOf(user: SessionUserRecord): TransferPermissions {
  const admin = isAdminUser(user);
  if (admin) return { tabs: [...ALL_TABS], viewAll: true };

  const raw = String(user.role || '').trim();
  if (!raw || raw === 'Admin') return { tabs: [...ALL_TABS], viewAll: raw === 'Admin' };

  let perms: Record<string, unknown>;
  try {
    perms = JSON.parse(raw);
  } catch {
    return { tabs: [...ALL_TABS], viewAll: false };
  }
  if (Array.isArray(perms.systems) && !perms.systems.includes(TRANSFER_SYSTEM_ID)) return { tabs: [], viewAll: false };
  const list = perms[TRANSFER_SYSTEM_ID];
  const tabs = Array.isArray(list) ? ALL_TABS.filter((t) => list.includes(t)) : [...ALL_TABS];
  return { tabs, viewAll: false };
}

async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return user;
}

async function requireTab(...anyOf: TransferTabId[]): Promise<{ user: SessionUserRecord; perms: TransferPermissions }> {
  const user = await requireUser();
  const perms = permissionsOf(user);
  if (!anyOf.some((t) => perms.tabs.includes(t))) throw new UnauthorizedError("You don't have permission for this action.");
  return { user, perms };
}

function requireUuid(id: unknown, what = 'ID'): string {
  const v = String(id || '').trim();
  if (!UUID_RE.test(v)) throw new Error(`Invalid ${what}`);
  return v;
}

function uaeToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function friendly(error: { code?: string; message: string }, duplicate: string): Error {
  if (error.code === '23505') return new Error(duplicate);
  if (error.code === '23503') return new Error('This record is used by other records and can\'t be deleted — set it to inactive instead');
  return new Error(error.message);
}

async function fetchAll(table: string, build: (q: any) => any = (q) => q): Promise<any[]> {
  const db = getSupabaseAdmin();
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(db.from(table).select('*')).order('ID', { ascending: true }).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function normalizeBank(r: any): TransferBank {
  return { ID: r.ID, NAME: r.NAME, SWIFT_CODE: r.SWIFT_CODE || null, IS_ACTIVE: r.IS_ACTIVE !== false };
}

function normalizeBeneficiary(r: any): TransferBeneficiary {
  return {
    ID: r.ID,
    NAME: r.NAME,
    BANK_ID: r.BANK_ID || null,
    IBAN: r.IBAN || null,
    ACCOUNT_NO: r.ACCOUNT_NO || null,
    NOTES: r.NOTES || null,
    IS_ACTIVE: r.IS_ACTIVE !== false,
  };
}

function normalizeRequest(r: any, names: Map<string, string>): TransferRequest {
  return {
    ID: r.ID,
    REQUEST_NO: r.REQUEST_NO,
    REQUEST_DATE: String(r.REQUEST_DATE || '').slice(0, 10),
    TRANSFER_TYPE: r.TRANSFER_TYPE,
    BANK_ID: r.BANK_ID || null,
    BENEFICIARY_ID: r.BENEFICIARY_ID,
    AMOUNT: Number(r.AMOUNT) || 0,
    CURRENCY: r.CURRENCY || 'AED',
    REASON: r.REASON || '',
    CREATED_BY: r.CREATED_BY,
    CREATED_BY_NAME: names.get(String(r.CREATED_BY)) || null,
    CREATED_AT: r.CREATED_AT,
    UPDATED_AT: r.UPDATED_AT,
  };
}

async function userNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return names;
  const { data } = await getSupabaseAdmin().from('bhs_USERS').select('ID, NAME').in('ID', unique);
  for (const u of data || []) names.set(String(u.ID), String(u.NAME || ''));
  return names;
}

// ─────────────────────────────────────────────────────────────
//  Load everything the page needs
// ─────────────────────────────────────────────────────────────
export async function getTransferPermissions(): Promise<TransferPermissions> {
  return permissionsOf(await requireUser());
}

export async function loadTransferData(): Promise<{
  requests: TransferRequest[];
  beneficiaries: TransferBeneficiary[];
  banks: TransferBank[];
  currentUserId: string;
}> {
  const { user, perms } = await requireTab(...ALL_TABS);
  const [rows, beneficiaries, banks] = await Promise.all([
    perms.tabs.includes('requests') ? fetchAll(REQUESTS, (q) => (perms.viewAll ? q : q.eq('CREATED_BY', user.id))) : Promise.resolve([]),
    fetchAll(BENEFICIARIES),
    fetchAll(BANKS),
  ]);
  const names = await userNames(rows.map((r) => r.CREATED_BY));
  const requests = rows
    .map((r) => normalizeRequest(r, names))
    .sort((a, b) => (a.REQUEST_DATE !== b.REQUEST_DATE ? (a.REQUEST_DATE < b.REQUEST_DATE ? 1 : -1) : a.CREATED_AT < b.CREATED_AT ? 1 : -1));
  return {
    requests,
    beneficiaries: beneficiaries.map(normalizeBeneficiary).sort((a, b) => a.NAME.localeCompare(b.NAME)),
    banks: banks.map(normalizeBank).sort((a, b) => a.NAME.localeCompare(b.NAME)),
    currentUserId: user.id,
  };
}

// ─────────────────────────────────────────────────────────────
//  Requests
// ─────────────────────────────────────────────────────────────
export async function saveTransferRequest(input: TransferRequestInput): Promise<TransferRequest> {
  const { user, perms } = await requireTab('new');
  const db = getSupabaseAdmin();

  const type = input?.TRANSFER_TYPE;
  if (!TYPES.includes(type)) throw new Error('Choose the transfer type');
  const beneficiaryId = requireUuid(input?.BENEFICIARY_ID, 'beneficiary');
  const bankId = type === 'INTERNAL' ? requireUuid(input?.BANK_ID, 'bank') : null;
  const amount = round2(Number(input?.AMOUNT));
  if (!(amount > 0)) throw new Error('Amount must be greater than zero');
  const currency = CURRENCIES.some((c) => c.code === input?.CURRENCY) ? input.CURRENCY : 'AED';
  const reason = cleanText(input?.REASON);
  if (!reason) throw new Error('Reason for the transfer is required');

  const record = {
    TRANSFER_TYPE: type,
    BANK_ID: bankId,
    BENEFICIARY_ID: beneficiaryId,
    AMOUNT: amount,
    CURRENCY: currency,
    REASON: reason,
  };

  let saved: any;
  if (input.ID) {
    const id = requireUuid(input.ID);
    const { data: existing, error: findErr } = await db.from(REQUESTS).select('ID, CREATED_BY, TRANSFER_TYPE').eq('ID', id).maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!existing) throw new Error('This request no longer exists');
    if (!perms.viewAll && existing.CREATED_BY !== user.id) throw new UnauthorizedError('You can only edit your own requests');
    if ((existing.TRANSFER_TYPE === 'INTERNAL') !== (type === 'INTERNAL')) {
      throw new Error("An internal request can't be changed to Al Ain / Dubai (or the opposite) — create a new request");
    }
    const { data, error } = await db.from(REQUESTS).update(record).eq('ID', id).select('*').single();
    if (error) throw new Error(error.message);
    saved = data;
  } else {
    // the date is always today's date (UAE time), set by the server
    const { data, error } = await db.from(REQUESTS).insert({ ...record, REQUEST_DATE: uaeToday(), CREATED_BY: user.id }).select('*').single();
    if (error) throw new Error(error.message);
    saved = data;
  }
  return normalizeRequest(saved, await userNames([saved.CREATED_BY]));
}

export async function deleteTransferRequest(id: string): Promise<{ success: true }> {
  const { user, perms } = await requireTab('requests');
  const reqId = requireUuid(id);
  const db = getSupabaseAdmin();
  const { data: existing, error } = await db.from(REQUESTS).select('CREATED_BY').eq('ID', reqId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!existing) return { success: true };
  if (!perms.viewAll && existing.CREATED_BY !== user.id) throw new UnauthorizedError('You can only delete your own requests');
  const { error: delErr } = await db.from(REQUESTS).delete().eq('ID', reqId);
  if (delErr) throw new Error(delErr.message);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────
//  Banks  (create: New Request or Beneficiaries tab · edit / delete: Beneficiaries tab)
// ─────────────────────────────────────────────────────────────
export async function saveTransferBank(input: { ID?: string; NAME: string; SWIFT_CODE?: string | null; IS_ACTIVE?: boolean }): Promise<TransferBank> {
  const { user } = input?.ID ? await requireTab('beneficiaries') : await requireTab('new', 'beneficiaries');
  const name = cleanText(input?.NAME);
  if (!name) throw new Error('Bank name is required');
  const record = {
    NAME: name,
    SWIFT_CODE: cleanText(input?.SWIFT_CODE).toUpperCase() || null,
    IS_ACTIVE: input?.IS_ACTIVE !== false,
  };
  const db = getSupabaseAdmin();
  const query = input?.ID
    ? db.from(BANKS).update(record).eq('ID', requireUuid(input.ID))
    : db.from(BANKS).insert({ ...record, CREATED_BY: user.id });
  const { data, error } = await query.select('*').single();
  if (error) throw friendly(error, `The bank "${name}" already exists`);
  return normalizeBank(data);
}

export async function deleteTransferBank(id: string): Promise<{ success: true }> {
  await requireTab('beneficiaries');
  const { error } = await getSupabaseAdmin().from(BANKS).delete().eq('ID', requireUuid(id));
  if (error) throw friendly(error, '');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────
//  Beneficiaries  (create: New Request or Beneficiaries tab · edit / delete: Beneficiaries tab)
// ─────────────────────────────────────────────────────────────
export async function saveTransferBeneficiary(input: {
  ID?: string;
  NAME: string;
  BANK_ID: string | null;
  IBAN?: string | null;
  ACCOUNT_NO?: string | null;
  NOTES?: string | null;
  IS_ACTIVE?: boolean;
}): Promise<TransferBeneficiary> {
  const { user } = input?.ID ? await requireTab('beneficiaries') : await requireTab('new', 'beneficiaries');
  const name = cleanText(input?.NAME);
  if (!name) throw new Error('Beneficiary name is required');
  const iban = cleanIban(input?.IBAN) || null;
  const accountNo = cleanText(input?.ACCOUNT_NO) || null;
  if (!iban && !accountNo) throw new Error('Enter the IBAN or the account number');
  if (iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(iban)) throw new Error('The IBAN doesn\'t look right (e.g. AE07 0331 2345 6789 0123 456)');

  const record = {
    NAME: name,
    BANK_ID: input?.BANK_ID ? requireUuid(input.BANK_ID, 'bank') : null,
    IBAN: iban,
    ACCOUNT_NO: accountNo,
    NOTES: cleanText(input?.NOTES) || null,
    IS_ACTIVE: input?.IS_ACTIVE !== false,
  };
  const db = getSupabaseAdmin();
  const query = input?.ID
    ? db.from(BENEFICIARIES).update(record).eq('ID', requireUuid(input.ID))
    : db.from(BENEFICIARIES).insert({ ...record, CREATED_BY: user.id });
  const { data, error } = await query.select('*').single();
  if (error) throw friendly(error, 'This IBAN is already saved for another beneficiary');
  return normalizeBeneficiary(data);
}

export async function deleteTransferBeneficiary(id: string): Promise<{ success: true }> {
  await requireTab('beneficiaries');
  const { error } = await getSupabaseAdmin().from(BENEFICIARIES).delete().eq('ID', requireUuid(id));
  if (error) throw friendly(error, '');
  return { success: true };
}
