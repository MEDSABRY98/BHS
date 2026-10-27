// Mail Center — its own Zoho Mail connection (the finance mailbox), apart from Scheduled Reports.
// Sends through the Zoho Mail API (HTTPS): Zoho blocks SMTP from cloud servers.
//
// Vercel → Environment Variables (the Zoho API Console client of the finance mailbox):
//   MAIL_ZOHO_CLIENT_ID, MAIL_ZOHO_CLIENT_SECRET   (fall back to ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET)
//   ZOHO_DC                                        optional: com (default) | eu | in | sa | com.au | jp | ca
// The refresh token + account id + sender email are saved by "Connect" in Mail Center → Settings
// (table web_MAIL_SETTINGS, server only).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const SETTINGS_TABLE = 'web_MAIL_SETTINGS';
const SCOPES = 'ZohoMail.messages.CREATE,ZohoMail.accounts.READ';
const KEYS = ['ZOHO_REFRESH_TOKEN', 'ZOHO_ACCOUNT_ID', 'ZOHO_FROM', 'ZOHO_CONNECTED_BY', 'ZOHO_CONNECTED_AT'];

const clientId = () => (process.env.MAIL_ZOHO_CLIENT_ID || process.env.ZOHO_CLIENT_ID || '').trim();
const clientSecret = () => (process.env.MAIL_ZOHO_CLIENT_SECRET || process.env.ZOHO_CLIENT_SECRET || '').trim();
const dc = () => (process.env.ZOHO_DC || 'com').trim().replace(/^\./, '') || 'com';
const accountsUrl = () => `https://accounts.zoho.${dc()}`;
const mailUrl = () => `https://mail.zoho.${dc()}`;

export const mailScopes = () => SCOPES;
export const mailClientReady = () => !!(clientId() && clientSecret());

export type MailConnection = { refreshToken: string; accountId: string; fromEmail: string; connectedBy?: string | null; connectedAt?: string | null };

async function readSettings(): Promise<Record<string, string>> {
  const { data, error } = await getSupabaseAdmin().from(SETTINGS_TABLE).select('KEY, VALUE');
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const r of (data || []) as any[]) out[String(r.KEY)] = String(r.VALUE ?? '');
  return out;
}

export async function getMailConnection(): Promise<MailConnection | null> {
  let s: Record<string, string>;
  try {
    s = await readSettings();
  } catch {
    return null; // table not created yet
  }
  if (!s.ZOHO_REFRESH_TOKEN || !s.ZOHO_ACCOUNT_ID || !s.ZOHO_FROM) return null;
  return { refreshToken: s.ZOHO_REFRESH_TOKEN, accountId: s.ZOHO_ACCOUNT_ID, fromEmail: s.ZOHO_FROM, connectedBy: s.ZOHO_CONNECTED_BY || null, connectedAt: s.ZOHO_CONNECTED_AT || null };
}

async function tokenRequest(params: Record<string, string>): Promise<any> {
  const body = new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), ...params });
  const res = await fetch(`${accountsUrl()}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`Zoho: ${json.error || `HTTP ${res.status}`}`);
  return json;
}

let tokenCache: { token: string; refreshToken: string; expires: number } | null = null;

async function accessToken(conn: MailConnection): Promise<string> {
  if (tokenCache && tokenCache.refreshToken === conn.refreshToken && tokenCache.expires > Date.now() + 60_000) return tokenCache.token;
  const json = await tokenRequest({ refresh_token: conn.refreshToken, grant_type: 'refresh_token' });
  if (!json.access_token) throw new Error('Zoho did not return an access token — connect the mailbox again');
  tokenCache = { token: json.access_token, refreshToken: conn.refreshToken, expires: Date.now() + (Number(json.expires_in) || 3600) * 1000 };
  return tokenCache.token;
}

async function zohoFetch(token: string, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${mailUrl()}${path}`, {
    ...init,
    headers: { Accept: 'application/json', Authorization: `Zoho-oauthtoken ${token}`, ...(init.headers || {}) },
    cache: 'no-store',
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || (json?.status?.code && json.status.code >= 400)) {
    const why = json?.data?.moreInfo || json?.status?.description || `HTTP ${res.status}`;
    throw new Error(`Zoho Mail: ${why}`);
  }
  return json;
}

