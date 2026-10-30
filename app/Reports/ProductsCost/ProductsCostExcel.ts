import { exportStyledExcelWorkbook } from '@/app/Components/Export/ExcelExport';
import { reduceCost, type ProductCostRow } from './ProductsCostData';

/**
 * One Excel, three sheets (the cost already lowered by `percent`, 0 = the real cost):
 *  • Normal            — every product: Product ID | Parent ID | Barcode | Name | Cost
 *  • Without Parent    — only the products that have no parent
 *  • Group By Parent   — the products that belong to a parent, grouped under it (the parent's own row first)
 */
export async function exportProductsCostExcel(products: ProductCostRow[], percent: number) {
  const toRow = (p: ProductCostRow) => ({
    'Product ID': p.productId,
    'Parent ID': p.parentId,
    Barcode: p.barcode,
    Name: p.name,
    Cost: reduceCost(p.cost, percent),
  });

  const normal = products.map(toRow);
  const withoutParent = products.filter((p) => !p.parentId).map(toRow);

  const byId = new Map(products.map((p) => [p.productId, p]));
  const groups = new Map<string, ProductCostRow[]>();
  products.forEach((p) => {
    if (!p.parentId) return;
    if (!groups.has(p.parentId)) groups.set(p.parentId, []);
    groups.get(p.parentId)!.push(p);
  });
  const grouped: ReturnType<typeof toRow>[] = [];
  [...groups.keys()]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .forEach((parentId) => {
      const parent = byId.get(parentId);
      if (parent) grouped.push(toRow(parent));
      groups.get(parentId)!.forEach((child) => grouped.push(toRow(child)));
    });

  const options = { columnWidth: 22, numericColumns: ['Cost'], numericDecimalPlaces: 3 };
  const day = new Date().toISOString().split('T')[0];
  await exportStyledExcelWorkbook(
    [
      { name: 'Normal', data: normal, options },
      { name: 'Without Parent', data: withoutParent, options },
      { name: 'Group By Parent', data: grouped, options },
    ],
    percent === 0 ? `Products_Cost_${day}` : `Products_Cost_minus_${String(percent).replace('.', '_')}pct_${day}`,
  );
}
