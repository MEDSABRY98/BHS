// Price Margin — Excel export of the table as shown (same filters and order).

import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';
import { CostChange, CostDateLabel, FormatDate, Margin, PRICE_MODES, round2, round3, type ParentView, type PriceMarginPeriods, type PriceMarginRow, type PriceMode } from './Types';

export async function ExportPriceMarginExcel(rows: PriceMarginRow[], mode: PriceMode, periods: PriceMarginPeriods, view: ParentView = 'all') {
  if (!rows.length) return;
  const priceLabel = `${PRICE_MODES.find((m) => m.id === mode)?.label || 'Highest'} Selling Price`;

  const data: Record<string, unknown>[] = rows.map((r, i) => {
    const m = Margin(r, mode);
    const change = CostChange(r);
    return {
      '#': i + 1,
      ...(view === 'withParent' ? { 'Parent ID': r.parentId, Parent: r.parentName } : {}),
      ID: r.productId,
      Barcode: r.barcode,
      Description: r.name,
      Unit: r.unit,
      Supplier: r.newCost?.supplierName || '',
      'Old Cost': r.oldCost ? round3(r.oldCost.price) : '',
      'Old Cost Date': r.oldCost ? FormatDate(r.oldCost.date) : '',
      'New Cost': r.newCost ? round3(r.newCost.price) : '',
      'New Cost Date': r.newCost ? CostDateLabel(r.newCost) : '',
      'Cost Change %': change === null ? '' : round2(change),
      [priceLabel]: m.price === null ? '' : round3(m.price),
      'Gross Profit': m.profit === null ? '' : round3(m.profit),
      'Margin %': m.pct === null ? '' : round2(m.pct),
    };
  });

  const stamp = `${periods.saleFrom}_${periods.saleTo}`;
  await exportStyledExcel(data, `Price_Margin_${stamp}`, {
    sheetName: 'Price Margin',
    columnWidth: 18,
    numericColumns: ['Old Cost', 'New Cost', 'Cost Change %', priceLabel, 'Gross Profit', 'Margin %'],
    highlightNegativeInColumns: ['Gross Profit', 'Margin %'],
    numericDecimalPlaces: 3,
  });
}
