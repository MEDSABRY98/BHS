import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import { invalidateMappingCache } from '@/lib/MappingCache';

export async function POST(request: Request) {
  try {
    const { userId, mapping } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!mapping || Object.keys(mapping).length === 0) {
      return NextResponse.json({ success: true, message: 'No mapping data provided' });
    }

    // تحويل الكائن (Object) إلى مصفوفة (Array) جاهزة للرفع للسيرفر
    const rows = Object.keys(mapping).map((customerId, index) => {
      const paddedIndex = String(index + 1).padStart(4, '0');
      const data = mapping[customerId];
      return {
        "ID": `R-${paddedIndex}`,
        "USER_ID": userId,
        "CUSTOMER ID": customerId,
        "CUSTOMER MAIN NAME": data.customerMainName || '',
        "CUSTOMER SUB NAME": data.customerName || '',
        "AREA": data.area || '',
        "MARKET": data.market || '',
        "SALES_REP": data.salesRep || '',
        "MERCHANDISER": data.merchandiser || '',
      };
    });

    // 1. مسح المابينج القديم الخاص بهذا المستخدم فقط
    const { error: deleteError } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .delete()
      .eq('USER_ID', userId);

    if (deleteError) {
      console.error('Error deleting old mapping:', deleteError);
      throw deleteError;
    }

    // 2. رفع المابينج الجديد على دفعات (Chunks) لضمان عدم حدوث Timeout لو الشيت كبير
    const chunkSize = 10000;
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

    // 3. Invalidate Memory Cache
    invalidateMappingCache(userId);

    return NextResponse.json({ success: true, message: `Inserted ${rows.length} mappings successfully` });
  } catch (error: any) {
    console.error('API Error saving mapping:', error);
    return NextResponse.json(
      { error: 'Failed to save mapping', details: error.message || error },
      { status: 500 }
    );
  }
}
