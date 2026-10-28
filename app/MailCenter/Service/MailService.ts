'use server';

// Mail Center — server actions.
// Tables (RLS on, only reachable through these actions):
//   web_MAIL_SETTINGS   the Zoho connection of the finance mailbox (Server/MailZoho.ts)
//   web_MAIL_TEMPLATES  ready emails (subject, body, attachment settings) shared by everyone with the tab
//   web_MAIL_LOG        every email sent (or failed): each user sees his own, the admin sees all
// Permissions: Admin Control → 'mail-center' (compose / bulk / templates / sent); settings = admin only.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import { resolveCustomerEmailTargets, splitEmails as splitStoredEmails, getAllCustomerEmailsStrict, getLuluEmailsStrict } from '@/lib/supabase';
import { buildAttachment, ledgerFor, type MailFile } from '../Server/Attachments';
import { connectMailbox, disconnectMailbox, getMailConnection, mailClientReady, mailProblem, mailScopes, sendFromMailbox } from '../Server/MailZoho';
import {
  DEFAULT_BODY,
  EMAIL_RE,
  MAIL_PERMISSION_TABS,
  MAIL_SYSTEM_ID,
  bodyToHtml,
  renderVariables,
  resolveDateMode,
  formatDate,
  uaeToday,
  type AttachmentFormat,
  type AttachmentSpec,
  type StatementScope,
  type MailCustomer,
  type MailDraft,
  type MailLogRow,
  type MailPermissions,
  type MailStatus,
  type ActionResult,
  type MailSupplier,
  type MailTabId,
  type MailTemplate,
  type TemplateAttachment,
} from '../Utils/MailTypes';

const TEMPLATES = 'web_MAIL_TEMPLATES';
const LOG = 'web_MAIL_LOG';
const MAX_RECIPIENTS = 50;
const MAX_ATTACHMENTS = 10;

// ─────────────────────────────────────────────────────────────
//  Permissions
// ─────────────────────────────────────────────────────────────
async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return user;
}

function rolePerms(user: SessionUserRecord): Record<string, unknown> | null {
  const raw = String(user.role || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function permissionsOf(user: SessionUserRecord): MailPermissions {
  if (isAdminUser(user, MAIL_SYSTEM_ID)) return { tabs: [...MAIL_PERMISSION_TABS, 'settings'], admin: true };
  const perms = rolePerms(user);
  if (!perms) return { tabs: [...MAIL_PERMISSION_TABS], admin: false };
  if (Array.isArray(perms.systems) && !perms.systems.includes(MAIL_SYSTEM_ID)) return { tabs: [], admin: false };
  const list = perms[MAIL_SYSTEM_ID];
  return { tabs: Array.isArray(list) ? MAIL_PERMISSION_TABS.filter((t) => list.includes(t)) : [...MAIL_PERMISSION_TABS], admin: false };
}

/** the user can open that module (attachments come from it); Customers Analysis is granted as 'debit' */
function moduleAllowed(user: SessionUserRecord, systemId: 'customers-analysis' | 'suppliers-analysis'): boolean {
  const ids = systemId === 'customers-analysis' ? ['debit', 'customers-analysis'] : [systemId];
  if (ids.some((id) => isAdminUser(user, id))) return true;
  const perms = rolePerms(user);
  return !perms || !Array.isArray(perms.systems) || ids.some((id) => (perms.systems as unknown[]).includes(id));
}

async function requireTab(...tabs: MailTabId[]) {
  const user = await requireUser();
  const perms = permissionsOf(user);
  if (!tabs.some((t) => perms.tabs.includes(t))) throw new UnauthorizedError("You don't have permission for this action.");
  return { user, perms };
}

function checkAttachmentAccess(user: SessionUserRecord, spec: AttachmentSpec) {
  if ((spec.kind === 'customer-statement' || spec.kind === 'group-statement') && !moduleAllowed(user, 'customers-analysis'))
    throw new UnauthorizedError("You don't have access to Customers Analysis.");
  if (spec.kind === 'supplier-statement' && !moduleAllowed(user, 'suppliers-analysis'))
    throw new UnauthorizedError("You don't have access to Suppliers Analysis.");
}

export async function getMailPermissions(): Promise<MailPermissions> {
  return permissionsOf(await requireUser());
}

// ─────────────────────────────────────────────────────────────
//  Mailbox (Settings — admin)
// ─────────────────────────────────────────────────────────────
export async function getMailStatus(): Promise<MailStatus> {
  await requireUser();
  const conn = await getMailConnection();
  return { connected: !!conn, from: conn?.fromEmail || null, clientReady: mailClientReady(), scopes: mailScopes(), problem: await mailProblem() };
}

async function connectMailImpl(code: string): Promise<MailStatus> {
  const { user, perms } = await requireTab('settings');
  if (!perms.admin) throw new UnauthorizedError('Only the admin can connect the mailbox.');
  if (!String(code || '').trim()) throw new Error('Paste the code from Zoho first');
  await connectMailbox(String(code), user.name);
  return getMailStatus();
}

async function disconnectMailImpl(): Promise<MailStatus> {
  const { perms } = await requireTab('settings');
  if (!perms.admin) throw new UnauthorizedError('Only the admin can disconnect the mailbox.');
  await disconnectMailbox();
  return getMailStatus();
}

async function asResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || 'Something went wrong') };
  }
}

