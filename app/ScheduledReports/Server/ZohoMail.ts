// Scheduled Reports — send email through the Zoho Mail API (HTTPS).
// Used instead of SMTP because Zoho blocks SMTP from cloud servers (Vercel) with "552 Your IP Address is blocked".
//
// Vercel → Environment Variables:
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET   (api-console.zoho.com → Self Client)
//   ZOHO_DC                              optional: com (default) | eu | in | sa | com.au | jp | ca
// The refresh token + account id + sender email are saved by "Connect Zoho Mail" in the module
// (table app_SCHEDULED_REPORTS_SETTINGS, server key only).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const SETTINGS_TABLE = 'app_SCHEDULED_REPORTS_SETTINGS';
const SCOPES = 'ZohoMail.messages.CREATE,ZohoMail.accounts.READ';

const dc = () => (process.env.ZOHO_DC || 'com').trim().replace(/^\./, '') || 'com';
const accountsUrl = () => `https://accounts.zoho.${dc()}`;
const mailUrl = () => `https://mail.zoho.${dc()}`;

export const zohoScopes = () => SCOPES;
export const zohoClientReady = () => !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET);

export type ZohoConnection = { refreshToken: string; accountId: string; fromEmail: string; connectedBy?: string | null; connectedAt?: string | null };

async function readSettings(): Promise<Record<string, string>> {
  const { data, error } = await getSupabaseAdmin().from(SETTINGS_TABLE).select('KEY, VALUE');
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const r of (data || []) as any[]) out[String(r.KEY)] = String(r.VALUE ?? '');
  return out;
}

export async function getZohoConnection(): Promise<ZohoConnection | null> {
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
  const body = new URLSearchParams({ client_id: process.env.ZOHO_CLIENT_ID || '', client_secret: process.env.ZOHO_CLIENT_SECRET || '', ...params });
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

async function accessToken(conn: ZohoConnection): Promise<string> {
  if (tokenCache && tokenCache.refreshToken === conn.refreshToken && tokenCache.expires > Date.now() + 60_000) return tokenCache.token;
  const json = await tokenRequest({ refresh_token: conn.refreshToken, grant_type: 'refresh_token' });
  if (!json.access_token) throw new Error('Zoho did not return an access token — connect Zoho Mail again');
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

/** Exchanges the code from api-console (Self Client → Generate Code) and saves the connection. */
export async function connectZoho(code: string, by: string): Promise<{ fromEmail: string }> {
  if (!zohoClientReady()) throw new Error('Add ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in Vercel first, then redeploy');
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

export async function disconnectZoho(): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from(SETTINGS_TABLE)
    .delete()
    .in('KEY', ['ZOHO_REFRESH_TOKEN', 'ZOHO_ACCOUNT_ID', 'ZOHO_FROM', 'ZOHO_CONNECTED_BY', 'ZOHO_CONNECTED_AT']);
  if (error) throw new Error(error.message);
  tokenCache = null;
}

export async function sendViaZoho(
  conn: ZohoConnection,
  mail: { to: string[]; subject: string; html: string; attachments?: { filename: string; content: Buffer }[] },
): Promise<void> {
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
      subject: mail.subject,
      content: mail.html,
      mailFormat: 'html',
      ...(attachments.length ? { attachments } : {}),
    }),
  });
}
