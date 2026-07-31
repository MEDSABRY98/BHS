'use server';

import { bhs_supabas, fetchAllData } from '@/lib/supabase';
import {
  allocateLocationRecordIds,
  isLocationRecordId,
} from '@/app/DataBase/Utils/LocationRecordIds';
import {
  normalizeLocation,
  INTERNAL_WAREHOUSES,
  WATER_CLUSTER_LOCATIONS,
  INFLOW_SOURCES,
  OUTFLOW_DESTINATIONS,
} from '../Utils/locationTypes';

const LOCATIONS_TABLE = 'web_INVENTORY_LOCATIONS';
const MOVES_TABLE = 'web_INVENTORY_MOVES';

export type InventoryLocationType =
  | 'internal'
  | 'internal_water_cluster'
  | 'internal_core'
  | 'inflow'
  | 'outflow'
  | 'external';

export interface InventoryLocationRow {
  ID: string;
  'LOCATION NAME': string;
  'LOCATION TYPE': InventoryLocationType;
}

function getLocationSortKey(loc: string): string {
  const slashIndex = loc.lastIndexOf('/');
  return slashIndex === -1 ? loc.trim() : loc.slice(slashIndex + 1).trim();
}

const INTERNAL_CORE_LOCATIONS = new Set([
  'M/WH/Mazyad',
  'S/WH/S20',
  'GM/WH/Game area',
  'HA/WH/Hashi',
]);

const WATER_CLUSTER_SET = new Set(WATER_CLUSTER_LOCATIONS.map(normalizeLocation));
const INFLOW_SET = new Set(INFLOW_SOURCES.map(normalizeLocation));
const OUTFLOW_SET = new Set(OUTFLOW_DESTINATIONS.map(normalizeLocation));

function getCanonicalLocationNames(): string[] {
  const merged = [
    ...INTERNAL_WAREHOUSES,
    ...INFLOW_SOURCES,
    ...OUTFLOW_DESTINATIONS,
  ];
  const byLower = new Map<string, string>();
  merged.forEach((name) => {
    const canonical = normalizeLocation(name);
    if (canonical) byLower.set(canonical.toLowerCase(), canonical);
  });
  return [...byLower.values()];
}

function assignLocationType(locationName: string): InventoryLocationType {
  const canonical = normalizeLocation(locationName);
  if (WATER_CLUSTER_SET.has(canonical)) return 'internal_water_cluster';
  if (INTERNAL_CORE_LOCATIONS.has(canonical)) return 'internal_core';

  const inInflow = INFLOW_SET.has(canonical);
  const inOutflow = OUTFLOW_SET.has(canonical);
  if (inInflow && !inOutflow) return 'inflow';
  if (inOutflow && !inInflow) return 'outflow';
  if (inInflow && inOutflow) return 'external';

  if (INTERNAL_WAREHOUSES.map(normalizeLocation).includes(canonical)) {
    return 'internal';
  }

  return 'external';
}

async function collectDistinctLocationNamesFromMoves(): Promise<string[]> {
  const names = new Set<string>();

  const rows = await fetchAllData(() =>
    bhs_supabas.from(MOVES_TABLE).select('"LOCATION FROM", "LOCATION TO"'),
  );

  rows.forEach((row: Record<string, unknown>) => {
    const from = String(row['LOCATION FROM'] ?? '').trim();
    const to = String(row['LOCATION TO'] ?? '').trim();
    if (from && !isLocationRecordId(from)) names.add(normalizeLocation(from));
    if (to && !isLocationRecordId(to)) names.add(normalizeLocation(to));
  });

  return [...names];
}

function buildSeedLocationList(): string[] {
  const byLower = new Map<string, string>();

  getCanonicalLocationNames().forEach((name) => {
    const canonical = normalizeLocation(name);
    if (canonical) byLower.set(canonical.toLowerCase(), canonical);
  });

  return [...byLower.values()].sort((a, b) =>
    getLocationSortKey(a).localeCompare(getLocationSortKey(b), undefined, { sensitivity: 'base' }),
  );
}

