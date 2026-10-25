'use server';

// Data Update — server actions.
//   Inventory: bhs_PRODUCTS."STOCK QUANTITY" = the uploaded quantity; every other product = 0.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import { DATA_SETS, DATA_UPDATE_SYSTEM_ID, idKey, round3, type DataSetId, type InventoryPreview } from '../Utils/DataUpdateTypes';

const PRODUCTS = 'bhs_PRODUCTS';
const ALL_SETS = DATA_SETS.map((d) => d.id);

function setsOf(user: SessionUserRecord): DataSetId[] {
  if (isAdminUser(user, DATA_UPDATE_SYSTEM_ID)) return [...ALL_SETS];
  const raw = String(user.role || '').trim();
  if (!raw) return [...ALL_SETS];
  let perms: Record<string, unknown>;
  try {
    perms = JSON.parse(raw);
  } catch {
    return [...ALL_SETS];
  }
  if (Array.isArray(perms.systems) && !perms.systems.includes(DATA_UPDATE_SYSTEM_ID)) return [];
  const list = perms[DATA_UPDATE_SYSTEM_ID];
  return Array.isArray(list) ? ALL_SETS.filter((id) => list.includes(id)) : [...ALL_SETS];
}

async function requireSet(id: DataSetId) {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (!setsOf(user).includes(id)) throw new UnauthorizedError("You don't have permission for this action.");
  return user;
}

/** Datasets the current user can update. */
export async function getAllowedDataSets(): Promise<DataSetId[]> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return setsOf(user);
}

type ProductRow = { id: any; name: string; stock: number; active: boolean };

async function allProducts(): Promise<ProductRow[]> {
  const db = getSupabaseAdmin();
  const rows: ProductRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(PRODUCTS).select('"PRODUCT ID", "PRODUCT NAME", "STOCK QUANTITY", IS_ACTIVE').order('PRODUCT ID').range(from, from + 999);
    if (error) throw new Error(error.message);
    (data || []).forEach((r: any) =>
      rows.push({ id: r['PRODUCT ID'], name: String(r['PRODUCT NAME'] || ''), stock: Number(r['STOCK QUANTITY']) || 0, active: r.IS_ACTIVE !== false }),
    );
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/** Products for the template (active ones, by name). */
export async function getInventoryTemplateProducts(): Promise<{ id: string; name: string }[]> {
  await requireSet('inventory');
  return (await allProducts())
    .filter((p) => p.active)
    .map((p) => ({ id: String(p.id), name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

/** What the upload will do (nothing is saved). */
export async function previewInventory(lines: { PRODUCT_ID: string; QTY: number; ROW: number }[]): Promise<InventoryPreview> {
  await requireSet('inventory');
  return plan(await allProducts(), lines).preview;
}

function plan(products: ProductRow[], lines: { PRODUCT_ID: string; QTY: number; ROW: number }[]) {
  const byKey = new Map(products.map((p) => [idKey(p.id), p]));
  const qty = new Map<string, number>(); // key -> qty (same product twice = added)
  const unknown: { row: number; id: string }[] = [];
  for (const l of Array.isArray(lines) ? lines : []) {
    const k = idKey(l?.PRODUCT_ID);
    if (!k) continue;
    if (!byKey.has(k)) {
      unknown.push({ row: Number(l.ROW) || 0, id: String(l.PRODUCT_ID) });
      continue;
    }
    qty.set(k, round3((qty.get(k) || 0) + (Number(l.QTY) || 0)));
  }
  const zero = products.filter((p) => !qty.has(idKey(p.id)) && p.stock !== 0);
  return {
    byKey,
    qty,
    zero,
    preview: {
      updated: qty.size,
      zeroed: zero.length,
      unknown,
      totalQty: round3(Array.from(qty.values()).reduce((s, v) => s + v, 0)),
    } as InventoryPreview,
  };
}

/** Saves the stock: the file's quantities, every other product = 0. */
export async function applyInventory(lines: { PRODUCT_ID: string; QTY: number; ROW: number }[]): Promise<InventoryPreview> {
  await requireSet('inventory');
  const products = await allProducts();
  const { byKey, qty, zero, preview } = plan(products, lines);
  if (!qty.size) throw new Error('No product in the file matches the products database');

  const db = getSupabaseAdmin();
  const chunks = <T,>(list: T[], n = 200) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

  // same quantity -> one update for many products
  const groups = new Map<number, any[]>();
  qty.forEach((v, k) => {
    const p = byKey.get(k)!;
    if (p.stock === v) return; // already right
    groups.set(v, [...(groups.get(v) || []), p.id]);
  });
  zero.forEach((p) => groups.set(0, [...(groups.get(0) || []), p.id]));

  for (const [value, ids] of groups) {
    for (const part of chunks(ids)) {
      const { error } = await db.from(PRODUCTS).update({ 'STOCK QUANTITY': value }).in('PRODUCT ID', part);
      if (error) throw new Error(error.message);
    }
  }
  return preview;
}
