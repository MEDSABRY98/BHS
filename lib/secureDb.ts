// ════════════════════════════════════════════════════════════════
//  Browser-side database client.
//  Same API the screens already use (bhs_supabase.from(...).select(...)...),
//  but nothing talks to Supabase from the browser: each query is sent to
//  /api/SecureDb, which checks the login and permissions and runs it on the
//  server with the server-only key (rules: lib/secureDbGateway.ts).
// ════════════════════════════════════════════════════════════════

import { getCustomerEmails, getLuluCustomerEmails } from '@/app/Emails/Service/email_service';

type SecureStep = [string, unknown[]];
type SecureRequest = { table: string; steps: SecureStep[] };
export type SecureResult = {
  // list queries return rows, single()/maybeSingle() return one row — typed so both compile
  data: (any[] & Record<string, any>) | null;
  error: { message: string; code?: string; details?: string; hint?: string } | null;
  count: number | null;
  status: number;
};

const ENDPOINT = '/api/SecureDb';
// Keep each request well under the hosting body limit (~4.5 MB)
const MAX_BODY_CHARS = 2_500_000;

function failure(message: string, status = 500, code?: string): SecureResult {
  return { data: null, error: { message, code }, count: null, status };
}

async function post(req: SecureRequest, body: string): Promise<SecureResult> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body,
    });
  } catch (e: unknown) {
    return failure(e instanceof Error ? e.message : 'Network error', 0);
  }
  try {
    return (await res.json()) as SecureResult;
  } catch {
    if (res.status === 401 || res.redirected) return failure('Your session has expired. Please log in again.', 401, 'PGRST301');
    return failure(`Server error (${res.status}) on ${req.table}`, res.status || 500);
  }
}

/** Sends one query; very large inserts/upserts are split into smaller requests. */
async function send(req: SecureRequest): Promise<SecureResult> {
  const body = JSON.stringify(req);
  if (body.length <= MAX_BODY_CHARS) return post(req, body);

  const idx = req.steps.findIndex(([m, a]) => (m === 'insert' || m === 'upsert') && Array.isArray(a?.[0]) && (a[0] as unknown[]).length > 1);
  if (idx < 0) return post(req, body);

  const rows = req.steps[idx][1][0] as unknown[];
  const half = Math.ceil(rows.length / 2);
  const withRows = (part: unknown[]): SecureRequest => ({
    table: req.table,
    steps: req.steps.map((s, i) => (i === idx ? [s[0], [part, ...s[1].slice(1)]] : s)) as SecureStep[],
  });

  const first = await send(withRows(rows.slice(0, half)));
  if (first.error) return first;
  const second = await send(withRows(rows.slice(half)));
  if (second.error) return second;
  const data = Array.isArray(first.data) || Array.isArray(second.data)
    ? [...(first.data || []), ...(second.data || [])]
    : second.data ?? first.data;
  const count = first.count != null || second.count != null ? (first.count || 0) + (second.count || 0) : null;
  return { data, error: null, count, status: second.status };
}

class SecureQuery implements PromiseLike<SecureResult> {
  private steps: SecureStep[] = [];
  constructor(private table: string) {}

  private add(method: string, args: unknown[]) {
    this.steps.push([method, args]);
    return this;
  }

  select(...a: unknown[]) { return this.add('select', a); }
  insert(...a: unknown[]) { return this.add('insert', a); }
  update(...a: unknown[]) { return this.add('update', a); }
  upsert(...a: unknown[]) { return this.add('upsert', a); }
  delete(...a: unknown[]) { return this.add('delete', a); }
  eq(...a: unknown[]) { return this.add('eq', a); }
  neq(...a: unknown[]) { return this.add('neq', a); }
  gt(...a: unknown[]) { return this.add('gt', a); }
  gte(...a: unknown[]) { return this.add('gte', a); }
  lt(...a: unknown[]) { return this.add('lt', a); }
  lte(...a: unknown[]) { return this.add('lte', a); }
  like(...a: unknown[]) { return this.add('like', a); }
  ilike(...a: unknown[]) { return this.add('ilike', a); }
  is(...a: unknown[]) { return this.add('is', a); }
  in(...a: unknown[]) { return this.add('in', a); }
  contains(...a: unknown[]) { return this.add('contains', a); }
  containedBy(...a: unknown[]) { return this.add('containedBy', a); }
  overlaps(...a: unknown[]) { return this.add('overlaps', a); }
  not(...a: unknown[]) { return this.add('not', a); }
  or(...a: unknown[]) { return this.add('or', a); }
  filter(...a: unknown[]) { return this.add('filter', a); }
  match(...a: unknown[]) { return this.add('match', a); }
  textSearch(...a: unknown[]) { return this.add('textSearch', a); }
  order(...a: unknown[]) { return this.add('order', a); }
  range(...a: unknown[]) { return this.add('range', a); }
  limit(...a: unknown[]) { return this.add('limit', a); }
  single() { return this.add('single', []); }
  maybeSingle() { return this.add('maybeSingle', []); }

  then<T1 = SecureResult, T2 = never>(
    onfulfilled?: ((value: SecureResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return send({ table: this.table, steps: this.steps }).then(onfulfilled as any, onrejected as any);
  }
}

// `any` keeps every existing call site compiling exactly as before
export const bhs_supabase: { from: (table: string) => SecureQuery } = {
  from: (table: string) => new SecureQuery(table),
};
export const bhs_supabas = bhs_supabase;

/** Reads every row page by page (same helper as lib/supabase, through the secure gateway). */
export async function fetchAllData(queryFactory: () => any, orderBy?: string) {
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let query = queryFactory();
    if (orderBy) query = query.order(orderBy, { ascending: true });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    } else {
      break;
    }
  }
  return allData;
}

/** Customer emails (one entry per customer) — loaded on the server. */
export async function getAllCustomerEmails() {
  try {
    const res = await getCustomerEmails();
    return ((res as any)?.customers || []) as { customerId: string; email: string }[];
  } catch (error) {
    console.error('Error fetching all customer emails:', error);
    return [];
  }
}

/** Lulu emails — loaded on the server. */
export async function getLuluEmails() {
  try {
    const res = await getLuluCustomerEmails();
    return ((res as any)?.customers || []) as { customerId: string; customerCode?: string; to?: string; cc?: string }[];
  } catch (error) {
    console.error('Error fetching Lulu emails:', error);
    return [];
  }
}
