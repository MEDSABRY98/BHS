/**
 * locationTypes.ts
 *
 * Single source of truth for all warehouse/location classifications.
 * Used across inventory services and components to determine stock in/out flow.
 *
 * Logic:
 *  - INTERNAL → EXTERNAL  = Outflow  (-QTY)
 *  - EXTERNAL → INTERNAL  = Inflow   (+QTY)
 *  - INTERNAL → INTERNAL  = Transfer (0 net) — except Water ↔ Game/Hashi (normal WH flow)
 *
 * Core transfer triangle (Mazyad / S20 / Water): movements among these three = internal transfer.
 * Water with any other location (Game area, Hashi, vendors, etc.) = normal inflow/outflow.
 */

export const WA_WH_WATER = 'WA/WH/Water';

// Mazyad, S20, and Water — transfers among these three only = internal (0 net).
export const CORE_TRANSFER_WAREHOUSES: string[] = [
  'M/WH/Mazyad',
  'S/WH/S20',
  WA_WH_WATER,
];

export const CORE_TRANSFER_WAREHOUSES_SET = new Set(CORE_TRANSFER_WAREHOUSES);

// ─── Internal Warehouses ───────────────────────────────────────────────────────
// These are the company's own storage locations.
// Any movement into these = stock increase (+QTY)
// Any movement out of these = stock decrease (-QTY)
export const INTERNAL_WAREHOUSES: string[] = [
  ...CORE_TRANSFER_WAREHOUSES,
  'GM/WH/Game area',
  'HA/WH/Hashi',
  'WA/WH/Ahmed Magdy',
  'WA/WH/Omer & Salam',
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

// ─── Movement Type Classifier ─────────────────────────────────────────────────
export type MovementType =
  | 'purchase'          // Vendor → Internal
  | 'vendor_return'     // Internal → Vendor
  | 'sale'              // Internal → Customer
  | 'customer_return'   // Customer → Internal
  | 'production_in'     // Production → Internal (finished goods)
  | 'production_out'    // Internal → Production (raw materials)
  | 'subcontracting_in' // Subcontracting → Internal
  | 'subcontracting_out'// Internal → Subcontracting
  | 'adjustment_in'     // Inventory Adjustment → Internal (count gain)
  | 'adjustment_out'    // Internal → Inventory Adjustment (count loss)
  | 'transfer'          // Internal → Internal (no net change)
  | 'other';            // Unrecognized movement

/**
 * True when movement is an internal transfer (0 net effect on aggregate stock).
 * - Mazyad ↔ S20 ↔ Water = transfer
 * - Other internal pairs (Mazyad↔Game, etc.) = transfer
 * - Water ↔ Game area / Hashi / external = NOT transfer (normal WH flow)
 */
export function isInternalTransfer(locFrom: string, locTo: string): boolean {
  const from = locFrom.trim();
  const to = locTo.trim();

  const fromInternal = INTERNAL_WAREHOUSES_SET.has(from);
  const toInternal = INTERNAL_WAREHOUSES_SET.has(to);
  if (!fromInternal || !toInternal) return false;

  const fromCore = CORE_TRANSFER_WAREHOUSES_SET.has(from);
  const toCore = CORE_TRANSFER_WAREHOUSES_SET.has(to);

  if (fromCore && toCore) return true;

  if (from === WA_WH_WATER || to === WA_WH_WATER) return false;

  return true;
}

/**
 * Classifies a movement based on source and destination locations.
 */
export function classifyMovement(locFrom: string, locTo: string): MovementType {
  const from = locFrom.trim();
  const to   = locTo.trim();

  if (isInternalTransfer(from, to)) return 'transfer';

  const fromInternal = INTERNAL_WAREHOUSES_SET.has(from);
  const toInternal   = INTERNAL_WAREHOUSES_SET.has(to);

  if (fromInternal && toInternal) {
    if (from === WA_WH_WATER) return 'production_out';
    if (to === WA_WH_WATER) return 'production_in';
  }

  if (from === 'Partners/Vendors'                            && toInternal)        return 'purchase';
  if (fromInternal && to === 'Partners/Vendors')                                   return 'vendor_return';
  if (fromInternal && to === 'Partners/Customers')                                 return 'sale';
  if (from === 'Partners/Customers'                          && toInternal)        return 'customer_return';
  if (from === 'Virtual Locations/Production'                && toInternal)        return 'production_in';
  if (fromInternal && to === 'Virtual Locations/Production')                       return 'production_out';
  if (from === 'Physical Locations/Subcontracting Location'  && toInternal)        return 'subcontracting_in';
  if (fromInternal && to === 'Physical Locations/Subcontracting Location')         return 'subcontracting_out';
  if (from === 'Virtual Locations/Inventory adjustment'      && toInternal)        return 'adjustment_in';
  if (fromInternal && to === 'Virtual Locations/Inventory adjustment')             return 'adjustment_out';

  return 'other';
}

/**
 * Returns the net QTY effect on internal stock for a movement.
 *  +qty = stock increases
 *  -qty = stock decreases
 *   0   = no net change (transfer or unrecognized)
 */
export function getNetQtyEffect(locFrom: string, locTo: string, qty: number): number {
  const from = locFrom.trim();
  const to   = locTo.trim();

  if (isInternalTransfer(from, to)) return 0;

  const fromInternal = INTERNAL_WAREHOUSES_SET.has(from);
  const toInternal   = INTERNAL_WAREHOUSES_SET.has(to);

  if (toInternal && !fromInternal)   return +qty;  // Inflow
  if (fromInternal && !toInternal)   return -qty;  // Outflow
  return 0;                                        // Water↔Game/Hashi or unrecognized
}

export function getScopedQtyEffect(locFrom: string, locTo: string, qty: number, location?: string | null): number {
  const from = locFrom.trim();
  const to = locTo.trim();
  const scopedLocation = location?.trim();

  if (!scopedLocation) return getNetQtyEffect(from, to, qty);
  if (to === scopedLocation) return qty;
  if (from === scopedLocation) return -qty;
  return 0;
}

export function isMoveInLocationScope(locFrom: string, locTo: string, location?: string | null): boolean {
  const scopedLocation = location?.trim();
  if (!scopedLocation) return true;
  return locFrom.trim() === scopedLocation || locTo.trim() === scopedLocation;
}

/**
 * Human-readable label for each movement type.
 */
export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  purchase:           'Purchase',
  vendor_return:      'Return to Vendor',
  sale:               'Sale',
  customer_return:    'Customer Return',
  production_in:      'Production In',
  production_out:     'Production Out',
  subcontracting_in:  'Subcontracting In',
  subcontracting_out: 'Subcontracting Out',
  adjustment_in:      'Inventory Adjustment (+)',
  adjustment_out:     'Inventory Adjustment (-)',
  transfer:           'Internal Transfer',
  other:              'Other',
};

/** Last path segment of a category tag (e.g. "A/B/C" → "C"). */
export function formatProductCategory(tag: string): string {
  if (!tag || tag === 'All' || tag === 'Uncategorized') return '';
  const trimmed = tag.trim();
  const slashIndex = trimmed.lastIndexOf('/');
  return slashIndex === -1 ? trimmed : trimmed.slice(slashIndex + 1).trim();
}
