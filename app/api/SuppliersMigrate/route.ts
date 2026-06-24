import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import { getSupplierData } from '@/lib/supabase';;
import { getSuppliersMatchingData } from '@/lib/supabase';;
import { allocateSupplierRecordIds } from '@/app/DataBase/Utils/SupplierRecordIds';

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

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const { count: invoiceCount, error: countInvErr } = await bhs_supabas
      .from('web_Suppliers_Invoices')
      .select('*', { count: 'exact', head: true });
    if (countInvErr) throw countInvErr;

    if ((invoiceCount || 0) > 0 && !force) {
      return NextResponse.json(
        {
          error: 'Suppliers invoices table is not empty. Add ?force=true to migrate anyway (may duplicate data).',
        },
        { status: 409 }
      );
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

    return NextResponse.json({
      success: true,
      importedInvoices: invoicesWithIds.length,
      importedMatching: matchingWithIds.length,
    });
  } catch (error) {
    console.error('Suppliers migration error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Migration failed', details: message }, { status: 500 });
  }
}
