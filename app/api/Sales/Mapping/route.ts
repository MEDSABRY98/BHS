import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import {
  checkIsManager,
  invalidateMappingCache,
  isLegacyMappingRowId,
  loadUserMaps,
  normalizeMappingCustomerId,
  resolveMerchandiserUserId,
  resolveSalesRepUserId,
} from '@/app/Sales/Utils/SalesMappingCache';

export async function POST(request: Request) {
  try {
    const { userId, mapping } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const isManager = await checkIsManager(userId);
    if (!isManager) {
      return NextResponse.json({ error: 'Unauthorized. Only sales managers can upload mappings.' }, { status: 403 });
    }

    if (!mapping || Object.keys(mapping).length === 0) {
      return NextResponse.json({ success: true, message: 'No mapping data provided' });
    }

    const { error: deleteError } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .delete()
      .gt('ID', '');

    if (deleteError) {
      console.error('Error deleting old mappings:', deleteError);
      throw deleteError;
    }

    const { userMapById, userMapByName } = await loadUserMaps();

    const rowsByCustomer = new Map<string, Record<string, string>>();
    for (const rawCustomerId of Object.keys(mapping)) {
      if (isLegacyMappingRowId(rawCustomerId)) continue;

      const customerId = await normalizeMappingCustomerId(rawCustomerId);
      const data = mapping[rawCustomerId];
      const repRaw = String(data.salesRep || data.salesRepId || '').trim();
      const repId = resolveSalesRepUserId(repRaw, userMapById, userMapByName);
      const merchRaw = String(data.merchandiserId || data.merchandiser || '').trim();
      const merchId = resolveMerchandiserUserId(merchRaw, userMapById, userMapByName);

      rowsByCustomer.set(customerId, {
        ID: customerId,
        SALES_REP: repId,
        'CUSTOMER ID': customerId,
        AREA: data.area || '',
        MARKET: data.market || '',
        MERCHANDISER: merchId,
      });
    }
    const rows = Array.from(rowsByCustomer.values());

    const chunkSize = 1000;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error: insertError } = await bhs_supabas
        .from('web_Sales_DB_CUSTOMERSMAPPING')
        .insert(chunk);

      if (insertError) {
        console.error('Error inserting mapping chunk:', insertError);
        throw insertError;
      }
    }

    invalidateMappingCache();

    return NextResponse.json({ success: true, message: `Uploaded ${rows.length} mappings successfully` });
  } catch (error: any) {
    console.error('API Error saving mapping:', error);
    return NextResponse.json(
      { error: 'Failed to save mapping', details: error.message || error },
      { status: 500 }
    );
  }
}
