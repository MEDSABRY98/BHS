'use server';

import { bhs_supabas } from '@/lib/supabase';
import { allocateSupplierRecordIds } from '@/app/DataBase/Utils/SupplierRecordIds';

function monthRange(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return { startDate, endDate };
}

export async function getPurchaseDetailsMonthsSummary() {
  try {
    const { data, error } = await bhs_supabas.rpc('get_suppliers_purchase_months_summary');

    if (!error && Array.isArray(data)) {
      const summary = data.map((row: { year: number; month: number; count: number }) => ({
        year: Number(row.year),
        month: Number(row.month),
        count: Number(row.count),
      }));
      return { data: summary };
    }

    console.warn('RPC get_suppliers_purchase_months_summary failed, falling back to JS:', error?.message);

    const pageSize = 1000;
    let from = 0;
    const counts = new Map<string, number>();

    while (true) {
      const { data, error } = await bhs_supabas
        .from('web_Suppliers_Purchase')
        .select('"DATE"')
        .not('DATE', 'is', null)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach((row) => {
        const dateStr = row.DATE as string;
        if (!dateStr) return;
        const parsed = new Date(`${dateStr}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) return;
        const key = `${parsed.getFullYear()}-${parsed.getMonth() + 1}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      });

      if (data.length < pageSize) break;
      from += pageSize;
    }

    const summary = [...counts.entries()]
      .map(([key, count]) => {
        const [year, month] = key.split('-').map(Number);
        return { year, month, count };
      })
      .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));

    return { data: summary };
  } catch (error) {
    console.error('Service Error fetching purchase details months summary:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function deletePurchaseDetailsMonth(year: number, month: number) {
  try {
    const { startDate, endDate } = monthRange(year, month);

    const { error } = await bhs_supabas
      .from('web_Suppliers_Purchase')
      .delete()
      .gte('DATE', startDate)
      .lt('DATE', endDate);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Service Error deleting purchase details month:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}

function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    let year = dmy[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(String(value).replace(/,/g, '').trim());
  if (Number.isNaN(num)) return null;
  return num;
}

export async function uploadPurchaseDetails(rows: any[]) {
  try {
    if (rows.length === 0) {
      throw new Error('Valid rows are required');
    }

    const parsedRows: {
      DATE: string;
      'INVOICE NUMBER': string;
      'SUPPLIER ID': string;
      'PRODUCT ID': string;
      QTY: number;
      'UNIT PRICE': number;
    }[] = [];
    const errors: string[] = [];

    rows.forEach((row: Record<string, unknown>, index: number) => {
      const date = parseDate(row.DATE ?? row.date);
      const invoiceNumber = String(row['INVOICE NUMBER'] ?? row.invoiceNumber ?? '').trim();
      const supplierId = String(row['SUPPLIER ID'] ?? row.supplierId ?? '').trim();
      const productId = String(row['PRODUCT ID'] ?? row.productId ?? '').trim();
      const qty = parseNumeric(row.QTY ?? row.qty);
      const unitPrice = parseNumeric(row['UNIT PRICE'] ?? row.unitPrice);

      if (!date) errors.push(`Row ${index + 2}: invalid DATE`);
      if (!supplierId) errors.push(`Row ${index + 2}: SUPPLIER ID is required`);
      if (!productId) errors.push(`Row ${index + 2}: PRODUCT ID is required`);
      if (qty === null) errors.push(`Row ${index + 2}: invalid QTY`);
      if (unitPrice === null) errors.push(`Row ${index + 2}: invalid UNIT PRICE`);

      if (date && supplierId && productId && qty !== null && unitPrice !== null) {
        parsedRows.push({
          DATE: date,
          'INVOICE NUMBER': invoiceNumber,
          'SUPPLIER ID': supplierId,
          'PRODUCT ID': productId,
          QTY: qty,
          'UNIT PRICE': unitPrice,
        });
      }
    });

    if (errors.length > 0) {
      return { error: 'Validation failed', details: errors.slice(0, 20) };
    }

    // --- Validation: Check if suppliers and products exist ---
    const uniqueSuppliers = Array.from(new Set(parsedRows.map(r => r['SUPPLIER ID'])));
    const uniqueProducts = Array.from(new Set(parsedRows.map(r => r['PRODUCT ID'])));
    
    // Check Suppliers
    const { data: dbSuppliers, error: suppErr } = await bhs_supabas
      .from('bhs_SUPPLIERS')
      .select('"SUPPLIER ID"')
      .in('SUPPLIER ID', uniqueSuppliers);
    if (suppErr) throw suppErr;
    const existingSupplierIds = new Set(dbSuppliers?.map(s => String(s['SUPPLIER ID']).trim()) || []);

    // Check Products
    const { data: dbProductsById, error: prodErr1 } = await bhs_supabas
      .from('bhs_PRODUCTS')
      .select('"PRODUCT ID"')
      .in('PRODUCT ID', uniqueProducts);
      
    if (prodErr1) throw prodErr1;

    const existingProductIds = new Set(dbProductsById?.map(p => String(p['PRODUCT ID'] || '').trim()).filter(Boolean) || []);

    const missingSuppliers = new Set<string>();
    const missingProducts = new Set<string>();

    parsedRows.forEach((row) => {
       if (!existingSupplierIds.has(row['SUPPLIER ID'])) {
         missingSuppliers.add(row['SUPPLIER ID']);
       }
       if (!existingProductIds.has(row['PRODUCT ID'])) {
         missingProducts.add(row['PRODUCT ID']);
       }
    });

    const existenceErrors: string[] = [];
    missingSuppliers.forEach(id => {
      existenceErrors.push(`Supplier ID '${id}' does not exist in Suppliers Database.`);
    });
    missingProducts.forEach(id => {
      existenceErrors.push(`Product ID '${id}' does not exist in Products Database.`);
    });

    if (existenceErrors.length > 0) {
      return { error: 'Validation failed', details: existenceErrors };
    }
    // ---------------------------------------------------------

    const ids = await allocateSupplierRecordIds('web_Suppliers_Purchase', parsedRows.length);
    const payload = parsedRows.map((row, index) => ({
      ID: ids[index],
      ...row,
    }));

    const chunkSize = 500;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const { error } = await bhs_supabas.from('web_Suppliers_Purchase').insert(chunk);
      if (error) throw error;
    }

    return { success: true, inserted: payload.length };
  } catch (error) {
    console.error('Service Error uploading purchase details:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function updatePurchaseUnitPrice(id: string, unitPrice: number) {
  try {
    const trimmedId = id?.toString().trim();
    if (!trimmedId) {
      return { error: 'Purchase line ID is required' };
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { error: 'Unit price must be greater than zero' };
    }

    const { error } = await bhs_supabas
      .from('web_Suppliers_Purchase')
      .update({ 'UNIT PRICE': unitPrice })
      .eq('ID', trimmedId);

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Service Error updating purchase unit price:', error);
    return { error: error instanceof Error ? error.message : 'Failed to update unit price' };
  }
}
