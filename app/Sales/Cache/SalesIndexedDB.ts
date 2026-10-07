import Dexie, { type Table } from 'dexie';

export interface SalesRecord {
  id?: number; // Auto-increment primary key for IndexedDB
  // Using generic any to support whatever structure getFilteredSalesData returns
  [key: string]: any;
}

export interface SyncMetadata {
  key: string;
  watermark: string; // ISO string of CREATED_AT
}

export class SalesDB extends Dexie {
  salesData!: Table<SalesRecord, number>;
  syncMeta!: Table<SyncMetadata, string>;

  constructor() {
    super('SalesCacheDB');
    this.version(1).stores({
      salesData: '++id, customerId, invoiceNumber, salesRep, invoiceDate, productTag, yr, mn', // Index fields we filter by
      syncMeta: 'key' // Store watermarks
    });
  }
}

export const db = new SalesDB();
