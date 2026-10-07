import { InvoiceRow } from '@/types';

export function buildInvoicesByCustomer(data: InvoiceRow[]): Map<string, InvoiceRow[]> {
  const map = new Map<string, InvoiceRow[]>();
  for (const row of data) {
    const key = row.customerName;
    if (!key) continue;
    const list = map.get(key);
    if (list) {
      list.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  return map;
}