export async function connectMail(code: string): Promise<ActionResult<MailStatus>> {
  return asResult(() => connectMailImpl(code));
}

export async function disconnectMail(): Promise<ActionResult<MailStatus>> {
  return asResult(() => disconnectMailImpl());
}

export async function sendMailDraft(draft: MailDraft): Promise<ActionResult<MailLogRow>> {
  return asResult(() => sendMailDraftImpl(draft));
}

// ─────────────────────────────────────────────────────────────
//  Lists for the pickers
// ─────────────────────────────────────────────────────────────
/** Customers the user may see, with their saved emails and balance. */
export async function listMailCustomers(): Promise<MailCustomer[]> {
  const { user } = await requireTab('compose', 'statements', 'bulk');
  if (!moduleAllowed(user, 'customers-analysis')) return [];
  const rows = await ledgerFor(user);
  const map = new Map<string, MailCustomer>();
  for (const r of rows) {
    const name = String(r.customerName || '').trim();
    if (!name) continue;
    const c = map.get(name) || { name, id: String(r.customerId || '').trim(), tag: String(r.customerTag || '').trim(), emails: [], balance: 0, lulu: false, cc: [] };
    if (!c.id && r.customerId) c.id = String(r.customerId).trim();
    c.balance += (Number(r.debit) || 0) - (Number(r.credit) || 0);
    map.set(name, c);
  }
  let emails: { customerId: string; email: string }[] = [];
  try {
    emails = await getAllCustomerEmailsStrict();
  } catch {
    emails = [];
  }
  const byId = new Map(emails.map((e) => [String(e.customerId).trim().toLowerCase(), e.email]));
  const lulu = await luluMap();
  return Array.from(map.values())
    .map((c) => {
      const l = lulu.get(c.id.toLowerCase()) || lulu.get(c.name.toLowerCase());
      return {
        ...c,
        balance: Math.round(c.balance * 100) / 100,
        lulu: !!l,
        emails: l ? l.to : splitStoredEmails(byId.get(c.id.toLowerCase()) || byId.get(c.name.toLowerCase()) || ''),
        cc: l ? l.cc.filter((e) => !l.to.includes(e)) : [],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

export async function listMailSuppliers(): Promise<MailSupplier[]> {
  const { user } = await requireTab('compose', 'bulk');
  if (!moduleAllowed(user, 'suppliers-analysis')) return [];
  const out: MailSupplier[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await getSupabaseAdmin().from('bhs_SUPPLIERS').select('"SUPPLIER ID", "SUPPLIER NAME"').order('SUPPLIER ID').range(from, from + 999);
    if (error) throw new Error(error.message);
    (data || []).forEach((r: any) => {
      const id = String(r['SUPPLIER ID'] ?? '').trim();
      const name = String(r['SUPPLIER NAME'] ?? '').trim();
      if (id && name) out.push({ id, name });
    });
    if (!data || data.length < 1000) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

// ─────────────────────────────────────────────────────────────
//  Attachments: download to check before sending
// ─────────────────────────────────────────────────────────────
export async function previewAttachment(spec: AttachmentSpec): Promise<{ filename: string; base64: string; contentType: string }[]> {
  const { user } = await requireTab('compose', 'bulk');
  checkAttachmentAccess(user, spec);
  const built = await buildAttachment(spec, user);
  return built.files.map((f) => ({ filename: f.filename, base64: f.content.toString('base64'), contentType: f.contentType }));
}

// ─────────────────────────────────────────────────────────────
//  Sending
// ─────────────────────────────────────────────────────────────
const cleanList = (list: unknown) =>
  Array.from(new Set((Array.isArray(list) ? list : []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean)));

function checkEmails(label: string, list: string[]) {
  const bad = list.filter((e) => !EMAIL_RE.test(e));
  if (bad.length) throw new Error(`${label}: "${bad[0]}" is not a valid email`);
}

async function userNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return new Map();
  const { data } = await getSupabaseAdmin().from('bhs_USERS').select('ID, NAME').in('ID', uniq);
  return new Map((data || []).map((u: any) => [String(u.ID), String(u.NAME || '')]));
}

const toLog = (r: any, names: Map<string, string>): MailLogRow => ({
  ID: String(r.ID),
  BATCH_ID: r.BATCH_ID ? String(r.BATCH_ID) : null,
  FROM_EMAIL: String(r.FROM_EMAIL || ''),
  TO_EMAILS: Array.isArray(r.TO_EMAILS) ? r.TO_EMAILS : [],
  CC_EMAILS: Array.isArray(r.CC_EMAILS) ? r.CC_EMAILS : [],
  BCC_EMAILS: Array.isArray(r.BCC_EMAILS) ? r.BCC_EMAILS : [],
  SUBJECT: String(r.SUBJECT || ''),
  BODY: String(r.BODY || ''),
  ATTACHMENTS: Array.isArray(r.ATTACHMENTS) ? r.ATTACHMENTS : [],
  PARTY: r.PARTY ? String(r.PARTY) : null,
  STATUS: r.STATUS === 'sent' ? 'sent' : 'failed',
  ERROR: r.ERROR ? String(r.ERROR) : null,
  SENT_BY: String(r.SENT_BY || ''),
  SENT_BY_NAME: names.get(String(r.SENT_BY)) || '',
  SENT_AT: String(r.SENT_AT || ''),
});

async function writeLog(row: Record<string, unknown>, user: SessionUserRecord): Promise<MailLogRow> {
  const { data, error } = await getSupabaseAdmin().from(LOG).insert(row).select('*').single();
  if (error) throw new Error(`The email was handled but the log could not be saved: ${error.message}`);
  return toLog(data, new Map([[String(user.id), user.name]]));
}

/** builds every attachment, fills the variables, sends one email and logs it */
async function sendOne(
  user: SessionUserRecord,
  input: { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string; attachments: AttachmentSpec[]; batchId?: string | null },
): Promise<MailLogRow> {
  const conn = await getMailConnection();
  const from = conn?.fromEmail || '';
  let subject = input.subject;
  let body = input.body;
  let party: string | null = null;
  const names: { name: string; spec: AttachmentSpec }[] = [];

  try {
    if (!conn) throw new Error('The mailbox is not connected yet — Mail Center → Settings');
    const files: MailFile[] = [];
    let vars: Record<string, string> = { Today: formatDate(uaeToday()), AsOfDate: formatDate(uaeToday()) };
    for (const spec of input.attachments) {
      checkAttachmentAccess(user, spec);
      const built = await buildAttachment(spec, user);
      if (!party) {
        party = built.party;
        vars = { ...vars, ...built.vars }; // the first attachment fills {Name} / {Balance} / {AsOfDate}
      }
      built.files.forEach((f) => {
        files.push(f);
        names.push({ name: f.filename, spec });
      });
    }
    subject = renderVariables(subject, vars);
    body = renderVariables(body, vars);
    await sendFromMailbox({ to: input.to, cc: input.cc, bcc: input.bcc, subject, html: bodyToHtml(body), attachments: files });
    return writeLog(
      { BATCH_ID: input.batchId || null, FROM_EMAIL: from, TO_EMAILS: input.to, CC_EMAILS: input.cc, BCC_EMAILS: input.bcc, SUBJECT: subject, BODY: body, ATTACHMENTS: names, PARTY: party, STATUS: 'sent', ERROR: null, SENT_BY: String(user.id) },
      user,
    );
  } catch (e: any) {
    const message = String(e?.message || 'Could not send').slice(0, 1000);
    try {
      await writeLog(
        { BATCH_ID: input.batchId || null, FROM_EMAIL: from, TO_EMAILS: input.to, CC_EMAILS: input.cc, BCC_EMAILS: input.bcc, SUBJECT: subject, BODY: body, ATTACHMENTS: names, PARTY: party, STATUS: 'failed', ERROR: message, SENT_BY: String(user.id) },
        user,
      );
    } catch {
      // the log table may not exist yet
    }
    throw new Error(message);
  }
}

/** Compose: one email. */
async function sendMailDraftImpl(draft: MailDraft): Promise<MailLogRow> {
  const { user } = await requireTab('compose');
  const to = cleanList(draft?.to);
  const cc = cleanList(draft?.cc).filter((e) => !to.includes(e));
  const bcc = cleanList(draft?.bcc).filter((e) => !to.includes(e) && !cc.includes(e));
  if (!to.length) throw new Error('Add at least one email in To');
  if (to.length + cc.length + bcc.length > MAX_RECIPIENTS) throw new Error(`Up to ${MAX_RECIPIENTS} emails in one message`);
  checkEmails('To', to);
  checkEmails('CC', cc);
  checkEmails('BCC', bcc);
  const subject = String(draft?.subject || '').trim().slice(0, 250);
  if (!subject) throw new Error('Write the subject');
  const attachments = (Array.isArray(draft?.attachments) ? draft.attachments : []).slice(0, MAX_ATTACHMENTS);
  return sendOne(user, { to, cc, bcc, subject, body: String(draft?.body || '').slice(0, 20000), attachments });
}

/**
 * Bulk: one email of a batch (the page calls this once per row, one after the other).
 * By customer: to his saved emails with his statement. By tag (tag set): to the saved emails of every
 * customer of the tag with the group statement.
 */
export async function sendBulkOne(input: {
  batchId: string;
  customerName: string;
  customerId?: string | null;
  tag?: string | null;
  subject: string;
  body: string;
  attachment: TemplateAttachment | null;
  dateTo: string | null;
  cc?: string[];
}): Promise<MailLogRow> {
  const { user } = await requireTab('bulk');
  return bulkOne(user, input);
}

/** Customer Statement tab: one customer, to his saved emails, with his statement. */
export async function sendCustomerStatement(input: {
  customerName: string;
  customerId?: string | null;
  format: AttachmentFormat;
  scope: StatementScope;
  dateTo: string | null;
}): Promise<ActionResult<MailLogRow>> {
  return asResult(async () => {
    const { user } = await requireTab('statements');
    const format: AttachmentFormat = ['pdf', 'excel', 'both'].includes(input?.format) ? input.format : 'pdf';
    const scope: StatementScope = input?.scope === 'all' ? 'all' : 'open';
    const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(String(input?.dateTo || '')) ? String(input.dateTo) : null;
    return bulkOne(user, {
      batchId: null,
      customerName: String(input?.customerName || ''),
      customerId: input?.customerId || null,
      tag: null,
      subject: 'Statement of Account – {Name}',
      body: DEFAULT_BODY,
      attachment: { kind: 'customer-statement', format, scope, dateMode: 'none' },
      dateTo,
    });
  });
}

/** Lulu customers (debit_EMILS_LULU): TO and CC per customer, keyed by lower-case customer id */
async function luluMap(): Promise<Map<string, { to: string[]; cc: string[] }>> {
  const out = new Map<string, { to: string[]; cc: string[] }>();
  let rows: { customerId: unknown; to: unknown; cc: unknown }[] = [];
  try {
    rows = await getLuluEmailsStrict();
  } catch {
    return out;
  }
  for (const r of rows) {
    const key = String(r.customerId ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) continue;
    const e = out.get(key) || { to: [], cc: [] };
    e.to = cleanList([...e.to, ...splitStoredEmails(r.to)]);
    e.cc = cleanList([...e.cc, ...splitStoredEmails(r.cc)]);
    if (e.to.length || e.cc.length) out.set(key, e);
  }
  return out;
}

async function bulkOne(
  user: SessionUserRecord,
  input: { batchId: string | null; customerName: string; customerId?: string | null; tag?: string | null; subject: string; body: string; attachment: TemplateAttachment | null; dateTo: string | null; cc?: string[] },
): Promise<MailLogRow> {
  const tag = String(input?.tag || '').trim();
  const name = tag || String(input?.customerName || '').trim();
  if (!name) throw new Error('Customer is missing');
  let to: string[] = [];
  let luluCc: string[] = [];
  if (tag) {
    // every customer of the tag (only the ones this user may see)
    const ids: string[] = Array.from(new Set<string>((await ledgerFor(user)).filter((r) => String(r.customerTag || '').trim() === tag).map((r) => String(r.customerId || '').trim()).filter(Boolean)));
    for (const id of ids) to.push(...cleanList((await resolveCustomerEmailTargets(id)).emails));
    to = cleanList(to);
  } else {
    // Lulu customers: their TO / CC from debit_EMILS_LULU
    const lulu = await luluMap();
    const l = lulu.get(String(input.customerId || '').trim().toLowerCase()) || lulu.get(name.toLowerCase().replace(/\s+/g, ' '));
    if (l) {
      to = cleanList(l.to);
      luluCc = cleanList(l.cc);
    }
    if (!to.length && input.customerId) to = cleanList((await resolveCustomerEmailTargets(String(input.customerId))).emails);
    if (!to.length) to = cleanList((await resolveCustomerEmailTargets(name)).emails);
  }
  if (!to.length) {
    const message = `${name}: no email saved`;
    try {
      await writeLog({ BATCH_ID: input.batchId, FROM_EMAIL: '', TO_EMAILS: [], CC_EMAILS: [], BCC_EMAILS: [], SUBJECT: input.subject, BODY: '', ATTACHMENTS: [], PARTY: name, STATUS: 'failed', ERROR: message, SENT_BY: String(user.id) }, user);
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  checkEmails(name, to);
  const cc = cleanList([...luluCc, ...cleanList(input.cc)]).filter((e) => !to.includes(e));
  checkEmails('CC', cc);
  const attachments: AttachmentSpec[] = !input.attachment
    ? []
    : tag
      ? [{ kind: 'group-statement', tag, format: input.attachment.format, scope: input.attachment.scope, dateTo: input.dateTo }]
      : [{ kind: 'customer-statement', customerName: name, customerId: input.customerId || null, format: input.attachment.format, scope: input.attachment.scope, dateTo: input.dateTo }];
  return sendOne(user, { to, cc, bcc: [], subject: String(input.subject || '').trim().slice(0, 250) || 'Statement of Account', body: String(input.body || ''), attachments, batchId: input.batchId });
}

// ─────────────────────────────────────────────────────────────
//  Sent (log)
// ─────────────────────────────────────────────────────────────
export async function listMailLog(): Promise<MailLogRow[]> {
  const { user, perms } = await requireTab('sent');
  const rows: any[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    let q = getSupabaseAdmin().from(LOG).select('*');
    if (!perms.admin) q = q.eq('SENT_BY', String(user.id));
    const { data, error } = await q.order('SENT_AT', { ascending: false }).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const names = await userNames(rows.map((r) => String(r.SENT_BY)));
  return rows.map((r) => toLog(r, names));
}

// ─────────────────────────────────────────────────────────────
//  Templates
// ─────────────────────────────────────────────────────────────
const toTemplate = (r: any, names: Map<string, string>): MailTemplate => ({
  ID: String(r.ID),
  NAME: String(r.NAME || ''),
  SUBJECT: String(r.SUBJECT || ''),
  BODY: String(r.BODY || ''),
  ATTACHMENT: r.ATTACHMENT && r.ATTACHMENT.kind ? (r.ATTACHMENT as TemplateAttachment) : null,
  CREATED_BY: String(r.CREATED_BY || ''),
  CREATED_BY_NAME: names.get(String(r.CREATED_BY)) || '',
  CREATED_AT: String(r.CREATED_AT || ''),
  UPDATED_AT: r.UPDATED_AT || null,
});

export async function listMailTemplates(): Promise<MailTemplate[]> {
  await requireTab('compose', 'bulk', 'templates');
  const { data, error } = await getSupabaseAdmin().from(TEMPLATES).select('*').order('NAME', { ascending: true });
  if (error) throw new Error(error.message);
  const names = await userNames((data || []).map((r: any) => String(r.CREATED_BY)));
  return (data || []).map((r: any) => toTemplate(r, names));
}

function cleanTemplateAttachment(a: any): TemplateAttachment | null {
  if (!a || !['customer-statement', 'group-statement', 'supplier-statement'].includes(a.kind)) return null;
  return {
    kind: a.kind,
    format: ['pdf', 'excel', 'both'].includes(a.format) ? a.format : 'pdf',
    scope: a.scope === 'open' ? 'open' : 'all',
    dateMode: ['today', 'month-end', 'last-month-end', 'none'].includes(a.dateMode) ? a.dateMode : 'today',
  };
}

export async function saveMailTemplate(input: { ID?: string; NAME: string; SUBJECT: string; BODY: string; ATTACHMENT: TemplateAttachment | null }): Promise<MailTemplate> {
  const { user } = await requireTab('templates');
  const NAME = String(input?.NAME || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!NAME) throw new Error('Name is required');
  const SUBJECT = String(input?.SUBJECT || '').trim().slice(0, 250);
  if (!SUBJECT) throw new Error('Subject is required');
  const record = { NAME, SUBJECT, BODY: String(input?.BODY || '').slice(0, 20000), ATTACHMENT: cleanTemplateAttachment(input?.ATTACHMENT) };
  const db = getSupabaseAdmin();
  const q = input?.ID
    ? db.from(TEMPLATES).update({ ...record, UPDATED_AT: new Date().toISOString() }).eq('ID', input.ID)
    : db.from(TEMPLATES).insert({ ...record, CREATED_BY: String(user.id) });
  const { data, error } = await q.select('*').single();
  if (error) throw new Error(error.code === '23505' ? `A template named "${NAME}" already exists` : error.message);
  return toTemplate(data, await userNames([String(data.CREATED_BY)]));
}

export async function deleteMailTemplate(id: string): Promise<{ success: true }> {
  await requireTab('templates');
  const { error } = await getSupabaseAdmin().from(TEMPLATES).delete().eq('ID', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

/** the "till" date of a template, as the server sees today (Dubai) */
export async function templateDate(mode: TemplateAttachment['dateMode']): Promise<string | null> {
  await requireUser();
  return resolveDateMode(mode);
}
