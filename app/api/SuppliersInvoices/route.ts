import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import { allocateSupplierRecordIds } from '@/app/DataBase/Utils/SupplierRecordIds';

type SupplierInvoiceType = 'Purchase' | 'Refund';
type MonthSummary = { year: number; month: number; count: number };

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

function monthRange(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return { startDate, endDate };
}

async function fetchMonthsSummary(type: SupplierInvoiceType): Promise<MonthSummary[]> {
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

  return [...counts.entries()]
    .map(([key, count]) => {
      const [year, month] = key.split('-').map(Number);
      return { year, month, count };
    })
    .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const typeParam = searchParams.get('type');
    const type = normalizeSupplierType(typeParam);

    if (action === 'months') {
      if (!type) {
        return NextResponse.json({ error: 'Valid type (Purchase or Refund) is required' }, { status: 400 });
      }
      const data = await fetchMonthsSummary(type);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('API Error fetching supplier invoices:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch supplier invoices', details: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const type = normalizeSupplierType(searchParams.get('type'));

    if (!year || !month || !type) {
      return NextResponse.json({ error: 'Year, month, and type are required' }, { status: 400 });
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
      return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
    }

    const { startDate, endDate } = monthRange(y, m);

    const { error } = await bhs_supabas
      .from('web_Suppliers_Invoices')
      .delete()
      .eq('TYPE', type)
      .gte('DATE', startDate)
      .lt('DATE', endDate);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error deleting supplier invoices month:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to delete month data', details: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = normalizeSupplierType(body.type);
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (!type) {
      return NextResponse.json({ error: 'Valid type (Purchase or Refund) is required' }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
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
      return NextResponse.json({ error: 'Validation failed', details: errors.slice(0, 20) }, { status: 400 });
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

    return NextResponse.json({ success: true, inserted: payload.length });
  } catch (error) {
    console.error('API Error uploading supplier invoices:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to upload supplier invoices', details: message }, { status: 500 });
  }
}
