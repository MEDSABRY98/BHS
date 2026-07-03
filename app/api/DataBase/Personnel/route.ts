import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await bhs_supabas
      .from('web_Sales_DB_PERSONNEL')
      .select('*')
      .order('ID', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, roleType, isActive, supervisorId } = body;

    if (!name || !roleType) {
      return NextResponse.json({ error: 'Name and Role Type are required' }, { status: 400 });
    }

    // Generate new ID (R-0001 format)
    const { data: lastRecord, error: maxError } = await bhs_supabas
      .from('web_Sales_DB_PERSONNEL')
      .select('ID')
      .order('ID', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) throw maxError;

    let newId = 'R-0001';
    if (lastRecord && lastRecord.ID) {
      const match = lastRecord.ID.match(/^R-(\d+)$/);
      if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        newId = `R-${nextNum.toString().padStart(4, '0')}`;
      }
    }

    const { error: insertError } = await bhs_supabas
      .from('web_Sales_DB_PERSONNEL')
      .insert({
        ID: newId,
        NAME: name,
        ROLE_TYPE: roleType,
        IS_ACTIVE: isActive !== undefined ? isActive : true,
        SUPERVISOR_ID: roleType === 'merchandiser' ? (supervisorId || null) : null
      });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, message: 'Personnel added successfully', newId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, roleType, isActive, supervisorId } = body;

    if (!id || !name || !roleType) {
      return NextResponse.json({ error: 'ID, Name, and Role Type are required' }, { status: 400 });
    }

    const { error } = await bhs_supabas
      .from('web_Sales_DB_PERSONNEL')
      .update({
        NAME: name,
        ROLE_TYPE: roleType,
        IS_ACTIVE: isActive,
        SUPERVISOR_ID: roleType === 'merchandiser' ? (supervisorId || null) : null
      })
      .eq('ID', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Personnel updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { error } = await bhs_supabas
      .from('web_Sales_DB_PERSONNEL')
      .delete()
      .eq('ID', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Personnel deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
