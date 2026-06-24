import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  try {
    const { error } = await bhs_supabase.from('mix_DEBIT').delete().neq('ID', 0); // Delete all rows
    if (error) throw error;
    
    return NextResponse.json({ success: true, message: 'All data deleted successfully.' });
  } catch (error: any) {
    console.error('Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete data', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data } = body;
    
    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    // Validation: Ensure all CUSTOMER IDs exist in bhs_CUSTOMERS
    const { data: customersData, error: customersError } = await bhs_supabase.from('bhs_CUSTOMERS').select('"CUSTOMER ID"');
    if (customersError) {
      return NextResponse.json({ error: 'Failed to fetch customers for validation', details: customersError.message }, { status: 500 });
    }

    const validCustomerIds = new Set(customersData.map((c: any) => c['CUSTOMER ID']?.toString().trim()));
    const invalidIds = new Set<string>();

    data.forEach((row: any) => {
      const custId = row['CUSTOMER ID']?.toString().trim();
      if (custId && !validCustomerIds.has(custId)) {
        invalidIds.add(custId);
      }
    });

    if (invalidIds.size > 0) {
      const invalidList = Array.from(invalidIds).join(', ');
      return NextResponse.json({ 
        error: 'Upload stopped! Some Customer IDs do not exist in the Customers database.', 
        details: `Invalid IDs: ${invalidList}` 
      }, { status: 400 });
    }

    // Fetch all existing IDs to find the true numeric max
    const { data: allIds } = await bhs_supabase.from('mix_DEBIT').select('ID');
    let currentMaxId = 0;
    if (allIds && allIds.length > 0) {
      allIds.forEach(row => {
        const match = row.ID?.match(/R-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > currentMaxId) currentMaxId = num;
        }
      });
    }

    // Upsert or Insert data
    const chunkSize = 1000;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize).map((row: any) => {
        const { ID, id, ...rest } = row;
        currentMaxId += 1;
        // Pad with zeros to ensure 4 digits minimum (e.g., R-0001)
        const newId = `R-${currentMaxId.toString().padStart(4, '0')}`;
        return {
          ...rest,
          ID: newId
        };
      });
      const { error } = await bhs_supabase.from('mix_DEBIT').insert(chunk);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, message: `${data.length} rows inserted successfully.` });
  } catch (error: any) {
    console.error('Insert Error:', error);
    return NextResponse.json({ error: 'Failed to insert data', details: error.message }, { status: 500 });
  }
}
