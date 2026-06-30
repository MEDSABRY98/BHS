import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/supabase';
import { buildAndSaveCache, invalidateMemoryCache } from '@/app/Sales/Utils/SalesCache';
import { invalidateMappingCache } from '@/app/Sales/Utils/SalesMappingCache';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PRODUCT_ID_TABLES = [
  { table: 'web_Sales_DB', column: 'PRODUCT ID' },
  { table: 'web_INVENTORY_SCRAB', column: 'PRODUCT ID' },
  { table: 'web_INVENTORY_MOVES', column: 'PRODUCT ID' },
  { table: 'mix_INVENTORY_COUNT_DETAILS', column: 'PRODUCT ID' },
  { table: 'mix_INVENTORY_COUNT_TOTALS', column: 'PRODUCT ID' },
  { table: 'web_INVENTORY_SCRAB_REPORT', column: 'PRODUCT_ID' },
] as const;

const REGISTRY_TABLES = ['web_INVENTORY_PRODUCTS', 'mix_INVENTORY_COUNT_PRODUCTS'] as const;

type MergeBody = {
  survivorProductId?: string;
  sourceProductIds?: string[];
  targetName?: string;
  targetBarcode?: string;
  targetCategory?: string;
  targetItemCode?: string | number | null;
};

type ProductRow = {
  ID: string;
  'PRODUCT ID': string;
};

function normalizeId(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

async function updateProductIdReferences(
  entry: (typeof PRODUCT_ID_TABLES)[number],
  survivorProductId: string,
  sourceProductId: string
): Promise<number> {
  const { data, error } = await bhs_supabase
    .from(entry.table)
    .update({ [entry.column]: survivorProductId })
    .eq(entry.column, sourceProductId)
    .select('ID');

  if (error) throw new Error(`${entry.table}: ${error.message}`);
  return data?.length ?? 0;
}

async function reconcileRegistryTable(
  table: (typeof REGISTRY_TABLES)[number],
  survivorProductId: string,
  sourceProductId: string
): Promise<number> {
  const { data: survivorRow, error: survivorError } = await bhs_supabase
    .from(table)
    .select('ID')
    .eq('PRODUCT ID', survivorProductId)
    .maybeSingle();

  if (survivorError) throw new Error(`${table}: ${survivorError.message}`);

  if (survivorRow) {
    const { data, error } = await bhs_supabase
      .from(table)
      .delete()
      .eq('PRODUCT ID', sourceProductId)
      .select('ID');

    if (error) throw new Error(`${table}: ${error.message}`);
    return data?.length ?? 0;
  }

  const { data, error } = await bhs_supabase
    .from(table)
    .update({ 'PRODUCT ID': survivorProductId })
    .eq('PRODUCT ID', sourceProductId)
    .select('ID');

  if (error) throw new Error(`${table}: ${error.message}`);
  return data?.length ?? 0;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MergeBody;

    const survivorProductId = normalizeId(body.survivorProductId);
    const sourceProductIds = (body.sourceProductIds || []).map(normalizeId).filter(Boolean);
    const targetName = String(body.targetName ?? '').trim();
    const targetBarcode = String(body.targetBarcode ?? '').trim();
    const targetCategory = String(body.targetCategory ?? '').trim();
    const targetItemCodeRaw = body.targetItemCode;
    const targetItemCode =
      targetItemCodeRaw === null || targetItemCodeRaw === undefined || targetItemCodeRaw === ''
        ? null
        : Number(targetItemCodeRaw);

    if (!survivorProductId) {
      return NextResponse.json({ error: 'survivorProductId is required' }, { status: 400 });
    }
    if (sourceProductIds.length < 1) {
      return NextResponse.json({ error: 'At least one source product ID is required' }, { status: 400 });
    }
    if (!targetName) {
      return NextResponse.json({ error: 'targetName is required' }, { status: 400 });
    }
    if (sourceProductIds.includes(survivorProductId)) {
      return NextResponse.json({ error: 'Source IDs must not include the survivor ID' }, { status: 400 });
    }
    if (targetItemCode !== null && Number.isNaN(targetItemCode)) {
      return NextResponse.json({ error: 'targetItemCode must be a valid number' }, { status: 400 });
    }

    const allProductIds = [survivorProductId, ...sourceProductIds];
    const { data: productRows, error: fetchError } = await bhs_supabase
      .from('bhs_PRODUCTS')
      .select('ID, "PRODUCT ID"')
      .in('PRODUCT ID', allProductIds);

    if (fetchError) throw fetchError;

    const byProductId = new Map<string, ProductRow>();
    (productRows || []).forEach((row) => {
      const id = normalizeId(row['PRODUCT ID']);
      if (id) byProductId.set(id, row as ProductRow);
    });

    if (!byProductId.has(survivorProductId)) {
      return NextResponse.json({ error: 'Survivor product not found' }, { status: 400 });
    }

    const missingSources = sourceProductIds.filter((id) => !byProductId.has(id));
    if (missingSources.length > 0) {
      return NextResponse.json(
        { error: `Source product(s) not found: ${missingSources.join(', ')}` },
        { status: 400 }
      );
    }

    const updateSummary: Record<string, number> = {};

    for (const sourceProductId of sourceProductIds) {
      for (const entry of PRODUCT_ID_TABLES) {
        const count = await updateProductIdReferences(entry, survivorProductId, sourceProductId);
        updateSummary[entry.table] = (updateSummary[entry.table] || 0) + count;
      }

      for (const table of REGISTRY_TABLES) {
        const count = await reconcileRegistryTable(table, survivorProductId, sourceProductId);
        updateSummary[table] = (updateSummary[table] || 0) + count;
      }
    }

    const { error: survivorUpdateError } = await bhs_supabase
      .from('bhs_PRODUCTS')
      .update({
        'PRODUCT NAME': targetName,
        'PRODUCT BARCODE': targetBarcode,
        'PRODUCT CATEGORY': targetCategory,
        'ITEM CODE': targetItemCode,
      })
      .eq('PRODUCT ID', survivorProductId);

    if (survivorUpdateError) throw survivorUpdateError;

    const sourceInternalIds = sourceProductIds.map((id) => byProductId.get(id)!.ID);
    const { error: deleteError } = await bhs_supabase
      .from('bhs_PRODUCTS')
      .delete()
      .in('ID', sourceInternalIds);

    if (deleteError) throw deleteError;

    invalidateMemoryCache();
    invalidateMappingCache();
    try {
      await buildAndSaveCache();
    } catch (cacheError) {
      console.error('Product merge succeeded but sales cache rebuild failed:', cacheError);
    }

    return NextResponse.json({
      success: true,
      survivorProductId,
      mergedCount: sourceProductIds.length,
      updateSummary,
    });
  } catch (error: unknown) {
    console.error('POST /api/DataBase/Products/Merge error:', error);
    const message = error instanceof Error ? error.message : 'Failed to merge products';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
