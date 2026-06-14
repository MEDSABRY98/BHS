import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/Supabase';
import { invalidateMappingCache } from '@/app/Sales/Utils/SalesMappingCache';

// Helper to check if a user is a manager
async function checkIsManager(userId: string): Promise<boolean> {
  const cleanUserId = String(userId || '').trim().toUpperCase();
  if (cleanUserId === 'ADMIN') return true;
  const { data: user } = await bhs_supabas
    .from('bhs_USERS')
    .select('NAME, ROLE, IS_SALESMANAGER')
    .eq('ID', cleanUserId)
    .maybeSingle();

  if (!user) return false;
  return user.NAME === 'MED Sabry' || user.ROLE?.toLowerCase() === 'admin' || user.IS_SALESMANAGER === true || user.IS_SALESMANAGER === 'TRUE';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const cleanUserId = String(userId).trim().toUpperCase();
    const isManager = await checkIsManager(cleanUserId);

    // 1. Fetch raw mappings from database
    let query = bhs_supabas.from('web_Sales_DB_CUSTOMERSMAPPING').select('*');
    if (!isManager) {
      query = query.eq('SALES_REP', cleanUserId);
    }
    const { data: rawMappings, error: mapError } = await query;
    if (mapError) throw mapError;

    // 2. Fetch all customers to resolve names dynamically
    const { data: customers, error: custError } = await bhs_supabas
      .from('bhs_CUSTOMERS')
      .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME"');
    if (custError) throw custError;

    const custMap = new Map<string, { mainName: string; subName: string }>();
    if (customers) {
      customers.forEach(c => {
        const cId = String(c['CUSTOMER ID']).trim().toUpperCase();
        custMap.set(cId, {
          mainName: c['CUSTOMER MAIN NAME'] || '',
          subName: c['CUSTOMER SUB NAME'] || '',
        });
      });
    }

    // 3. Fetch all users to resolve rep names dynamically
    const { data: users, error: userError } = await bhs_supabas
      .from('bhs_USERS')
      .select('ID, NAME');
    if (userError) throw userError;

    const userMap = new Map<string, string>();
    if (users) {
      users.forEach(u => userMap.set(u.ID, u.NAME));
    }

    // 4. Enrich mappings
    const enrichedData = (rawMappings || []).map((m: any) => {
      const cId = String(m['CUSTOMER ID']).trim().toUpperCase();
      const cInfo = custMap.get(cId);
      return {
        ID: m.ID,
        'CUSTOMER ID': m['CUSTOMER ID'],
        'USER_ID': m['SALES_REP'],
        'CUSTOMER MAIN NAME': cInfo?.mainName || '',
        'CUSTOMER SUB NAME': cInfo?.subName || '',
        'AREA': m['AREA'] || '',
        'MARKET': m['MARKET'] || '',
        'SALES_REP': userMap.get(m['SALES_REP']) || '', // Sales Rep Name
        'MERCHANDISER': m['MERCHANDISER'] || '',
      };
    });

    // Sort alphabetically by main name
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

    // Authorization: Only managers/admins can assign customers
    const isManager = await checkIsManager(userId);
    if (!isManager) {
      return NextResponse.json({ error: 'Unauthorized. Only sales managers can modify assignments.' }, { status: 403 });
    }

    // Check if mapping already exists for this customer ID globally
    const { data: existing } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .select('ID')
      .eq('CUSTOMER ID', mapping.customerId)
      .maybeSingle();

    let saveError;

    if (existing) {
      // Update existing mapping
      const { error } = await bhs_supabas
        .from('web_Sales_DB_CUSTOMERSMAPPING')
        .update({
          "SALES_REP": mapping.salesRepId || '',
          "AREA": mapping.area || '',
          "MARKET": mapping.market || '',
          "MERCHANDISER": mapping.merchandiser || '',
        })
        .eq('ID', existing.ID);
      saveError = error;
    } else {
      // Fetch all IDs to generate next R-XXXX ID
      const { data: existingRows, error: fetchError } = await bhs_supabas
        .from('web_Sales_DB_CUSTOMERSMAPPING')
        .select('ID');

      if (fetchError) {
        throw fetchError;
      }

      let highestNum = 0;
      if (existingRows) {
        existingRows.forEach((row: any) => {
          const match = row.ID.match(/^R-(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > highestNum) {
              highestNum = num;
            }
          }
        });
      }

      const nextId = `R-${String(highestNum + 1).padStart(4, '0')}`;

      // Insert new mapping
      const { error } = await bhs_supabas
        .from('web_Sales_DB_CUSTOMERSMAPPING')
        .insert({
          "ID": nextId,
          "SALES_REP": mapping.salesRepId || '', // Store the rep's user ID directly in SALES_REP
          "CUSTOMER ID": mapping.customerId,
          "AREA": mapping.area || '',
          "MARKET": mapping.market || '',
          "MERCHANDISER": mapping.merchandiser || '',
        });
      saveError = error;
    }

    if (saveError) {
      throw saveError;
    }

    // Clear mapping caches
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

    // Authorization: Only managers/admins can delete mappings
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

    // Clear mapping caches
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
