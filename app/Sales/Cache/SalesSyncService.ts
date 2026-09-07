import { db } from './SalesIndexedDB';
import { getSalesWatermarkServer, getClientSalesData } from '../Service/sales_core_service';

/**
 * Initializes and syncs the IndexedDB with the latest Server Data.
 */
export async function syncAndGetSalesData(userId: string) {
  // 1. Get local watermark
  const meta = await db.syncMeta.get('sales_watermark');
  const localWatermark = meta?.watermark || '';

  // 2. Get server watermark
  const serverWatermark = await getSalesWatermarkServer();

  if (!serverWatermark) {
    console.log('⚠️ No server watermark found, using local IndexedDB if available.');
    return { success: true };
  }

  if (localWatermark === serverWatermark) {
    console.log('⚡ IndexedDB is up to date. Serving instantly.');
    return { success: true };
  }

  const count = await db.salesData.count();

  if (count === 0 || !localWatermark) {
    console.log('🔄 First load detected. Fetching FULL secure dataset from Server...');
    const fullData = await getClientSalesData(userId);
    if (fullData && fullData.length > 0) {
      await db.transaction('rw', db.salesData, async () => {
        await db.salesData.clear();
        await db.salesData.bulkAdd(fullData);
      });
      await db.syncMeta.put({ key: 'sales_watermark', watermark: serverWatermark });
      console.log(`✅ Inserted ${fullData.length} rows on first load into IndexedDB.`);
    }
  } else {
    console.log('🔄 Delta Sync: Fetching new rows since', localWatermark);
    const deltaRows = await getClientSalesData(userId, localWatermark);
    
    if (deltaRows && deltaRows.length > 0) {
      await db.transaction('rw', db.salesData, async () => {
        await db.salesData.bulkPut(deltaRows);
      });
      console.log(`✅ Inserted ${deltaRows.length} new rows via Delta Sync.`);
    }
    await db.syncMeta.put({ key: 'sales_watermark', watermark: serverWatermark });
  }

  return { success: true };
}

export async function getLocalSalesData() {
  return db.salesData.toArray();
}
