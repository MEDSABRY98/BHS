// Mail Center — shared (client + server safe) types and helpers.
// Emails go out from the connected Zoho mailbox (finance), attachments are made on the server
// from the modules (customer / supplier statement), every email is kept in web_MAIL_LOG.

export const MAIL_SYSTEM_ID = 'mail-center';

export type MailTabId = 'compose' | 'bulk' | 'templates' | 'sent' | 'settings';
/** tabs given in Admin Control; 'settings' (the mailbox) is admin only; 'bulk' is not shown any more */
export const MAIL_PERMISSION_TABS: MailTabId[] = ['compose', 'templates', 'sent'];

export interface MailPermissions {
  tabs: MailTabId[];
  admin: boolean; // sees everyone's sent emails, connects the mailbox
}

export interface MailStatus {
  connected: boolean;
  from: string | null;
  clientReady: boolean; // ZOHO client id / secret are set on the server
  scopes: string;
}

export type AttachmentFormat = 'pdf' | 'excel' | 'both';
export type StatementScope = 'all' | 'open';
export type AttachmentKind = 'customer-statement' | 'group-statement' | 'supplier-statement';

export const ATTACHMENT_KINDS: { id: AttachmentKind; label: string }[] = [
  { id: 'customer-statement', label: 'Customer Statement' },
  { id: 'group-statement', label: 'Group Statement (Tag)' },
  { id: 'supplier-statement', label: 'Supplier Statement' },
];
export const FORMATS: { id: AttachmentFormat; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'excel', label: 'Excel' },
  { id: 'both', label: 'PDF + Excel' },
];
export const SCOPES: { id: StatementScope; label: string }[] = [
  { id: 'all', label: 'All Transactions' },
  { id: 'open', label: 'Open Only' },
];

/** one attachment of an email: what to make, the file is made on the server when sending */
export type AttachmentSpec =
  | { kind: 'customer-statement'; customerName: string; customerId?: string | null; format: AttachmentFormat; scope: StatementScope; dateTo: string | null }
  /** every customer of a tag in one statement (Customer column, by date then number; landscape when 2+ customers) */
  | { kind: 'group-statement'; tag: string; format: AttachmentFormat; scope: StatementScope; dateTo: string | null }
  | { kind: 'supplier-statement'; supplierId: string; supplierName: string; format: AttachmentFormat; scope: StatementScope; dateTo: string | null };

/** "till" date of a template: today, the end of this month or of last month */
export type DateMode = 'today' | 'month-end' | 'last-month-end' | 'none';
export const DATE_MODES: { id: DateMode; label: string }[] = [
  { id: 'today', label: 'Up to today' },
  { id: 'month-end', label: 'Up to the end of this month' },
  { id: 'last-month-end', label: 'Up to the end of last month' },
  { id: 'none', label: 'No date limit' },
];

export interface TemplateAttachment {
  kind: AttachmentKind;
  format: AttachmentFormat;
  scope: StatementScope;
  dateMode: DateMode;
}

export interface MailTemplate {
  ID: string;
  NAME: string;
  SUBJECT: string;
  BODY: string;
  ATTACHMENT: TemplateAttachment | null;
  CREATED_BY: string;
  CREATED_BY_NAME?: string;
  CREATED_AT: string;
  UPDATED_AT?: string | null;
}

export interface MailDraft {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string; // plain text, new lines kept
  attachments: AttachmentSpec[];
  templateId?: string | null;
}

export interface MailLogRow {
  ID: string;
  BATCH_ID: string | null;
  FROM_EMAIL: string;
  TO_EMAILS: string[];
  CC_EMAILS: string[];
  BCC_EMAILS: string[];
  SUBJECT: string;
  BODY: string;
  ATTACHMENTS: { name: string; spec: AttachmentSpec }[];
  PARTY: string | null; // customer / supplier name
  STATUS: 'sent' | 'failed';
  ERROR: string | null;
  SENT_BY: string;
  SENT_BY_NAME?: string;
  SENT_AT: string;
}

export interface MailCustomer {
  name: string;
  id: string;
  tag: string;
  emails: string[];
  balance: number;
}

export interface MailSupplier {
  id: string;
  name: string;
}

// ── helpers ─────────────────────────────────────────────────────────────
export const VARIABLES = ['{Name}', '{Balance}', '{AsOfDate}', '{Today}'];

export const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
export const splitEmails = (v: string) =>
  Array.from(new Set(String(v || '').split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean)));

export const formatAmount = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function uaeToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** 2026-10-27 → 27/10/2026 */
export function formatDate(iso: string | null | undefined): string {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso || '');
}

/** the "till" date of a template */
export function resolveDateMode(mode: DateMode, today = uaeToday()): string | null {
  if (mode === 'none') return null;
  if (mode === 'today') return today;
  const [y, m] = today.split('-').map(Number);
  const end = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10); // mm 1-12
  return mode === 'month-end' ? end(y, m) : end(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);
}

/** fills {Name}, {Balance}, {AsOfDate}, {Today} */
export function renderVariables(text: string, vars: Record<string, string>): string {
  return String(text || '').replace(/\{(Name|Balance|AsOfDate|Today)\}/g, (all, k) => (vars[k] !== undefined ? vars[k] : all));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** the typed body (plain text) as the email HTML; **bold** is kept */
export function bodyToHtml(text: string): string {
  const html = esc(String(text || ''))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\r?\n/g, '<br>');
  return `<div dir="auto" style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;">${html}</div>`;
}

export function describeAttachment(a: AttachmentSpec): string {
  const what = a.kind === 'customer-statement' ? a.customerName : a.kind === 'group-statement' ? `Tag ${a.tag}` : a.supplierName;
  const fmt = FORMATS.find((f) => f.id === a.format)?.label || a.format;
  const sc = SCOPES.find((s) => s.id === a.scope)?.label || a.scope;
  return `${what} · ${fmt} · ${sc}${a.dateTo ? ` · up to ${formatDate(a.dateTo)}` : ''}`;
}

export const kindLabel = (k: AttachmentKind) => ATTACHMENT_KINDS.find((x) => x.id === k)?.label || k;

/** customers grouped by tag (for the tag pickers) */
export function tagsOf(customers: MailCustomer[]): { tag: string; customers: MailCustomer[]; emails: string[]; balance: number }[] {
  const map = new Map<string, MailCustomer[]>();
  customers.forEach((c) => c.tag && map.set(c.tag, [...(map.get(c.tag) || []), c]));
  return Array.from(map.entries())
    .map(([tag, list]) => ({
      tag,
      customers: list,
      emails: Array.from(new Set(list.flatMap((c) => c.emails.map((e) => e.toLowerCase())))),
      balance: Math.round(list.reduce((s, c) => s + c.balance, 0) * 100) / 100,
    }))
    .sort((a, b) => a.tag.localeCompare(b.tag, 'en', { sensitivity: 'base' }));
}

export const DEFAULT_BODY = `Dear Team,

We hope this message finds you well.

Please find attached your statement of account.

**Your balance as of {AsOfDate} is: {Balance} AED**

Kindly provide us with your statement of account for reconciliation.

Best regards,
Finance Department
Al Marai Al Arabia Trading Sole Proprietorship L.L.C`;
