import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import {
  checkIsManager,
  getMappingServer,
  invalidateMappingCache,
  loadUserMaps,
  migrateLegacyMappingRowIds,
  migrateLegacyMerchandiserNames,
  normalizeMappingCustomerId,
  resolveMerchandiserUserId,
  resolveSalesRepUserId,
} from '@/app/Sales/Utils/SalesMappingCache';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    await migrateLegacyMappingRowIds();
    await migrateLegacyMerchandiserNames();

    const filteredMappings = await getMappingServer(userId);
    const rawMappings = Array.from(filteredMappings.values()).map((m) => ({
      ID: m.id,
      'CUSTOMER ID': m.customerId,
      'SALES_REP': m.userId,
      'MERCHANDISER': m.merchandiserId,
      'AREA': m.area,
      'MARKET': m.market,
    }));

    const { data: customers, error: custError } = await bhs_supabas
      .from('bhs_CUSTOMERS')
      .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME"');
    if (custError) throw custError;

    const custMap = new Map<string, { mainName: string; subName: string }>();
    if (customers) {
      customers.forEach((c) => {
        const cId = String(c['CUSTOMER ID']).trim().toUpperCase();
        custMap.set(cId, {
          mainName: c['CUSTOMER MAIN NAME'] || '',
          subName: c['CUSTOMER SUB NAME'] || '',
        });
      });
    }

    const { data: users, error: userError } = await bhs_supabas
      .from('bhs_USERS')
      .select('ID, NAME');
    if (userError) throw userError;

    const userMap = new Map<string, string>();
    if (users) {
      users.forEach((u) => userMap.set(u.ID, u.NAME));
    }

    const enrichedData = (rawMappings || []).map((m: any) => {
      const cId = String(m['CUSTOMER ID']).trim().toUpperCase();
      const cInfo = custMap.get(cId);
      return {
        ID: m.ID,
        'CUSTOMER ID': m['CUSTOMER ID'],
        'USER_ID': m['SALES_REP'],
        'MERCHANDISER_ID': m['MERCHANDISER'],
        'CUSTOMER MAIN NAME': cInfo?.mainName || '',
        'CUSTOMER SUB NAME': cInfo?.subName || '',
        'AREA': m['AREA'] || '',
        'MARKET': m['MARKET'] || '',
        'SALES_REP': userMap.get(m['SALES_REP']) || '',
        'MERCHANDISER': userMap.get(m['MERCHANDISER']) || '',
      };
    });

    enrichedData.sort((a, b) => a['CUSTOMER MAIN NAME'].localeCompare(b['CUSTOMER MAIN NAME']));

    return NextResponse.json({ success: true, data: enrichedData });
  } catch (error: any) {
    console.error('API Error fetching my customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch my customers', details: error.message || error },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId, mapping } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    if (!mapping || !mapping.customerId) {
      return NextResponse.json({ error: 'Mapping data with customerId is required' }, { status: 400 });
    }

    const isManager = await checkIsManager(userId);
    if (!isManager) {
      return NextResponse.json({ error: 'Unauthorized. Only sales managers can modify assignments.' }, { status: 403 });
    }

    const customerId = await normalizeMappingCustomerId(mapping.customerId);
    const { userMapById, userMapByName } = await loadUserMaps();
    const salesRepId = resolveSalesRepUserId(mapping.salesRepId || '', userMapById, userMapByName);
    const merchandiserId = resolveMerchandiserUserId(
      mapping.merchandiserId || mapping.merchandiser || '',
      userMapById,
      userMapByName
    );

    const { data: existing } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .select('ID')
      .eq('CUSTOMER ID', customerId)
      .maybeSingle();

    let saveError;

    if (existing) {
      const { error } = await bhs_supabas
        .from('web_Sales_DB_CUSTOMERSMAPPING')
        .update({
          SALES_REP: salesRepId,
          AREA: mapping.area || '',
          MARKET: mapping.market || '',
          MERCHANDISER: merchandiserId,
        })
        .eq('CUSTOMER ID', customerId);
      saveError = error;
    } else {
      const { error } = await bhs_supabas
        .from('web_Sales_DB_CUSTOMERSMAPPING')
        .insert({
          ID: customerId,
          SALES_REP: salesRepId,
          'CUSTOMER ID': customerId,
          AREA: mapping.area || '',
          MARKET: mapping.market || '',
          MERCHANDISER: merchandiserId,
        });
      saveError = error;
    }

    if (saveError) {
      throw saveError;
    }

    invalidateMappingCache();

    return NextResponse.json({ success: true, message: 'Mapping saved successfully' });
  } catch (error: any) {
    console.error('API Error saving mapping:', error);
    return NextResponse.json(
      { error: 'Failed to save mapping', details: error.message || error },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const customerId = searchParams.get('customerId');

    if (!userId || !customerId) {
      return NextResponse.json({ error: 'User ID and Customer ID are required' }, { status: 400 });
    }

    const isManager = await checkIsManager(userId);
    if (!isManager) {
      return NextResponse.json({ error: 'Unauthorized. Only sales managers can remove assignments.' }, { status: 403 });
    }

    const { error } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .delete()
      .eq('CUSTOMER ID', customerId);

    if (error) {
      throw error;
    }

    invalidateMappingCache();

    return NextResponse.json({ success: true, message: 'Mapping deleted successfully' });
  } catch (error: any) {
    console.error('API Error deleting mapping:', error);
    return NextResponse.json(
      { error: 'Failed to delete mapping', details: error.message || error },
      { status: 500 }
    );
  }
}
