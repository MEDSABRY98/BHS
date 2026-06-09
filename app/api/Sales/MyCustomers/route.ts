import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import { invalidateMappingCache } from '@/lib/SalesMappingCache';
import { v4 as uuidv4 } from 'uuid'; // Fallback if crypto not available

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { data, error } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .select('*')
      .eq('USER_ID', userId)
      .order('CUSTOMER MAIN NAME', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data });
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

    // Check if mapping already exists
    const { data: existing } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .select('ID')
      .eq('USER_ID', userId)
      .eq('CUSTOMER ID', mapping.customerId)
      .single();

    let saveError;
    
    if (existing) {
      // Update existing
      const { error } = await bhs_supabas
        .from('web_Sales_DB_CUSTOMERSMAPPING')
        .update({
          "CUSTOMER MAIN NAME": mapping.customerMainName || '',
          "CUSTOMER SUB NAME": mapping.customerName || '',
          "AREA": mapping.area || '',
          "MARKET": mapping.market || '',
          "SALES_REP": mapping.salesRep || '',
          "MERCHANDISER": mapping.merchandiser || '',
        })
        .eq('ID', existing.ID);
      saveError = error;
    } else {
      // Insert new
      const paddedIndex = String(Date.now() % 10000).padStart(4, '0');
      const { error } = await bhs_supabas
        .from('web_Sales_DB_CUSTOMERSMAPPING')
        .insert({
          "ID": `${userId.substring(0, 5)}-R-${paddedIndex}-${Math.floor(Math.random()*1000)}`,
          "USER_ID": userId,
          "CUSTOMER ID": mapping.customerId,
          "CUSTOMER MAIN NAME": mapping.customerMainName || '',
          "CUSTOMER SUB NAME": mapping.customerName || '',
          "AREA": mapping.area || '',
          "MARKET": mapping.market || '',
          "SALES_REP": mapping.salesRep || '',
          "MERCHANDISER": mapping.merchandiser || '',
        });
      saveError = error;
    }

    if (saveError) {
      throw saveError;
    }

    invalidateMappingCache(userId);

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

    const { error } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .delete()
      .eq('USER_ID', userId)
      .eq('CUSTOMER ID', customerId);

    if (error) {
      throw error;
    }

    invalidateMappingCache(userId);

    return NextResponse.json({ success: true, message: 'Mapping deleted successfully' });
  } catch (error: any) {
    console.error('API Error deleting mapping:', error);
    return NextResponse.json(
      { error: 'Failed to delete mapping', details: error.message || error },
      { status: 500 }
    );
  }
}
