const clientCache = new Map<string, any>();

export async function fetchWithCache(url: string, options: any, cacheKeyArgs: any) {
  const cacheKey = JSON.stringify({ url, ...cacheKeyArgs });
  if (clientCache.has(cacheKey)) {
    const cachedData = clientCache.get(cacheKey);
    return {
      ok: true,
      json: async () => cachedData,
    };
  }

  const res = await fetch(url, options);
  if (!res.ok) return res;
  
  const clonedRes = res.clone();
  const json = await clonedRes.json();
  clientCache.set(cacheKey, json);
  
  return res;
}

export function invalidateClientCache() {
  clientCache.clear();
}
