import {
  fetchAllICDetails,
  fetchArchivedAllICDetails,
  fetchArchivedICTotalCountData,
  fetchArchivedICUserComparisonData,
  fetchICTotalCountData,
  fetchICUserComparisonData,
  type ICRecord,
  type ICTotalCountItem,
  type ICUserComparisonRow,
} from '../Service/InventoryCountingService';

export type ICPrefetchBundle = {
  archiveKey: string;
  totalCount: {
    data: ICTotalCountItem[];
  };
  userComparison: {
    data: ICUserComparisonRow[];
    users: string[];
    normalRecords: ICRecord[];
    damageRecords: ICRecord[];
  };
  records: {
    data: ICRecord[];
  };
};

let cache: ICPrefetchBundle | null = null;
let inflight: Promise<ICPrefetchBundle> | null = null;

function archiveKeyOf(archiveId: string | null): string {
  return archiveId || '__live__';
}

export function peekICPrefetch(archiveId: string | null): ICPrefetchBundle | null {
  if (!cache) return null;
  if (cache.archiveKey !== archiveKeyOf(archiveId)) return null;
  return cache;
}

export function clearICPrefetch() {
  cache = null;
  inflight = null;
}

/** Prefetch main Inventory Counting payloads once for live/archive session. */
export async function prefetchICBootstrap(archiveId: string | null): Promise<ICPrefetchBundle> {
  const key = archiveKeyOf(archiveId);
  if (cache?.archiveKey === key) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const [totalRes, comparisonRes, recordsRes] = await Promise.all([
      archiveId ? fetchArchivedICTotalCountData(archiveId) : fetchICTotalCountData(),
      archiveId ? fetchArchivedICUserComparisonData(archiveId) : fetchICUserComparisonData(),
      archiveId ? fetchArchivedAllICDetails(archiveId) : fetchAllICDetails(),
    ]);

    if (!totalRes.success || !totalRes.data) {
      throw new Error(totalRes.error || 'Failed to prefetch total count');
    }
    if (!comparisonRes.success || !comparisonRes.data) {
      throw new Error(comparisonRes.error || 'Failed to prefetch user comparison');
    }
    if (!recordsRes.success || !recordsRes.data) {
      throw new Error(recordsRes.error || 'Failed to prefetch records');
    }

    const bundle: ICPrefetchBundle = {
      archiveKey: key,
      totalCount: { data: totalRes.data },
      userComparison: {
        data: comparisonRes.data,
        users: comparisonRes.users || [],
        normalRecords: comparisonRes.normalRecords || [],
        damageRecords: comparisonRes.damageRecords || [],
      },
      records: { data: recordsRes.data },
    };

    cache = bundle;
    return bundle;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
