/**
 * locationTypes.ts
 *
 * Single source of truth for all warehouse/location classifications.
 * Used across inventory services and tab modules under app/InventoryAnalysis/.
 *
 * Logic:
 *  - INTERNAL → EXTERNAL  = Outflow  (-QTY)
 *  - EXTERNAL → INTERNAL  = Inflow   (+QTY)
 *  - INTERNAL → INTERNAL  = Transfer (0 net) — except water cluster ↔ other locations
 *  - SAME → SAME location = Data error (0 net, ignored)
 *
 * Water cluster (Water / Ahmed Magdy / Omer & Salam): transfers among these three = warehouse transfer (0 net).
 * Water ↔ Mazyad = internal transfer.
 * Water cluster ↔ other locations (except Mazyad) = normal inflow/outflow.
 * Mazyad ↔ S20 = internal transfer.
 */

const WA_WH_WATER = 'WA/WH/Water';
const MA_WH_MAZYAD = 'M/WH/Mazyad';

export const WATER_CLUSTER_LOCATIONS: string[] = [
  WA_WH_WATER,
  'WA/WH/Ahmed Magdy',
  'WA/WH/Omer & Salam',
];

const WATER_CLUSTER_LOCATIONS_SET = new Set(WATER_CLUSTER_LOCATIONS);

// Mazyad ↔ S20 — transfers between these two = internal (0 net).
const CORE_TRANSFER_WAREHOUSES: string[] = [
  'M/WH/Mazyad',
  'S/WH/S20',
];

const CORE_TRANSFER_WAREHOUSES_SET = new Set(CORE_TRANSFER_WAREHOUSES);

// ─── Internal Warehouses ───────────────────────────────────────────────────────
// These are the company's own storage locations.
// Any movement into these = stock increase (+QTY)
// Any movement out of these = stock decrease (-QTY)
export const INTERNAL_WAREHOUSES: string[] = [
  ...CORE_TRANSFER_WAREHOUSES,
  ...WATER_CLUSTER_LOCATIONS,
  'GM/WH/Game area',
  'HA/WH/Hashi',
];

export const INTERNAL_WAREHOUSES_SET = new Set(INTERNAL_WAREHOUSES);

function getLocationSortKey(loc: string): string {
  const slashIndex = loc.lastIndexOf('/');
  return slashIndex === -1 ? loc.trim() : loc.slice(slashIndex + 1).trim();
}

/** Internal warehouses sorted A–Z by display name (for dropdowns). */
export const INTERNAL_WAREHOUSES_SORTED: string[] = [...INTERNAL_WAREHOUSES].sort((a, b) =>
  getLocationSortKey(a).localeCompare(getLocationSortKey(b), undefined, { sensitivity: 'base' }),
);

// ─── External Inflow Sources ──────────────────────────────────────────────────
// Movements FROM these locations TO an internal warehouse = +QTY (stock inflow)
export const INFLOW_SOURCES: string[] = [
  'Partners/Vendors',                              // Purchase from supplier
  'Partners/Customers',                            // Customer return
  'Virtual Locations/Inventory adjustment',        // Inventory count adjustment (gain)
  'Virtual Locations/Production',                  // Finished goods from production
  'Physical Locations/Subcontracting Location',    // Return from subcontractor
];

// ─── External Outflow Destinations ────────────────────────────────────────────
// Movements FROM an internal warehouse TO these locations = -QTY (stock outflow)
export const OUTFLOW_DESTINATIONS: string[] = [
  'Partners/Customers',                            // Sale to customer
  'Partners/Vendors',                              // Return to supplier
  'Virtual Locations/Inventory adjustment',        // Inventory count adjustment (loss)
  'Virtual Locations/Production',                  // Raw materials into production
  'Physical Locations/Subcontracting Location',    // Sent to subcontractor
];

const CANONICAL_LOCATIONS: string[] = [
  ...INTERNAL_WAREHOUSES,
  ...INFLOW_SOURCES,
  ...OUTFLOW_DESTINATIONS,
];

const CANONICAL_LOCATION_BY_LOWER = new Map(
  CANONICAL_LOCATIONS.map((loc) => [loc.toLowerCase(), loc]),
);

/** Map known location spellings (e.g. M/WH/mazyad) to canonical names. */
export function normalizeLocation(loc: string): string {
  const trimmed = loc.trim();
  if (!trimmed) return trimmed;
  return CANONICAL_LOCATION_BY_LOWER.get(trimmed.toLowerCase()) ?? trimmed;
}

