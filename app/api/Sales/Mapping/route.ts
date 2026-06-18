import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import { checkIsManager, invalidateMappingCache } from '@/app/Sales/Utils/SalesMappingCache';

export async function POST(request: Request) {
  try {
    const { userId, mapping } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Authorization check
    const isManager = await checkIsManager(userId);
    if (!isManager) {
      return NextResponse.json({ error: 'Unauthorized. Only sales managers can upload mappings.' }, { status: 403 });
    }

    if (!mapping || Object.keys(mapping).length === 0) {
      return NextResponse.json({ success: true, message: 'No mapping data provided' });
    }

    // 1. Delete all old mappings since mappings are now global
    const { error: deleteError } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .delete()
      .gt('ID', '');

    if (deleteError) {
      console.error('Error deleting old mappings:', deleteError);
      throw deleteError;
    }

    // 2. Fetch all users to map sheet-provided representative names to their IDs
    const { data: users, error: userErr } = await bhs_supabas
      .from('bhs_USERS')
      .select('ID, NAME');
    
    const userMapByName = new Map<string, string>();
    if (!userErr && users) {
      users.forEach(u => userMapByName.set(u.NAME.trim().toUpperCase(), u.ID));
    }

    // 3. Convert mapping object to database rows
    const rows = Object.keys(mapping).map((customerId, index) => {
      const paddedIndex = String(index + 1).padStart(4, '0');
      const data = mapping[customerId];

      // Resolve rep name to their user ID
      const repName = (data.salesRep || '').trim().toUpperCase();
      const repId = userMapByName.get(repName) || '';

      return {
        "ID": `R-${paddedIndex}`,
        "SALES_REP": repId, // Store representative ID directly in SALES_REP column
        "CUSTOMER ID": customerId,
        "AREA": data.area || '',
        "MARKET": data.market || '',
        "MERCHANDISER": data.merchandiser || '',
      };
    });

    // 4. Bulk insert mappings in chunks
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

    // 5. Invalidate mapping cache
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
