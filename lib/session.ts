// ─────────────────────────────────────────────────────────────
//  SERVER-SIDE SESSION
//  Signed, httpOnly cookie that identifies the logged-in user.
//  Server actions read the user from here — never from ids sent
//  by the browser.
//
//  Requires env var SESSION_SECRET (long random string, server only).
//  This module uses next/headers, so it can only run on the server.
// ─────────────────────────────────────────────────────────────
import { cookies } from 'next/headers';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const COOKIE_NAME = 'bhs_session';
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = { uid: string; name: string; iat: number; exp: number };

export type SessionUserRecord = {
  id: string;
  name: string;
  role: string;            // AUTHORITY (permissions JSON or 'Admin')
  userAdmin: string;       // ROLE column
  salesDataAccess: boolean;
};

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET is not configured (must be at least 32 characters).');
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(data: string): string {
  return b64url(createHmac('sha256', getSecret()).update(data).digest());
}

export function encodeSession(payload: SessionPayload): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as SessionPayload;
    if (!payload?.uid || typeof payload.exp !== 'number') return null;
    if (Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  Cookie helpers (await works for both sync and async cookies())
// ─────────────────────────────────────────────────────────────
export async function createSession(user: { id: string; name: string }) {
  const now = Math.floor(Date.now() / 1000);
  const token = encodeSession({ uid: String(user.id), name: String(user.name || ''), iat: now, exp: now + SESSION_MAX_AGE_SEC });
  const store: any = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function clearSession() {
  const store: any = await cookies();
  store.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const store: any = await cookies();
    return decodeSession(store.get(COOKIE_NAME)?.value);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  User lookup (fresh from DB, so permission changes apply)
// ─────────────────────────────────────────────────────────────
const parseBool = (val: unknown) =>
  val === true || val === 1 || ['true', 't', 'yes', '1'].includes(String(val ?? '').trim().toLowerCase());

export function toSessionUser(row: any): SessionUserRecord {
  return {
    id: row.ID,
    name: row.NAME,
    role: row.AUTHORITY || '',
    userAdmin: row.ROLE,
    salesDataAccess: parseBool(row.FULL_DATA_ACCESS ?? row.SALES_DATA_ACCESS),
  };
}

export async function getSessionUser(): Promise<SessionUserRecord | null> {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await getSupabaseAdmin()
    .from('bhs_USERS')
    .select('*') // '*' so it works before and after renaming SALES_DATA_ACCESS -> FULL_DATA_ACCESS
    .eq('ID', session.uid)
    .maybeSingle();
  if (error || !data) return null;
  return toSessionUser(data);
}

export function isAdminUser(user: Pick<SessionUserRecord, 'name' | 'role' | 'userAdmin'> | null | undefined): boolean {
  if (!user) return false;
  if (String(user.name || '').trim().toLowerCase() === 'med sabry') return true;
  if (String(user.userAdmin || '').trim().toLowerCase() === 'admin') return true;
  if (String(user.role || '').trim() === 'Admin') return true;
  return false;
}

/** Throws if there is no valid session. Returns the session payload (cheap: no DB call). */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return session;
}

/** Throws unless the logged-in user is an admin. */
export async function requireAdmin(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (!isAdminUser(user)) throw new UnauthorizedError('Admin permission required.');
  return user;
}

// ─────────────────────────────────────────────────────────────
//  Password hashing (scrypt). Legacy plain-text values are still
//  accepted once and upgraded to a hash on successful login.
// ─────────────────────────────────────────────────────────────
const HASH_PREFIX = 'scrypt$';

export function isHashedPassword(stored: unknown): boolean {
  return typeof stored === 'string' && stored.startsWith(HASH_PREFIX);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${HASH_PREFIX}${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: unknown): { ok: boolean; legacy: boolean } {
  if (typeof stored !== 'string' || !stored) return { ok: false, legacy: false };
  if (isHashedPassword(stored)) {
    const [, salt, hashHex] = stored.split('$');
    if (!salt || !hashHex) return { ok: false, legacy: false };
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, salt, expected.length);
    return { ok: expected.length === actual.length && timingSafeEqual(expected, actual), legacy: false };
  }
  const a = Buffer.from(String(password));
  const b = Buffer.from(stored);
  return { ok: a.length === b.length && timingSafeEqual(a, b), legacy: true };
}
