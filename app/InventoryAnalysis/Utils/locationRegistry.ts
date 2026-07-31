import { isLocationRecordId } from '@/app/DataBase/Utils/LocationRecordIds';
import { normalizeLocation } from './locationTypes';
import type { InventoryLocationRow, InventoryLocationType } from '../Service/location_service';

const INTERNAL_TYPES = new Set<InventoryLocationType>([
  'internal',
  'internal_water_cluster',
  'internal_core',
]);

const CUSTOMERS_NAME = 'Partners/Customers';
const VENDORS_NAME = 'Partners/Vendors';

export type LocationRegistry = {
  rows: InventoryLocationRow[];
  idToName: Map<string, string>;
  nameToId: Map<string, string>;
  internalWarehouseNames: string[];
  customersLocationId: string;
  customersLocationName: string;
  vendorsLocationId: string;
  vendorsLocationName: string;
};

function getLocationSortKey(loc: string): string {
  const slashIndex = loc.lastIndexOf('/');
  return slashIndex === -1 ? loc.trim() : loc.slice(slashIndex + 1).trim();
}

function findRegistryIdByName(rows: InventoryLocationRow[], canonicalName: string): string {
  const target = normalizeLocation(canonicalName).toLowerCase();
  const match = rows.find(
    (row) => normalizeLocation(String(row['LOCATION NAME'] || '')).toLowerCase() === target,
  );
  return match?.ID ?? '';
}

export function buildLocationRegistry(rows: InventoryLocationRow[]): LocationRegistry {
  const idToName = new Map<string, string>();
  const nameToId = new Map<string, string>();

  rows.forEach((row) => {
    const id = String(row.ID || '').trim().toUpperCase();
    const name = normalizeLocation(String(row['LOCATION NAME'] || '').trim());
    if (!id || !name) return;
    idToName.set(id, name);
    nameToId.set(name, id);
    nameToId.set(name.toLowerCase(), id);
  });

  const internalWarehouseNames = rows
    .filter((row) => INTERNAL_TYPES.has(row['LOCATION TYPE']))
    .map((row) => normalizeLocation(String(row['LOCATION NAME'] || '')))
    .filter(Boolean)
    .sort((a, b) =>
      getLocationSortKey(a).localeCompare(getLocationSortKey(b), undefined, { sensitivity: 'base' }),
    );

  return {
    rows,
    idToName,
    nameToId,
    internalWarehouseNames,
    customersLocationId: findRegistryIdByName(rows, CUSTOMERS_NAME),
    customersLocationName: CUSTOMERS_NAME,
    vendorsLocationId: findRegistryIdByName(rows, VENDORS_NAME),
    vendorsLocationName: VENDORS_NAME,
  };
}

/** Resolve LOC- ID or legacy text to canonical location name for classification. */
export function resolveLocationName(raw: string, registry: LocationRegistry): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';

  if (isLocationRecordId(trimmed)) {
    const name = registry.idToName.get(trimmed.toUpperCase());
    if (name) return normalizeLocation(name);
  }

  return normalizeLocation(trimmed);
}

/** Resolve dropdown/filter value (name or LOC- ID) to registry ID for DB filters. */
export function resolveLocationId(raw: string, registry: LocationRegistry): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;

  if (isLocationRecordId(trimmed)) {
    const id = trimmed.toUpperCase();
    return registry.idToName.has(id) ? id : null;
  }

  const canonical = normalizeLocation(trimmed);
  return registry.nameToId.get(canonical) ?? registry.nameToId.get(canonical.toLowerCase()) ?? null;
}

export function matchesCanonicalLocation(
  raw: string,
  canonicalName: string,
  registry: LocationRegistry,
): boolean {
  return resolveLocationName(raw, registry) === normalizeLocation(canonicalName);
}
