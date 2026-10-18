'use server';
import { requireSession } from '@/lib/session';

import { bhs_supabase } from '@/lib/supabase';

// Count sessions made in the BHS mobile app (lot based).
const SESSIONS_TABLE = 'app_INVENTORY_COUNT_SESSIONS';
const LOTS_TABLE = 'app_INVENTORY_COUNT_LOTS';
const SESSION_STOCK_TABLE = 'app_INVENTORY_COUNT_SESSION_STOCK';
const ENTRIES_TABLE = 'app_INVENTORY_COUNT_ENTRIES';
const PAGE_SIZE = 1000;
const IN_CHUNK = 200;

export interface ICSession {
  id: number;
  name: string;
  warehouse: string;
  status: 'OPEN' | 'CLOSED';
  createdBy: string;
  createdAt: string | null;
  closedAt: string | null;
}

export interface ICLotRow {
  lotId: number;
  productId: string;
  barcode: string;
  productName: string;
  lotNumber: string;
  expiryDate: string; // yyyy-mm-dd or ''
  expected: number;
  counted: number;
  variance: number;
}

export interface ICEntryRow {
  id: number;
  createdAt: string | null;
  userId: string;
  userName: string;
  lotId: number;
  qty: number;
  details: string;
}

export interface ICSessionData {
  session: ICSession;
  lots: ICLotRow[];
  entries: ICEntryRow[];
}

const text = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

type Query = { eq?: [string, unknown]; inList?: [string, unknown[]] };

/** Reads every row page by page with a stable order. */
async function fetchAll<T>(table: string, select: string, order: string[], q: Query = {}): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    let query = bhs_supabase.from(table).select(select);
    if (q.eq) query = query.eq(q.eq[0], q.eq[1] as any);
    if (q.inList) query = query.in(q.inList[0], q.inList[1] as any[]);
    for (const column of order) query = query.order(column, { ascending: true });
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

/** Same as fetchAll with an IN filter, split in chunks (long URLs fail). */
async function fetchIn<T>(table: string, select: string, order: string[], column: string, values: unknown[]): Promise<T[]> {
  const unique = Array.from(new Set(values));
  const rows: T[] = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    rows.push(...(await fetchAll<T>(table, select, order, { inList: [column, unique.slice(i, i + IN_CHUNK)] })));
  }
  return rows;
}

function mapSession(r: any): ICSession {
  return {
    id: Number(r.ID),
    name: text(r.NAME),
    warehouse: text(r.WAREHOUSE),
    status: text(r.STATUS).toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN',
    createdBy: text(r.CREATED_BY),
    createdAt: r.CREATED_AT ?? null,
    closedAt: r.CLOSED_AT ?? null,
  };
}

export async function fetchICSessions(): Promise<ICSession[]> {
  await requireSession();
  const rows = await fetchAll<any>(SESSIONS_TABLE, 'ID,NAME,WAREHOUSE,STATUS,CREATED_BY,CREATED_AT,CLOSED_AT', ['ID']);
  return rows.map(mapSession).sort((a, b) => b.id - a.id);
}

