// Invoices Tracking keeps the order and its delivery in ONE row (mix_INVOICES_TRACKING).
// The screens still read the delivery as its own object (`deliveries[0]`), built here from the row.

export const TRACKING_TABLE = 'mix_INVOICES_TRACKING';

/** Delivery fields as the screens use them -> column in mix_INVOICES_TRACKING. */
const DELIVERY_COLUMNS: Record<string, string> = {
  DRIVERS_NAME: 'DRIVERS_NAME',
  STATUS: 'DELIVERY_STATUS', // the order has its own STATUS
  DISPATCH_TIME: 'DISPATCH_TIME',
  DELIVERY_TIME: 'DELIVERY_TIME',
  OFFICE_HANDOVER_ID: 'OFFICE_HANDOVER_ID',
  OFFICE_HANDOVER_STATUS: 'OFFICE_HANDOVER_STATUS',
  OFFICE_HANDOVER_TIME: 'OFFICE_HANDOVER_TIME',
  TRACKING_NOTES: 'TRACKING_NOTES',
};

export type Delivery = {
  ID: string; // = the order row ID
  ORDER_ID: string;
  DRIVERS_NAME: string | null;
  STATUS: string | null;
  DISPATCH_TIME: string | null;
  DELIVERY_TIME: string | null;
  OFFICE_HANDOVER_ID: string | null;
  OFFICE_HANDOVER_STATUS: string | null;
  OFFICE_HANDOVER_TIME: string | null;
  TRACKING_NOTES: string | null;
};

/** The delivery of a row, or null when the order was never given to a driver. */
export function deliveryOf(row: any): Delivery | null {
  if (!row) return null;
  const has = Object.values(DELIVERY_COLUMNS).some((c) => row[c] !== null && row[c] !== undefined && row[c] !== '');
  if (!has) return null;
  const d: any = { ID: row.ID, ORDER_ID: row.ORDER_ID };
  for (const [field, column] of Object.entries(DELIVERY_COLUMNS)) d[field] = row[column] ?? null;
  return d as Delivery;
}

/** Row + `deliveries` ([] or [delivery]) - the shape the screens read. */
export function withDeliveries<T extends Record<string, any>>(row: T): T & { deliveries: Delivery[] } {
  const d = deliveryOf(row);
  return { ...row, deliveries: d ? [d] : [] };
}

/** Delivery fields (STATUS, DRIVERS_NAME, ...) -> the columns to update on the row. */
export function deliveryUpdate(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    const column = DELIVERY_COLUMNS[k];
    if (column) out[column] = v;
  }
  return out;
}

/** Clears every delivery column (the order stays, without a driver). */
export function emptyDelivery(): Record<string, null> {
  const out: Record<string, null> = {};
  for (const column of Object.values(DELIVERY_COLUMNS)) out[column] = null;
  return out;
}
