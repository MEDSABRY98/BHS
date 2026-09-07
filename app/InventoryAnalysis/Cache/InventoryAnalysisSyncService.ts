import { iaDb } from './InventoryAnalysisIndexedDB';
import { fetchInventoryMovesDelta, fetchRawInventoryProducts } from '../Service/inventory_service';
import { bhs_supabase } from '@/lib/supabase';

let isSyncing = false;
const SYNC_META_ID = 'main';
const PAGE_SIZE = 5000;

/**
 * Fetches a page of moves by ID cursor (no CREATED_AT dependency).
 * Used for the initial full sync.
 */
async function fetchMovesPageById(lastId: string | null): Promise<any[]> {
  const SELECT = 'ID,DATE,REFERENCE,"LOCATION FROM","LOCATION TO","PRODUCT ID",QTY,CREATED_AT';
  let query = bhs_supabase
    .from('web_INVENTORY_MOVES')
    .select(SELECT)
    .order('ID', { ascending: true })
    .limit(PAGE_SIZE);

  if (lastId) {
    query = query.gt('ID', lastId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function syncInventoryAnalysisData(): Promise<boolean> {
  if (isSyncing) return false;
  isSyncing = true;

  try {
    let meta = await iaDb.sync_metadata.get(SYNC_META_ID);
    if (!meta) {
      meta = {
        id: SYNC_META_ID,
        lastSyncAt: null,
        lastMoveCreatedAt: null,
        lastFullSyncAt: null,
        lastSyncedId: null,
        fullSyncComplete: false,
      };
    }

    // ── PHASE 1: Full ID-cursor sync (runs until all rows are loaded) ─────────
    if (!meta.fullSyncComplete) {
      console.log('[IA Cache] Starting full sync from ID:', meta.lastSyncedId ?? 'beginning');
      let pagesLoaded = 0;

      while (true) {
        const page = await fetchMovesPageById(meta.lastSyncedId);
        if (!page || page.length === 0) break;

        await iaDb.moves.bulkPut(page);
        meta.lastSyncedId = String(page[page.length - 1].ID ?? '');

        // Track highest CREATED_AT seen for future delta syncs
        const highestCat = page.reduce((max, m) => {
          if (!m.CREATED_AT) return max;
          return m.CREATED_AT > max ? m.CREATED_AT : max;
        }, meta.lastMoveCreatedAt || '');
        meta.lastMoveCreatedAt = highestCat;

        pagesLoaded++;
        if (page.length < PAGE_SIZE) break; // last page

        // Save progress after every page so we can resume if interrupted
        meta.lastSyncAt = new Date().toISOString();
        await iaDb.sync_metadata.put(meta);
      }

      meta.fullSyncComplete = true;
      meta.lastFullSyncAt = new Date().toISOString();
      console.log(`[IA Cache] Full sync complete. Pages loaded: ${pagesLoaded}`);
    }

    // ── PHASE 2: Delta sync for new rows (CREATED_AT > last watermark) ────────
    else if (meta.lastMoveCreatedAt) {
      const newMoves = await fetchInventoryMovesDelta(meta.lastMoveCreatedAt);
      if (newMoves && newMoves.length > 0) {
        await iaDb.moves.bulkPut(newMoves);
        const highest = newMoves.reduce((max, m) => {
          if (!m.CREATED_AT) return max;
          return m.CREATED_AT > max ? m.CREATED_AT : max;
        }, meta.lastMoveCreatedAt);
        meta.lastMoveCreatedAt = highest;
        console.log(`[IA Cache] Delta sync: ${newMoves.length} new moves`);
      }
    }

    // ── PHASE 3: Always refresh Products (small table) ────────────────────────
    const products = await fetchRawInventoryProducts();
    if (products && products.length > 0) {
      await iaDb.products.clear();
      await iaDb.products.bulkAdd(products);
    }

    meta.lastSyncAt = new Date().toISOString();
    await iaDb.sync_metadata.put(meta);
    return true;
  } catch (error) {
    console.error('[IA Cache] Sync failed:', error);
    return false;
  } finally {
    isSyncing = false;
  }
}

export async function clearInventoryAnalysisCache() {
  await iaDb.moves.clear();
  await iaDb.products.clear();
  await iaDb.sync_metadata.clear();
}