/** Everything the Total Count / User Comparison / Record tabs need for one session. */
export async function fetchICSessionData(sessionId: number): Promise<ICSessionData> {
  await requireSession();
  const { data: sessionRow, error } = await bhs_supabase.from(SESSIONS_TABLE).select('*').eq('ID', sessionId).maybeSingle();
  if (error) throw new Error(`${SESSIONS_TABLE}: ${error.message}`);
  if (!sessionRow) throw new Error('This count session was not found.');

  const [stock, entries, users] = await Promise.all([
    fetchAll<any>(SESSION_STOCK_TABLE, 'LOT_ID,EXPECTED_QTY', ['LOT_ID'], { eq: ['SESSION_ID', sessionId] }),
    fetchAll<any>(ENTRIES_TABLE, 'ID,LOT_ID,COUNTED_QTY,COUNT_DETAILS,USER_ID,CREATED_AT', ['ID'], { eq: ['SESSION_ID', sessionId] }),
    fetchAll<any>('bhs_USERS', 'ID,NAME', ['ID']),
  ]);

  const expectedByLot = new Map<number, number>();
  for (const r of stock) expectedByLot.set(Number(r.LOT_ID), num(r.EXPECTED_QTY));
  const countedByLot = new Map<number, number>();
  for (const e of entries) countedByLot.set(Number(e.LOT_ID), (countedByLot.get(Number(e.LOT_ID)) ?? 0) + num(e.COUNTED_QTY));

  const lotIds = Array.from(new Set([...expectedByLot.keys(), ...countedByLot.keys()]));
  const lots = lotIds.length
    ? await fetchIn<any>(LOTS_TABLE, 'ID,PRODUCT_ID,LOT_NUMBER,EXPIRY_DATE', ['ID'], 'ID', lotIds)
    : [];
  const productIds = lots.map((l) => text(l.PRODUCT_ID)).filter(Boolean);
  const products = productIds.length
    ? await fetchIn<any>('bhs_PRODUCTS', '"PRODUCT ID","PRODUCT BARCODE","PRODUCT NAME"', ['PRODUCT ID'], 'PRODUCT ID', productIds)
    : [];
  const productById = new Map<string, any>(products.map((p): [string, any] => [text(p['PRODUCT ID']), p]));
  const userName = new Map<string, string>(users.map((u): [string, string] => [text(u.ID), text(u.NAME)]));

  const lotRows: ICLotRow[] = lots.map((l) => {
    const lotId = Number(l.ID);
    const product = productById.get(text(l.PRODUCT_ID));
    const expected = expectedByLot.get(lotId) ?? 0;
    const counted = countedByLot.get(lotId) ?? 0;
    return {
      lotId,
      productId: text(l.PRODUCT_ID),
      barcode: text(product?.['PRODUCT BARCODE']),
      productName: text(product?.['PRODUCT NAME']) || text(l.PRODUCT_ID),
      lotNumber: text(l.LOT_NUMBER),
      expiryDate: text(l.EXPIRY_DATE).slice(0, 10),
      expected,
      counted,
      variance: counted - expected,
    };
  });
  lotRows.sort((a, b) => a.productName.localeCompare(b.productName) || a.lotNumber.localeCompare(b.lotNumber));

  const entryRows: ICEntryRow[] = entries
    .map((e) => ({
      id: Number(e.ID),
      createdAt: e.CREATED_AT ?? null,
      userId: text(e.USER_ID),
      userName: userName.get(text(e.USER_ID)) || text(e.USER_ID) || 'Unknown',
      lotId: Number(e.LOT_ID),
      qty: num(e.COUNTED_QTY),
      details: text(e.COUNT_DETAILS),
    }))
    .sort((a, b) => b.id - a.id);

  return { session: mapSession(sessionRow), lots: lotRows, entries: entryRows };
}

/** Checks the entry exists and its count session is still open; returns the session id. */
async function assertEntryEditable(entryId: number): Promise<number> {
  const { data: entry, error } = await bhs_supabase.from(ENTRIES_TABLE).select('ID,SESSION_ID').eq('ID', entryId).maybeSingle();
  if (error) throw new Error(`${ENTRIES_TABLE}: ${error.message}`);
  if (!entry) throw new Error('This record was not found (it may have been deleted).');
  const sessionId = Number(entry.SESSION_ID);
  const { data: session, error: sErr } = await bhs_supabase.from(SESSIONS_TABLE).select('STATUS').eq('ID', sessionId).maybeSingle();
  if (sErr) throw new Error(`${SESSIONS_TABLE}: ${sErr.message}`);
  if (text(session?.STATUS).toUpperCase() === 'CLOSED') throw new Error('This count session is closed, its records can no longer be changed.');
  return sessionId;
}

/** Edits one count record (lot, counted qty, details). */
export async function updateICEntry(entryId: number, changes: { lotId: number; qty: number; details: string }): Promise<void> {
  await requireSession();
  const sessionId = await assertEntryEditable(entryId);
  if (!Number.isFinite(changes.qty)) throw new Error('Counted qty must be a number.');

  // the lot must belong to this session (in its stock or already counted in it)
  const [{ count: inStock }, { count: inEntries }] = await Promise.all([
    bhs_supabase.from(SESSION_STOCK_TABLE).select('LOT_ID', { count: 'exact', head: true }).eq('SESSION_ID', sessionId).eq('LOT_ID', changes.lotId),
    bhs_supabase.from(ENTRIES_TABLE).select('ID', { count: 'exact', head: true }).eq('SESSION_ID', sessionId).eq('LOT_ID', changes.lotId),
  ]);
  if (!inStock && !inEntries) throw new Error('The chosen lot is not part of this count session.');

  const { error } = await bhs_supabase
    .from(ENTRIES_TABLE)
    .update({ LOT_ID: changes.lotId, COUNTED_QTY: changes.qty, COUNT_DETAILS: changes.details.trim() })
    .eq('ID', entryId);
  if (error) throw new Error(`${ENTRIES_TABLE}: ${error.message}`);
}

/** Deletes one count record. */
export async function deleteICEntry(entryId: number): Promise<void> {
  await requireSession();
  await assertEntryEditable(entryId);
  const { error } = await bhs_supabase.from(ENTRIES_TABLE).delete().eq('ID', entryId);
  if (error) throw new Error(`${ENTRIES_TABLE}: ${error.message}`);
}
