import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Helper to sync new customers from bhs_CUSTOMERS to web_CUSTOMERSDOCUMENTS
async function syncCustomersFromBhs() {
  try {
    const { data: bhsCustomers, error: bhsError } = await bhs_supabas
      .from('bhs_CUSTOMERS')
      .select('"CUSTOMER MAIN NAME"');
      
    if (bhsError) {
      console.error('Error fetching bhs_CUSTOMERS for sync:', bhsError);
      return;
    }

    const { data: existingDocs, error: docError } = await bhs_supabas
      .from('web_CUSTOMERSDOCUMENTS')
      .select('CUSTOMER_NAME');

    if (docError) {
      console.error('Error fetching web_CUSTOMERSDOCUMENTS for sync:', docError);
      return;
    }

    const existingNames = new Set(existingDocs.map(d => d.CUSTOMER_NAME.trim().toLowerCase()));
    const uniqueBhsNames = Array.from(new Set(bhsCustomers.map(c => c['CUSTOMER MAIN NAME']?.trim()).filter(Boolean)));

    const newCustomersToInsert = uniqueBhsNames
      .filter(name => !existingNames.has(name.toLowerCase()))
      .map(name => ({
        CUSTOMER_NAME: name,
        CREDIT_APP: 'No',
        LICENCE: 'No',
        LICENCE_DATE: '',
        TRN: 'No',
        PASSPORT: 'No',
        PASSPORT_DATE: '',
        ID_CARD: 'No',
        ID_DATE: ''
      }));

    if (newCustomersToInsert.length > 0) {
      const { error: insertError } = await bhs_supabas
        .from('web_CUSTOMERSDOCUMENTS')
        .insert(newCustomersToInsert);
      
      if (insertError) {
        console.error('Error inserting synced customers:', insertError);
      } else {
        console.log(`Successfully synced and inserted ${newCustomersToInsert.length} new customers.`);
      }
    }
  } catch (err) {
    console.error('Failed to run syncCustomersFromBhs:', err);
  }
}

export async function GET() {
  try {
    // 1. Perform auto-sync from bhs_CUSTOMERS before listing
    await syncCustomersFromBhs();

    // 2. Normal fetch from web_CUSTOMERSDOCUMENTS
    const { data, error } = await bhs_supabas
      .from('web_CUSTOMERSDOCUMENTS')
      .select('*')
      .order('CUSTOMER_NAME', { ascending: true });

    if (error) {
      if (error.message?.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          error: 'Table web_CUSTOMERSDOCUMENTS does not exist. Please create the table in Supabase first.',
          needsTableCreation: true
        }, { status: 400 });
      }
      throw error;
    }

    const mapped = data.map((r: any) => ({
      rowIndex: r.ID, // Mapped to rowIndex for frontend compatibility
      customerName: r.CUSTOMER_NAME || '',
      creditApp: r.CREDIT_APP || 'No',
      licence: r.LICENCE || 'No',
      licenceDate: r.LICENCE_DATE || '',
      trn: r.TRN || 'No',
      passport: r.PASSPORT || 'No',
      passportDate: r.PASSPORT_DATE || '',
      id: r.ID_CARD || 'No',
      idDate: r.ID_DATE || ''
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in customers-documents GET API:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rowIndex, ...data } = body;

    if (!rowIndex) {
      return NextResponse.json({ success: false, error: 'rowIndex (ID) is required' }, { status: 400 });
    }

    const updateFields: any = {};
    if (data.creditApp !== undefined) updateFields.CREDIT_APP = data.creditApp;
    if (data.licence !== undefined) updateFields.LICENCE = data.licence;
    if (data.licenceDate !== undefined) updateFields.LICENCE_DATE = data.licenceDate;
    if (data.trn !== undefined) updateFields.TRN = data.trn;
    if (data.passport !== undefined) updateFields.PASSPORT = data.passport;
    if (data.passportDate !== undefined) updateFields.PASSPORT_DATE = data.passportDate;
    if (data.id !== undefined) updateFields.ID_CARD = data.id;
    if (data.idDate !== undefined) updateFields.ID_DATE = data.idDate;
    
    updateFields.UPDATED_AT = new Date().toISOString();

    const { data: result, error } = await bhs_supabas
      .from('web_CUSTOMERSDOCUMENTS')
      .update(updateFields)
      .eq('ID', rowIndex)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error in customers-documents POST API:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
