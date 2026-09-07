import Dexie, { type Table } from 'dexie';

export interface IA_SyncMetadata {
  id: string;
  lastSyncAt: string | null;
  lastMoveCreatedAt: string | null;
  lastFullSyncAt: string | null;
  lastSyncedId: string | null;        // cursor for ID-based full sync
  fullSyncComplete: boolean;          // true once all 90k+ rows are loaded
}

export class InventoryAnalysisDB extends Dexie {
  moves!: Table<any, string>;
  products!: Table<any, string>;
  sync_metadata!: Table<IA_SyncMetadata, string>;

  constructor() {
    super('InventoryAnalysisDB');
    this.version(3).stores({
      moves: 'ID, DATE, CREATED_AT',
      products: 'ID',
      sync_metadata: 'id',
    });
  }
}

export const iaDb = new InventoryAnalysisDB();
