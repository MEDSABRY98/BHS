'use client';

// Archive - one Excel file per closed count: Total, Users and Records sheets.
// Uses the shared styled exporter so it looks like every other Excel in the system.

import { exportInventoryCountingExcelWorkbook, recordsFromTable } from '../Export/ExcelExport';
import type { ICSessionData } from '../Sessions/ICSessionsService';
import { formatICDate } from '../Sessions/SessionBar';

export async function downloadArchiveExcel(data: ICSessionData): Promise<void> {
  const lotById = new Map(data.lots.map((l) => [l.lotId, l]));

  // 1) Total: expected vs counted per lot
  const totalRows = data.lots.map((l) => [
    l.productId, l.barcode, l.productName, l.lotNumber, l.expiryDate, l.expected, l.counted, l.variance,
  ]);

  // 2) Users: what each user counted per lot, one row per lot and user
  const perLotUser = new Map<number, Map<string, number>>();
  for (const e of data.entries) {
    const m = perLotUser.get(e.lotId) ?? new Map<string, number>();
    m.set(e.userName, (m.get(e.userName) ?? 0) + e.qty);
    perLotUser.set(e.lotId, m);
  }
  const userRows: unknown[][] = [];
  for (const l of data.lots) {
    const m = perLotUser.get(l.lotId);
    if (!m) continue;
    Array.from(m.keys())
      .sort((a, b) => a.localeCompare(b))
      .forEach((u) => userRows.push([l.productId, l.barcode, l.productName, l.lotNumber, l.expiryDate, u, m.get(u) ?? 0]));
  }

  // 3) Records: every saved count
  const recordRows = data.entries.map((e) => {
    const l = lotById.get(e.lotId);
    return [
      formatICDate(e.createdAt),
      e.userName,
      l?.productId ?? '',
      l?.barcode ?? '',
      l?.productName ?? '',
      l?.lotNumber ?? '',
      l?.expiryDate ?? '',
      e.details,
      e.qty,
    ];
  });

  const name = (data.session.name || `Session_${data.session.id}`).replace(/[\\/:*?"<>|]+/g, '_');

  await exportInventoryCountingExcelWorkbook(
    [
      {
        name: 'Total',
        data: recordsFromTable(
          ['Product ID', 'Barcode', 'Product Name', 'Lot Number', 'Expiry Date', 'Expected', 'Counted', 'Variance'],
          totalRows,
        ),
        options: { numericColumns: ['Expected', 'Counted', 'Variance'], numericDecimalPlaces: 0, highlightNegativeInColumns: ['Variance'] },
      },
      {
        name: 'Users',
        data: recordsFromTable(['Product ID', 'Barcode', 'Product Name', 'Lot Number', 'Expiry Date', 'User', 'Counted'], userRows),
        options: { numericColumns: ['Counted'], numericDecimalPlaces: 0 },
      },
      {
        name: 'Records',
        data: recordsFromTable(
          ['Date', 'User', 'Product ID', 'Barcode', 'Product Name', 'Lot Number', 'Expiry Date', 'Count Details', 'Counted Qty'],
          recordRows,
        ),
        options: { numericColumns: ['Counted Qty'], numericDecimalPlaces: 0 },
      },
    ],
    `Archive_${name}.xlsx`,
  );
}
