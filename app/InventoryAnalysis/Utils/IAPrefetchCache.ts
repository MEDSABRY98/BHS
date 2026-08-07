import {
  getInternalWarehouseLocationOptions,
  getInventoryProductsForReports,
  getLocationPeriodMovements,
  getProductOrdersData,
  getProductsBalanceReportData,
} from '../Service/inventory_service';
import type {
  InventoryReportProduct,
  LocationMovementRow,
  ProductBalanceRow,
} from '../Service/inventory_types';

export type IAProductOrderRow = {
  productId: string;
  barcode: string;
  productName: string;
  tags: string;
  qty: number;
  salesQty?: number;
  salesBreakdown?: { label: string; qty: number }[];
};

export type IAPrefetchBundle = {
  productsBalance: ProductBalanceRow[];
  locations: string[];
  /** Filled in background after first paint */
  locationMovements?: {
    location: string;
    data: LocationMovementRow[];
  };
  /** Filled in background after first paint */
  productOrders?: IAProductOrderRow[];
  /** Filled in background after first paint */
  reportProducts?: InventoryReportProduct[];
};

let cache: IAPrefetchBundle | null = null;
let inflight: Promise<IAPrefetchBundle> | null = null;
let warmGeneration = 0;

export function peekIAPrefetch(): IAPrefetchBundle | null {
  return cache;
}

export function clearIAPrefetch() {
  cache = null;
  inflight = null;
  warmGeneration += 1;
}

async function warmIASecondaryTabs(generation: number, locations: string[]) {
  const firstLocation = locations[0] || '';

  try {
    const [ordersRes, reportsRes, movesRes] = await Promise.all([
      getProductOrdersData(),
      getInventoryProductsForReports(),
      firstLocation
        ? getLocationPeriodMovements({ location: firstLocation })
        : Promise.resolve({ success: true as const, data: [] as LocationMovementRow[] }),
    ]);

    if (generation !== warmGeneration || !cache) return;

    cache = {
      ...cache,
      productOrders: ordersRes.success && ordersRes.data ? (ordersRes.data as IAProductOrderRow[]) : cache.productOrders,
      reportProducts: reportsRes.success && reportsRes.data ? reportsRes.data : cache.reportProducts,
      locationMovements:
        firstLocation && movesRes.success && movesRes.data
          ? { location: firstLocation, data: movesRes.data }
          : cache.locationMovements,
    };
  } catch (e) {
    console.error('Inventory Analysis secondary prefetch failed', e);
  }
}

/**
 * Prefetch default-tab payloads (Products Balance + locations), then reveal UI.
 * Other tabs warm in the background into the same cache.
 */
export async function prefetchIABootstrap(): Promise<IAPrefetchBundle> {
  if (cache?.productsBalance) return cache;
  if (inflight) return inflight;

  const generation = warmGeneration;

  inflight = (async () => {
    const [balanceRes, locationsRes] = await Promise.all([
      getProductsBalanceReportData(),
      getInternalWarehouseLocationOptions(),
    ]);

    if (!balanceRes.success || !balanceRes.data) {
      throw new Error(balanceRes.error || 'Failed to prefetch products balance');
    }

    const locations = locationsRes.data?.length ? locationsRes.data : [];

    const bundle: IAPrefetchBundle = {
      productsBalance: balanceRes.data,
      locations,
    };

    cache = bundle;

    if (generation === warmGeneration) {
      void warmIASecondaryTabs(generation, locations);
    }

    return bundle;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
