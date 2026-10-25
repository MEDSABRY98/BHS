// Data Update — shared (client + server safe) ids and types.
// One page for normal users to refresh some database data from Excel.
// Admin Control → system 'data-update', its sub-tabs are the dataset ids below.

export const DATA_UPDATE_SYSTEM_ID = 'data-update';

export type DataSetId = 'inventory';

export const DATA_SETS: { id: DataSetId; title: string; description: string }[] = [
  { id: 'inventory', title: 'Inventory', description: 'Stock quantity of the products — products not in the file become 0' },
];

/** One line read from the inventory file. */
export interface InventoryLine {
  ROW: number;
  PRODUCT_ID: string;
  PRODUCT_NAME: string;
  QTY: number;
}

export interface InventoryPreview {
  updated: number;  // products in the file
  zeroed: number;   // other products that had stock and become 0
  unknown: { row: number; id: string }[]; // ids not in the products DB
  totalQty: number;
}

export const round3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
export const cleanText = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
/** product ids are compared as text ("12" = 12 = "12.0") */
export const idKey = (v: unknown) => {
  const s = cleanText(v);
  return /^\d+(\.0+)?$/.test(s) ? String(Number(s)) : s.toUpperCase();
};