/** Exchanges the code from api-console.zoho.com (Self Client → Generate Code) and saves the connection. */
export async function connectMailbox(code: string, by: string): Promise<{ fromEmail: string }> {
  if (!mailClientReady()) throw new Error('Add MAIL_ZOHO_CLIENT_ID and MAIL_ZOHO_CLIENT_SECRET in Vercel first, then redeploy');
  const json = await tokenRequest({ code: code.trim(), grant_type: 'authorization_code' });
  if (!json.refresh_token) throw new Error('Zoho did not return a refresh token — generate a new code and try again');

  const accounts = await zohoFetch(json.access_token, '/api/accounts');
  const list: any[] = Array.isArray(accounts?.data) ? accounts.data : [];
  const acc = list.find((a) => a?.accountId) || null;
  if (!acc) throw new Error('No Zoho Mail account found for this login');
  const fromEmail = String(acc.primaryEmailAddress || acc.mailboxAddress || acc.emailAddress?.[0]?.mailId || '').trim();
  if (!fromEmail) throw new Error('Could not read the email address of the Zoho account');

  const now = new Date().toISOString();
  const rows = [
    ['ZOHO_REFRESH_TOKEN', json.refresh_token],
    ['ZOHO_ACCOUNT_ID', String(acc.accountId)],
    ['ZOHO_FROM', fromEmail],
    ['ZOHO_CONNECTED_BY', by],
    ['ZOHO_CONNECTED_AT', now],
  ].map(([KEY, VALUE]) => ({ KEY, VALUE, UPDATED_BY: by, UPDATED_AT: now }));
  const { error } = await getSupabaseAdmin().from(SETTINGS_TABLE).upsert(rows, { onConflict: 'KEY' });
  if (error) throw new Error(error.message);
  tokenCache = null;
  return { fromEmail };
}

export async function disconnectMailbox(): Promise<void> {
  const { error } = await getSupabaseAdmin().from(SETTINGS_TABLE).delete().in('KEY', KEYS);
  if (error) throw new Error(error.message);
  tokenCache = null;
}

export type OutgoingMail = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
};

/** Sends one email from the connected mailbox. */
export async function sendFromMailbox(mail: OutgoingMail): Promise<{ from: string }> {
  const conn = await getMailConnection();
  if (!conn) throw new Error('The mailbox is not connected yet — Mail Center → Settings');
  if (!mailClientReady()) throw new Error('The Zoho client is not set on the server (MAIL_ZOHO_CLIENT_ID / MAIL_ZOHO_CLIENT_SECRET)');
  const token = await accessToken(conn);
  const base = `/api/accounts/${encodeURIComponent(conn.accountId)}`;

  const attachments: { storeName: string; attachmentPath: string; attachmentName: string }[] = [];
  for (const a of mail.attachments || []) {
    const up = await zohoFetch(token, `${base}/messages/attachments?fileName=${encodeURIComponent(a.filename)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(a.content),
    });
    const d = Array.isArray(up?.data) ? up.data[0] : up?.data;
    if (!d?.storeName) throw new Error('Zoho Mail: the attachment upload failed');
    attachments.push({ storeName: d.storeName, attachmentPath: d.attachmentPath, attachmentName: d.attachmentName || a.filename });
  }

  await zohoFetch(token, `${base}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromAddress: conn.fromEmail,
      toAddress: mail.to.join(','),
      ...(mail.cc?.length ? { ccAddress: mail.cc.join(',') } : {}),
      ...(mail.bcc?.length ? { bccAddress: mail.bcc.join(',') } : {}),
      subject: mail.subject,
      content: mail.html,
      mailFormat: 'html',
      ...(attachments.length ? { attachments } : {}),
    }),
  });
  return { from: conn.fromEmail };
}
