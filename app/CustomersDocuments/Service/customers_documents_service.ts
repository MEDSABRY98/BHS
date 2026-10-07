'use server';

import { bhs_supabas } from '@/lib/supabase';

// Helper to sync new customers from bhs_CUSTOMERS to web_CUSTOMERSDOCUMENTS
async function syncCustomersFromBhs() {
  try {
    const { data: bhsCustomers, error: bhsError } = await bhs_supabas
      .from('bhs_CUSTOMERS')
      .select('"CUSTOMER ID", "CUSTOMER MAIN NAME"');

    if (bhsError) {
      console.error('Error fetching bhs_CUSTOMERS for sync:', bhsError);
      return;
    }

    const { data: existingDocs, error: docError } = await bhs_supabas
      .from('web_CUSTOMERSDOCUMENTS')
      .select('CUSTOMER_ID');

    if (docError) {
      // Ignore if table doesn't exist yet, it'll be caught in getCustomersDocuments
      return;
    }

    const existingIds = new Set(existingDocs.map(d => d.CUSTOMER_ID?.toString().trim().toLowerCase()));
    
    // Get unique valid customers from BHS based on ID
    const uniqueBhsCustomers = new Map();
    bhsCustomers.forEach(c => {
      const id = c['CUSTOMER ID']?.toString().trim();
      if (id) {
        uniqueBhsCustomers.set(id.toLowerCase(), id);
      }
    });

    const newCustomersToInsert = Array.from(uniqueBhsCustomers.values())
      .filter(id => !existingIds.has(id.toLowerCase()))
      .map(id => ({
        CUSTOMER_ID: id,
        CREDIT_APP: 'No',
        LICENCE: 'No',
        LICENCE_DATE: '',
        TRN: 'No',
        PASSPORT: 'No',
        ID_CARD: 'No',
        CREDIT_APP_DATE: '',
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

export async function getCustomersDocuments() {
  try {
    // 1. Perform auto-sync from bhs_CUSTOMERS before listing
    await syncCustomersFromBhs();

    // 2. Fetch all customers from bhs_CUSTOMERS to get names
    const { data: bhsCustomers, error: custError } = await bhs_supabas
      .from('bhs_CUSTOMERS')
      .select('"CUSTOMER ID", "CUSTOMER MAIN NAME"');

    if (custError) throw custError;

    const customerMap = new Map();
    bhsCustomers.forEach((c: any) => {
      const id = c['CUSTOMER ID']?.toString().trim();
      if (id) {
        customerMap.set(id.toLowerCase(), c['CUSTOMER MAIN NAME'] || 'Unknown Customer');
      }
    });

    // 3. Normal fetch from web_CUSTOMERSDOCUMENTS
    const { data, error } = await bhs_supabas
      .from('web_CUSTOMERSDOCUMENTS')
      .select('*')
      .order('CUSTOMER_ID', { ascending: true });

    if (error) {
      if (error.message?.includes('does not exist')) {
        return {
          success: false,
          error: 'Table web_CUSTOMERSDOCUMENTS does not exist. Please create the table in Supabase first.',
          needsTableCreation: true
        };
      }
      throw error;
    }

    const mapped = data.map((r: any) => {
      const idStr = r.CUSTOMER_ID?.toString().trim();
      return {
        rowIndex: r.ID,
        customerId: idStr,
        customerName: idStr ? (customerMap.get(idStr.toLowerCase()) || idStr) : 'Unknown',
        creditApp: r.CREDIT_APP || 'No',
        creditAppDate: r.CREDIT_APP_DATE || '',
        licence: r.LICENCE || 'No',
        licenceDate: r.LICENCE_DATE || '',
        trn: r.TRN || 'No',
        passport: r.PASSPORT || 'No',
        id: r.ID_CARD || 'No',
      };
    });

    // Sort by name for better UI display
    mapped.sort((a: any, b: any) => a.customerName.localeCompare(b.customerName));

    return { success: true, data: mapped };
  } catch (error: any) {
    console.error('Error in customers-documents GET Service:', error);
    return { success: false, error: error.message };
  }
}

export async function updateCustomerDocument(rowIndex: number | string, data: any) {
  try {
    if (!rowIndex) {
      return { success: false, error: 'rowIndex (ID) is required' };
    }

    const updateFields: any = {};
    if (data.creditApp !== undefined) updateFields.CREDIT_APP = data.creditApp;
    if (data.creditAppDate !== undefined) updateFields.CREDIT_APP_DATE = data.creditAppDate;
    if (data.licence !== undefined) updateFields.LICENCE = data.licence;
    if (data.licenceDate !== undefined) updateFields.LICENCE_DATE = data.licenceDate;
    if (data.trn !== undefined) updateFields.TRN = data.trn;
    if (data.passport !== undefined) updateFields.PASSPORT = data.passport;
    if (data.id !== undefined) updateFields.ID_CARD = data.id;

    updateFields.UPDATED_AT = new Date().toISOString();

    const { data: result, error } = await bhs_supabas
      .from('web_CUSTOMERSDOCUMENTS')
      .update(updateFields)
      .eq('ID', rowIndex)
      .select();

    if (error) throw error;

    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error in customers-documents update Service:', error);
    return { success: false, error: error.message };
  }
}
