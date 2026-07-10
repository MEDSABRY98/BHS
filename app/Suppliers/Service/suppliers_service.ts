'use server';

import { bhs_supabas, getSupplierData, getSuppliersMatchingData } from '@/lib/supabase';
import { allocateSupplierRecordIds, getNextSupplierRecordId } from '@/app/DataBase/Utils/SupplierRecordIds';

export type SupplierInvoiceType = 'Purchase' | 'Refund';

export async function getSuppliersInvoices() {
  try {
    const pageSize = 1000;
    let from = 0;
    const allRows: {
      date: string;
      number: string;
      supplierName: string;
      amount: number;
      type: 'Purchase' | 'Refund';
    }[] = [];

    // Fetch all suppliers to map ID to Name
    const { data: suppliersData } = await bhs_supabas
      .from('bhs_SUPPLIERS')
      .select('"SUPPLIER ID", "SUPPLIER NAME"');
      
    const supplierMap = new Map<string, string>();
    if (suppliersData) {
      suppliersData.forEach(s => {
         supplierMap.set(String(s['SUPPLIER ID']).trim(), s['SUPPLIER NAME']);
      });
    }

    while (true) {
      const { data, error } = await bhs_supabas
        .from('web_Suppliers_Invoices')
        .select('"DATE", "TYPE", "INVOICE NUMBER", "SUPPLIER NAME", "AMOUNT"')
        .order('DATE', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach((row) => {
        const rawSupplier = String(row['SUPPLIER NAME'] || '').trim();
        if (!rawSupplier) return;
        
        const supplierName = supplierMap.get(rawSupplier) || rawSupplier;

        allRows.push({
          date: row.DATE || '',
          number: row['INVOICE NUMBER']?.toString() || '',
          supplierName,
          amount: parseFloat(String(row.AMOUNT ?? 0)) || 0,
          type: row.TYPE === 'Refund' ? 'Refund' : 'Purchase',
        });
      });

      if (data.length < pageSize) break;
      from += pageSize;
    }

    return { data: allRows };
  } catch (error) {
    console.error('Service Error fetching supplier data:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}

function monthRange(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return { startDate, endDate };
}

export async function getSuppliersMonthsSummary(type: SupplierInvoiceType) {
  try {
    const pageSize = 1000;
    let from = 0;
    const counts = new Map<string, number>();

    while (true) {
      const { data, error } = await bhs_supabas
        .from('web_Suppliers_Invoices')
        .select('"DATE"')
        .eq('TYPE', type)
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
    console.error('Service Error fetching months summary:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function deleteSuppliersMonth(year: number, month: number, type: SupplierInvoiceType) {
  try {
    const { startDate, endDate } = monthRange(year, month);

    const { error } = await bhs_supabas
      .from('web_Suppliers_Invoices')
      .delete()
      .eq('TYPE', type)
      .gte('DATE', startDate)
      .lt('DATE', endDate);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Service Error deleting supplier invoices month:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}

function parseSupplierDate(value: unknown): string | null {
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

function parseSupplierAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(String(value).replace(/,/g, '').trim());
  if (Number.isNaN(num)) return null;
  return num;
}

function normalizeSupplierType(value: unknown): SupplierInvoiceType | null {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'purchase') return 'Purchase';
  if (raw === 'refund') return 'Refund';
  return null;
}

export async function uploadSuppliersInvoices(type: SupplierInvoiceType, rows: any[]) {
  try {
    if (!type || rows.length === 0) {
      throw new Error('Valid type and rows are required');
    }

    const parsedRows: {
      DATE: string;
      TYPE: SupplierInvoiceType;
      'INVOICE NUMBER': string;
      'SUPPLIER NAME': string;
      AMOUNT: number;
    }[] = [];
    const errors: string[] = [];

    rows.forEach((row: Record<string, unknown>, index: number) => {
      const rowType = normalizeSupplierType(row.TYPE ?? row.type) || type;
      if (rowType !== type) {
        errors.push(`Row ${index + 2}: TYPE must be ${type}`);
        return;
      }

      const date = parseSupplierDate(row.DATE ?? row.date);
      const supplierName = String(row['SUPPLIER NAME'] ?? row.supplierName ?? '').trim();
      const invoiceNumber = String(row['INVOICE NUMBER'] ?? row.number ?? '').trim();
      const amount = parseSupplierAmount(row.AMOUNT ?? row.amount);

      if (!date) errors.push(`Row ${index + 2}: invalid DATE`);
      if (!supplierName) errors.push(`Row ${index + 2}: SUPPLIER NAME is required`);
      if (amount === null) errors.push(`Row ${index + 2}: invalid AMOUNT`);

      if (date && supplierName && amount !== null) {
        parsedRows.push({
          DATE: date,
          TYPE: rowType,
          'INVOICE NUMBER': invoiceNumber,
          'SUPPLIER NAME': supplierName,
          AMOUNT: amount,
        });
      }
    });

    if (errors.length > 0) {
      return { error: 'Validation failed', details: errors.slice(0, 20) };
    }

    const ids = await allocateSupplierRecordIds('web_Suppliers_Invoices', parsedRows.length);
    const payload = parsedRows.map((row, index) => ({
      ID: ids[index],
      ...row,
    }));

    const chunkSize = 500;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const { error } = await bhs_supabas.from('web_Suppliers_Invoices').insert(chunk);
      if (error) throw error;
    }

    return { success: true, inserted: payload.length };
  } catch (error) {
    console.error('Service Error uploading supplier invoices:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function getSuppliersMatching() {
  try {
    // Fetch all suppliers to map ID to Name
    const { data: suppliersData } = await bhs_supabas
      .from('bhs_SUPPLIERS')
      .select('"SUPPLIER ID", "SUPPLIER NAME"');
      
    const supplierMap = new Map<string, string>();
    if (suppliersData) {
      suppliersData.forEach(s => {
         supplierMap.set(String(s['SUPPLIER ID']).trim(), s['SUPPLIER NAME']);
      });
    }

    const { data, error } = await bhs_supabas
      .from('web_Suppliers_Matching')
      .select('"ID", "SUPPLIER NAME", "MONTHS"')
      .order('SUPPLIER NAME');

    if (error) throw error;

    const mapped = (data || []).map((row) => {
      const rawSupplier = String(row['SUPPLIER NAME'] || '').trim();
      const mappedName = supplierMap.get(rawSupplier) || rawSupplier;
      
      return {
        id: row.ID || '',
        name: mappedName,
        months: row.MONTHS || '',
      };
    });

    return { data: mapped };
  } catch (error) {
    console.error('Service Error fetching suppliers matching:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function saveSuppliersMatching(supplierName: string, months: string) {
  try {
    const normalizedName = String(supplierName || '').trim();
    if (!normalizedName) {
      throw new Error('Supplier name is required');
    }

    const { data: existingRows, error: fetchError } = await bhs_supabas
      .from('web_Suppliers_Matching')
      .select('"ID", "SUPPLIER NAME"');

    if (fetchError) throw fetchError;

    const match = (existingRows || []).find(
      (row) => String(row['SUPPLIER NAME'] || '').trim().toLowerCase() === normalizedName.toLowerCase()
    );

    if (match?.ID) {
      const { error: updateError } = await bhs_supabas
        .from('web_Suppliers_Matching')
        .update({
          MONTHS: months || '',
          UPDATED_AT: new Date().toISOString(),
        })
        .eq('ID', match.ID);

      if (updateError) throw updateError;
    } else {
      const nextId = await getNextSupplierRecordId('web_Suppliers_Matching');
      const { error: insertError } = await bhs_supabas.from('web_Suppliers_Matching').insert({
        ID: nextId,
        'SUPPLIER NAME': normalizedName,
        MONTHS: months || '',
      });

      if (insertError) throw insertError;
    }

    return { success: true };
  } catch (error) {
    console.error('Service Error saving suppliers matching:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function migrateSuppliersData(force: boolean = false) {
  try {
    const { count: invoiceCount, error: countInvErr } = await bhs_supabas
      .from('web_Suppliers_Invoices')
      .select('*', { count: 'exact', head: true });
    if (countInvErr) throw countInvErr;

    if ((invoiceCount || 0) > 0 && !force) {
      return {
        error: 'Suppliers invoices table is not empty. Pass force=true to migrate anyway (may duplicate data).',
      };
    }

    const [transactions, matchingRows] = await Promise.all([
      getSupplierData(),
      getSuppliersMatchingData(),
    ]);

    const invoicePayload = transactions
      .map((row) => {
        const date = parseSupplierDate(row.date);
        const supplierName = String(row.supplierName || '').trim();
        const amount = parseSupplierAmount(row.amount);
        if (!date || !supplierName || amount === null) return null;

        return {
          DATE: date,
          TYPE: row.type,
          'INVOICE NUMBER': String(row.number || '').trim(),
          'SUPPLIER NAME': supplierName,
          AMOUNT: amount,
        };
      })
      .filter(Boolean) as {
      DATE: string;
      TYPE: 'Purchase' | 'Refund';
      'INVOICE NUMBER': string;
      'SUPPLIER NAME': string;
      AMOUNT: number;
    }[];

    const invoiceIds = await allocateSupplierRecordIds('web_Suppliers_Invoices', invoicePayload.length);
    const invoicesWithIds = invoicePayload.map((row, index) => ({
      ID: invoiceIds[index],
      ...row,
    }));

    const chunkSize = 500;
    for (let i = 0; i < invoicesWithIds.length; i += chunkSize) {
      const chunk = invoicesWithIds.slice(i, i + chunkSize);
      const { error } = await bhs_supabas.from('web_Suppliers_Invoices').insert(chunk);
      if (error) throw error;
    }

    const matchingPayload = matchingRows
      .map((row) => ({
        legacyId: String(row.id || '').trim(),
        'SUPPLIER NAME': String(row.name || '').trim(),
        MONTHS: String(row.months || ''),
      }))
      .filter((row) => row['SUPPLIER NAME']);

    const matchingIds = await allocateSupplierRecordIds('web_Suppliers_Matching', matchingPayload.length);
    const matchingWithIds = matchingPayload.map((row, index) => ({
      ID: row.legacyId || matchingIds[index],
      'SUPPLIER NAME': row['SUPPLIER NAME'],
      MONTHS: row.MONTHS,
    }));

    for (let i = 0; i < matchingWithIds.length; i += chunkSize) {
      const chunk = matchingWithIds.slice(i, i + chunkSize);
      const { error } = await bhs_supabas.from('web_Suppliers_Matching').insert(chunk);
      if (error) throw error;
    }

    return {
      success: true,
      importedInvoices: invoicesWithIds.length,
      importedMatching: matchingWithIds.length,
    };
  } catch (error) {
    console.error('Service Error in suppliers migration:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}