/** Same source and destination after normalization — treat as invalid; no stock effect. */
export function isSameLocationMove(locFrom: string, locTo: string): boolean {
  const from = normalizeLocation(locFrom);
  const to = normalizeLocation(locTo);
  return from !== '' && from === to;
}

export function isWaterClusterLocation(loc: string): boolean {
  return WATER_CLUSTER_LOCATIONS_SET.has(normalizeLocation(loc));
}

function isWaterMazyadTransfer(locFrom: string, locTo: string): boolean {
  const from = normalizeLocation(locFrom);
  const to = normalizeLocation(locTo);
  return (
    (from === WA_WH_WATER && to === MA_WH_MAZYAD) ||
    (from === MA_WH_MAZYAD && to === WA_WH_WATER)
  );
}

/** Transfers among Water / Ahmed Magdy / Omer & Salam (0 net on aggregate stock). */
export function isWaterClusterTransfer(locFrom: string, locTo: string): boolean {
  const from = normalizeLocation(locFrom);
  const to = normalizeLocation(locTo);
  if (isSameLocationMove(from, to)) return false;
  return isWaterClusterLocation(from) && isWaterClusterLocation(to);
}

/**
 * True when movement is an internal transfer (0 net effect on aggregate stock).
 * - Water ↔ Ahmed Magdy ↔ Omer & Salam = warehouse transfer
 * - Water ↔ Mazyad = transfer
 * - Mazyad ↔ S20 = transfer
 * - Other internal pairs (Mazyad↔Game, etc.) = transfer
 * - Water cluster ↔ other locations (except Mazyad) = NOT transfer (normal WH flow)
 */
export function isInternalTransfer(locFrom: string, locTo: string): boolean {
  const from = normalizeLocation(locFrom);
  const to = normalizeLocation(locTo);

  if (isSameLocationMove(from, to)) {
    return false;
  }

  if (isWaterMazyadTransfer(from, to)) {
    return true;
  }

  if (isWaterClusterLocation(from) && isWaterClusterLocation(to)) {
    return true;
  }

  const fromInternal = INTERNAL_WAREHOUSES_SET.has(from);
  const toInternal = INTERNAL_WAREHOUSES_SET.has(to);
  if (!fromInternal || !toInternal) return false;

  if (isWaterClusterLocation(from) || isWaterClusterLocation(to)) {
    return false;
  }

  const fromCore = CORE_TRANSFER_WAREHOUSES_SET.has(from);
  const toCore = CORE_TRANSFER_WAREHOUSES_SET.has(to);
  if (fromCore && toCore) return true;

  return true;
}

/**
 * Returns the net QTY effect on internal stock for a movement.
 *  +qty = stock increases
 *  -qty = stock decreases
 *   0   = no net change (transfer or unrecognized)
 */
export function getNetQtyEffect(locFrom: string, locTo: string, qty: number): number {
  const from = normalizeLocation(locFrom);
  const to = normalizeLocation(locTo);

  if (isSameLocationMove(from, to)) return 0;

  if (isInternalTransfer(from, to)) return 0;

  const fromInternal = INTERNAL_WAREHOUSES_SET.has(from);
  const toInternal   = INTERNAL_WAREHOUSES_SET.has(to);

  if (toInternal && !fromInternal)   return +qty;  // Inflow
  if (fromInternal && !toInternal)   return -qty;  // Outflow
  return 0;                                        // Water cluster↔other internal or unrecognized
}

export function getScopedQtyEffect(locFrom: string, locTo: string, qty: number, location?: string | null): number {
  const from = normalizeLocation(locFrom);
  const to = normalizeLocation(locTo);

  if (isSameLocationMove(from, to)) return 0;

  const scopedLocation = location ? normalizeLocation(location) : '';

  if (!scopedLocation) return getNetQtyEffect(from, to, qty);
  if (to === scopedLocation) return qty;
  if (from === scopedLocation) return -qty;
  return 0;
}

export function isMoveInLocationScope(locFrom: string, locTo: string, location?: string | null): boolean {
  const scopedLocation = location ? normalizeLocation(location) : '';
  if (!scopedLocation) return true;
  return normalizeLocation(locFrom) === scopedLocation || normalizeLocation(locTo) === scopedLocation;
}

/** Last path segment of a category tag (e.g. "A/B/C" → "C"). */
export function formatProductCategory(tag: string): string {
  if (!tag || tag === 'All' || tag === 'Uncategorized') return '';
  const trimmed = tag.trim();
  const slashIndex = trimmed.lastIndexOf('/');
  return slashIndex === -1 ? trimmed : trimmed.slice(slashIndex + 1).trim();
}
