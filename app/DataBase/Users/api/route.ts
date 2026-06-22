import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: dbUsers, error } = await bhs_supabas
      .from('bhs_USERS')
      .select('ID, NAME, ROLE, AUTHORITY, IS_SALESMANAGER')
      .order('NAME');

    if (error) throw error;

    const userNames = dbUsers.map(u => ({
      id: u.ID,
      name: u.NAME,
      role: u.AUTHORITY || '',
      userAdmin: u.ROLE,
      isSalesManager: u.IS_SALESMANAGER === true || String(u.IS_SALESMANAGER).toUpperCase() === 'TRUE'
    }));

    return NextResponse.json({ users: userNames });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { name, role } = body;

    if (!name || role === undefined) {
      return NextResponse.json(
        { error: 'Name and role are required' },
        { status: 400 }
      );
    }

    const { error } = await bhs_supabas
      .from('bhs_USERS')
      .update({ AUTHORITY: role })
      .eq('NAME', name);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, password } = body;

    if (!name || !password) {
      return NextResponse.json(
        { error: 'Name and password are required' },
        { status: 400 }
      );
    }

    const { data: user, error } = await bhs_supabas
      .from('bhs_USERS')
      .select('ID, NAME, ROLE, AUTHORITY, IS_SALESMANAGER')
      .eq('NAME', name)
      .eq('PASSWORD', password)
      .maybeSingle();

    if (error) throw error;

    if (user) {
      return NextResponse.json({
        success: true,
        user: {
          id: user.ID,
          name: user.NAME,
          role: user.AUTHORITY || '',
          userAdmin: user.ROLE,
          isSalesManager: user.IS_SALESMANAGER === true || String(user.IS_SALESMANAGER).toUpperCase() === 'TRUE'
        }
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
