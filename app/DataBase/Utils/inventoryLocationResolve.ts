import { isLocationRecordId } from '@/app/DataBase/Utils/LocationRecordIds';
import { normalizeLocation } from '@/app/InventoryAnalysis/Utils/locationTypes';

export type InventoryLocationLookupRow = {
  ID: string;
  'LOCATION NAME': string;
};

export type InventoryLocationLookup = {
  nameToId: Map<string, string>;
  idToName: Map<string, string>;
  names: string[];
};

export function buildInventoryLocationLookup(
  rows: InventoryLocationLookupRow[],
): InventoryLocationLookup {
  const nameToId = new Map<string, string>();
  const idToName = new Map<string, string>();

  rows.forEach((row) => {
    const id = String(row.ID || '').trim().toUpperCase();
    const name = normalizeLocation(String(row['LOCATION NAME'] || '').trim());
    if (!id || !name) return;
    idToName.set(id, name);
    nameToId.set(name, id);
    nameToId.set(name.toLowerCase(), id);
  });

  const names = [...new Set(rows.map((row) => normalizeLocation(String(row['LOCATION NAME'] || ''))))]
    .filter(Boolean)
    .sort((a, b) => {
      const key = (loc: string) => {
        const i = loc.lastIndexOf('/');
        return i === -1 ? loc : loc.slice(i + 1);
      };
      return key(a).localeCompare(key(b), undefined, { sensitivity: 'base' });
    });

  return { nameToId, idToName, names };
}

/** Resolve user/Excel input (name or LOC- ID) to registry ID for DB storage. */
export function resolveLocationToId(
  raw: string,
  lookup: InventoryLocationLookup,
): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return trimmed;

  if (isLocationRecordId(trimmed)) {
    const id = trimmed.toUpperCase();
    return lookup.idToName.has(id) ? id : null;
  }

  const normalized = normalizeLocation(trimmed);
  return lookup.nameToId.get(normalized) ?? lookup.nameToId.get(normalized.toLowerCase()) ?? null;
}

/** Resolve stored DB value (LOC- ID or legacy text) to display name. */
export function resolveLocationToName(
  raw: string,
  lookup: InventoryLocationLookup,
): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';

  if (isLocationRecordId(trimmed)) {
    return lookup.idToName.get(trimmed.toUpperCase()) ?? trimmed;
  }

  return normalizeLocation(trimmed);
}