export async function seedInventoryLocationsFromData(): Promise<{
  success: boolean;
  inserted: number;
  skipped: number;
  total: number;
  discoveredInMoves: number;
  error?: string;
  tableMissing?: boolean;
}> {
  try {
    const moveNames = await collectDistinctLocationNamesFromMoves();
    const discoveredInMoves = moveNames.length;
    const byLower = new Map<string, string>();

    buildSeedLocationList().forEach((name) => {
      byLower.set(name.toLowerCase(), name);
    });
    moveNames.forEach((name) => {
      if (name) byLower.set(name.toLowerCase(), name);
    });

    const sortedNames = [...byLower.values()].sort((a, b) =>
      getLocationSortKey(a).localeCompare(getLocationSortKey(b), undefined, { sensitivity: 'base' }),
    );

    if (sortedNames.length === 0) {
      return {
        success: false,
        inserted: 0,
        skipped: 0,
        total: 0,
        discoveredInMoves: 0,
        error: 'No location names found in inventory moves or canonical list.',
      };
    }

    let existingRows: { 'LOCATION NAME'?: string }[] = [];
    try {
      const { data, error: existingError } = await bhs_supabas
        .from(LOCATIONS_TABLE)
        .select('"LOCATION NAME"');
      if (existingError) throw existingError;
      existingRows = data || [];
    } catch (error) {
      if (isMissingTableError(error)) {
        return {
          success: false,
          inserted: 0,
          skipped: 0,
          total: sortedNames.length,
          discoveredInMoves,
          tableMissing: true,
          error: 'Table web_INVENTORY_LOCATIONS does not exist. Run inventory_locations_table.sql in Supabase first.',
        };
      }
      throw error;
    }

    const existingNames = new Set(
      existingRows.map((row) => String(row['LOCATION NAME'] || '').trim().toLowerCase()),
    );

    const toInsert = sortedNames.filter((name) => !existingNames.has(name.toLowerCase()));
    if (toInsert.length === 0) {
      return {
        success: true,
        inserted: 0,
        skipped: sortedNames.length,
        total: sortedNames.length,
        discoveredInMoves,
      };
    }

    const ids = await allocateLocationRecordIds(toInsert.length);
    const payload: InventoryLocationRow[] = toInsert.map((name, index) => ({
      ID: ids[index],
      'LOCATION NAME': name,
      'LOCATION TYPE': assignLocationType(name),
    }));

    const chunkSize = 200;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const { error } = await bhs_supabas.from(LOCATIONS_TABLE).insert(chunk);
      if (error) throw error;
    }

    return {
      success: true,
      inserted: toInsert.length,
      skipped: sortedNames.length - toInsert.length,
      total: sortedNames.length,
      discoveredInMoves,
    };
  } catch (error) {
    console.error('seedInventoryLocationsFromData:', error);
    return {
      success: false,
      inserted: 0,
      skipped: 0,
      total: 0,
      discoveredInMoves: 0,
      error: error instanceof Error ? error.message : 'Failed to seed locations',
    };
  }
}

export async function migrateInventoryMovesToLocationIds(): Promise<{
  success: boolean;
  updated: number;
  skipped: number;
  unmapped: string[];
  error?: string;
}> {
  try {
    const locRows = await fetchAllData(() =>
      bhs_supabas.from(LOCATIONS_TABLE).select('ID, "LOCATION NAME"'),
    );
    if (locRows.length === 0) {
      return {
        success: false,
        updated: 0,
        skipped: 0,
        unmapped: [],
        error: 'No locations found in web_INVENTORY_LOCATIONS.',
      };
    }

    const nameToId = new Map<string, string>();
    locRows.forEach((row: Record<string, unknown>) => {
      const id = String(row.ID || '').trim();
      const name = String(row['LOCATION NAME'] || '').trim();
      if (!id || !name) return;
      nameToId.set(name, id);
      nameToId.set(normalizeLocation(name), id);
    });

    const distinctFrom = await fetchAllData(() =>
      bhs_supabas.from(MOVES_TABLE).select('"LOCATION FROM"'),
    );
    const distinctTo = await fetchAllData(() =>
      bhs_supabas.from(MOVES_TABLE).select('"LOCATION TO"'),
    );

    const textNames = new Set<string>();
    [...distinctFrom, ...distinctTo].forEach((row: Record<string, unknown>) => {
      const from = String(row['LOCATION FROM'] ?? '').trim();
      const to = String(row['LOCATION TO'] ?? '').trim();
      if (from && !isLocationRecordId(from)) textNames.add(from);
      if (to && !isLocationRecordId(to)) textNames.add(to);
    });

    const unmapped = [...textNames].filter((name) => {
      const normalized = normalizeLocation(name);
      return !nameToId.has(name) && !nameToId.has(normalized);
    });

    if (unmapped.length > 0) {
      return {
        success: false,
        updated: 0,
        skipped: 0,
        unmapped: unmapped.sort((a, b) =>
          getLocationSortKey(a).localeCompare(getLocationSortKey(b), undefined, { sensitivity: 'base' }),
        ),
        error: `${unmapped.length} location name(s) could not be mapped to LOC- IDs.`,
      };
    }

    let updated = 0;

    for (const name of textNames) {
      const id = nameToId.get(name) ?? nameToId.get(normalizeLocation(name));
      if (!id) continue;

      const fromResult = await bhs_supabas
        .from(MOVES_TABLE)
        .update({ 'LOCATION FROM': id })
        .eq('LOCATION FROM', name);
      if (fromResult.error) throw fromResult.error;

      const toResult = await bhs_supabas
        .from(MOVES_TABLE)
        .update({ 'LOCATION TO': id })
        .eq('LOCATION TO', name);
      if (toResult.error) throw toResult.error;
    }

    updated = textNames.size;

    return { success: true, updated, skipped: 0, unmapped: [] };
  } catch (error) {
    console.error('migrateInventoryMovesToLocationIds:', error);
    return {
      success: false,
      updated: 0,
      skipped: 0,
      unmapped: [],
      error: error instanceof Error ? error.message : 'Failed to migrate moves',
    };
  }
}

function isMissingTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /does not exist|42P01|Could not find the table|schema cache/i.test(message);
}

export async function countDistinctLocationNamesInMoves(): Promise<number> {
  const names = await collectDistinctLocationNamesFromMoves();
  return names.length;
}

export async function fetchInventoryLocations(): Promise<{
  rows: InventoryLocationRow[];
  tableReady: boolean;
}> {
  try {
    const rows = await fetchAllData(() =>
      bhs_supabas
        .from(LOCATIONS_TABLE)
        .select('ID, "LOCATION NAME", "LOCATION TYPE"')
        .order('ID', { ascending: true }),
    );
    return { rows: rows as InventoryLocationRow[], tableReady: true };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { rows: [], tableReady: false };
    }
    throw error;
  }
}

export async function createInventoryLocation(input: {
  locationName: string;
  locationType?: InventoryLocationType;
}): Promise<{ success: boolean; row?: InventoryLocationRow; error?: string }> {
  try {
    const name = normalizeLocation(String(input.locationName || '').trim());
    if (!name) {
      return { success: false, error: 'Location name is required.' };
    }

    const { data: existingRows, error: existingError } = await bhs_supabas
      .from(LOCATIONS_TABLE)
      .select('ID, "LOCATION NAME"');
    if (existingError) throw existingError;
    const duplicate = (existingRows || []).find(
      (row) => String(row['LOCATION NAME'] || '').trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      return { success: false, error: `Location "${name}" already exists (${duplicate.ID}).` };
    }

    const [id] = await allocateLocationRecordIds(1);
    const row: InventoryLocationRow = {
      ID: id,
      'LOCATION NAME': name,
      'LOCATION TYPE': input.locationType ?? assignLocationType(name),
    };

    const { error } = await bhs_supabas.from(LOCATIONS_TABLE).insert(row);
    if (error) throw error;

    return { success: true, row };
  } catch (error) {
    console.error('createInventoryLocation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add location',
    };
  }
}

export async function updateInventoryLocationName(
  id: string,
  locationName: string,
): Promise<{ success: boolean; row?: InventoryLocationRow; error?: string }> {
  try {
    const recordId = String(id || '').trim();
    if (!recordId) {
      return { success: false, error: 'Location ID is required.' };
    }

    const name = normalizeLocation(String(locationName || '').trim());
    if (!name) {
      return { success: false, error: 'Location name is required.' };
    }

    const { data: existingRows, error: dupError } = await bhs_supabas
      .from(LOCATIONS_TABLE)
      .select('ID, "LOCATION NAME"');
    if (dupError) throw dupError;
    const duplicate = (existingRows || []).find(
      (row) =>
        row.ID !== recordId &&
        String(row['LOCATION NAME'] || '').trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      return { success: false, error: `Location name "${name}" is already used by ${duplicate.ID}.` };
    }

    const locationType = assignLocationType(name);
    const { data, error } = await bhs_supabas
      .from(LOCATIONS_TABLE)
      .update({ 'LOCATION NAME': name, 'LOCATION TYPE': locationType })
      .eq('ID', recordId)
      .select('ID, "LOCATION NAME", "LOCATION TYPE"')
      .single();
    if (error) throw error;

    return { success: true, row: data as InventoryLocationRow };
  } catch (error) {
    console.error('updateInventoryLocationName:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update location',
    };
  }
}
