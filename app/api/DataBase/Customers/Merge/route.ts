import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/supabase';
import { buildAndSaveCache, invalidateMemoryCache } from '@/app/Sales/Utils/SalesCache';
import { invalidateMappingCache } from '@/app/Sales/Utils/SalesMappingCache';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const CUSTOMER_ID_TABLES = [
  { table: 'web_Sales_DB', column: 'CUSTOMER ID' },
  { table: 'web_Sales_DB_INACTIVECUSTOMERS', column: 'CUSTOMER ID' },
  { table: 'web_Sales_DB_CUSTOMERSMAPPING', column: 'CUSTOMER ID' },
  { table: 'mix_DEBIT', column: 'CUSTOMER ID' },
  { table: 'debit_EMILS', column: 'CUSTOMER ID' },
  { table: 'debit_EMILS_LULU', column: 'CUSTOMER ID' },
  { table: 'debit_NOTES', column: 'CUSTOMER ID' },
  { table: 'app_lpos_ORDERS', column: 'CUSTOMER_ID' },
] as const;

type MergeBody = {
  survivorCustomerId?: string;
  sourceCustomerIds?: string[];
  targetMainName?: string;
  targetSubName?: string;
  targetCity?: string;
};

type CustomerRow = {
  ID: string;
  'CUSTOMER ID': string;
};

function normalizeId(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

async function updateCustomerIdReferences(
  entry: (typeof CUSTOMER_ID_TABLES)[number],
  survivorCustomerId: string,
  sourceCustomerId: string
): Promise<number> {
  const { data, error } = await bhs_supabase
    .from(entry.table)
    .update({ [entry.column]: survivorCustomerId })
    .eq(entry.column, sourceCustomerId)
    .select('ID');

  if (error) throw new Error(`${entry.table}: ${error.message}`);
  return data?.length ?? 0;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MergeBody;

    const survivorCustomerId = normalizeId(body.survivorCustomerId);
    const sourceCustomerIds = (body.sourceCustomerIds || [])
      .map(normalizeId)
      .filter(Boolean);
    const targetMainName = String(body.targetMainName ?? '').trim();
    const targetSubName = String(body.targetSubName ?? '').trim();
    const targetCity = String(body.targetCity ?? '').trim();

    if (!survivorCustomerId) {
      return NextResponse.json({ error: 'survivorCustomerId is required' }, { status: 400 });
    }
    if (sourceCustomerIds.length < 1) {
      return NextResponse.json({ error: 'At least one source customer ID is required' }, { status: 400 });
    }
    if (!targetSubName) {
      return NextResponse.json({ error: 'targetSubName is required' }, { status: 400 });
    }
    if (sourceCustomerIds.includes(survivorCustomerId)) {
      return NextResponse.json({ error: 'Source IDs must not include the survivor ID' }, { status: 400 });
    }

    const allCustomerIds = [survivorCustomerId, ...sourceCustomerIds];
    const { data: customerRows, error: fetchError } = await bhs_supabase
      .from('bhs_CUSTOMERS')
      .select('ID, "CUSTOMER ID"')
      .in('CUSTOMER ID', allCustomerIds);

    if (fetchError) throw fetchError;

    const byCustomerId = new Map<string, CustomerRow>();
    (customerRows || []).forEach((row) => {
      const id = normalizeId(row['CUSTOMER ID']);
      if (id) byCustomerId.set(id, row as CustomerRow);
    });

    if (!byCustomerId.has(survivorCustomerId)) {
      return NextResponse.json({ error: 'Survivor customer not found' }, { status: 400 });
    }

    const missingSources = sourceCustomerIds.filter((id) => !byCustomerId.has(id));
    if (missingSources.length > 0) {
      return NextResponse.json(
        { error: `Source customer(s) not found: ${missingSources.join(', ')}` },
        { status: 400 }
      );
    }

    const updateSummary: Record<string, number> = {};

    for (const sourceCustomerId of sourceCustomerIds) {
      for (const entry of CUSTOMER_ID_TABLES) {
        const count = await updateCustomerIdReferences(entry, survivorCustomerId, sourceCustomerId);
        updateSummary[entry.table] = (updateSummary[entry.table] || 0) + count;
      }
    }

    const { error: survivorUpdateError } = await bhs_supabase
      .from('bhs_CUSTOMERS')
      .update({
        'CUSTOMER MAIN NAME': targetMainName,
        'CUSTOMER SUB NAME': targetSubName,
        'CUSTOMER CITY': targetCity,
      })
      .eq('CUSTOMER ID', survivorCustomerId);

    if (survivorUpdateError) throw survivorUpdateError;

    const sourceInternalIds = sourceCustomerIds.map((id) => byCustomerId.get(id)!.ID);
    const { error: deleteError } = await bhs_supabase
      .from('bhs_CUSTOMERS')
      .delete()
      .in('ID', sourceInternalIds);

    if (deleteError) throw deleteError;

    invalidateMemoryCache();
    invalidateMappingCache();
    try {
      await buildAndSaveCache();
    } catch (cacheError) {
      console.error('Merge succeeded but sales cache rebuild failed:', cacheError);
    }

    return NextResponse.json({
      success: true,
      survivorCustomerId,
      mergedCount: sourceCustomerIds.length,
      updateSummary,
    });
  } catch (error: unknown) {
    console.error('POST /api/DataBase/Customers/Merge error:', error);
    const message = error instanceof Error ? error.message : 'Failed to merge customers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
