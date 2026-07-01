import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import { checkIsManager } from '@/app/Sales/Utils/SalesMappingCache';

export type TargetType = 'sales_rep' | 'merchandiser';

function parseTargetType(value: string | null): TargetType | null {
  if (value === 'sales_rep' || value === 'merchandiser') return value;
  return null;
}

async function loadUserNameMap(): Promise<Map<string, string>> {
  const { data: users, error } = await bhs_supabas.from('bhs_USERS').select('ID, NAME');
  if (error) throw error;
  const map = new Map<string, string>();
  (users || []).forEach((u) => map.set(u.ID, u.NAME));
  return map;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const listYears = searchParams.get('listYears') === 'true';

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const isManager = await checkIsManager(userId);
    if (!isManager) {
      return NextResponse.json({ error: 'Unauthorized. Only sales managers can view targets.' }, { status: 403 });
    }

    if (listYears) {
      const { data: rows, error } = await bhs_supabas
        .from('web_Sales_DB_TARGET')
        .select('YEAR')
        .gte('YEAR', 2025);

      if (error) throw error;

      const years = new Set<number>([2025]);
      (rows || []).forEach((row) => {
        const y = Number(row.YEAR);
        if (y >= 2025) years.add(y);
      });

      return NextResponse.json({
        success: true,
        years: Array.from(years).sort((a, b) => a - b),
      });
    }

    const year = parseInt(searchParams.get('year') || '', 10);
    const month = parseInt(searchParams.get('month') || '', 10);
    const type = parseTargetType(searchParams.get('type'));

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Valid year and month are required' }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json({ error: 'type must be sales_rep or merchandiser' }, { status: 400 });
    }

    const { data: rows, error } = await bhs_supabas
      .from('web_Sales_DB_TARGET')
      .select('"USER_ID", "YEAR", "MONTH", "TARGET_AMOUNT", "TARGET_TYPE"')
      .eq('YEAR', year)
      .eq('MONTH', month)
      .eq('TARGET_TYPE', type);

    if (error) throw error;

    const userMap = await loadUserNameMap();
    const data = (rows || []).map((row) => ({
      userId: row.USER_ID,
      userName: userMap.get(row.USER_ID) || row.USER_ID,
      targetAmount: Number(row.TARGET_AMOUNT) || 0,
      year: row.YEAR,
      month: row.MONTH,
      type: row.TARGET_TYPE as TargetType,
    }));

    data.sort((a, b) => a.userName.localeCompare(b.userName));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('API Error fetching targets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch targets', details: error.message || error },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, targetUserId, year, month, type, targetAmount } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const isManager = await checkIsManager(userId);
    if (!isManager) {
      return NextResponse.json({ error: 'Unauthorized. Only sales managers can save targets.' }, { status: 403 });
    }

    const targetType = parseTargetType(type);
    const y = parseInt(String(year), 10);
    const m = parseInt(String(month), 10);
    const uid = String(targetUserId || '').trim().toUpperCase();
    const amount = Number(targetAmount);

    if (!uid || !targetType || !y || !m || m < 1 || m > 12) {
      return NextResponse.json({ error: 'Invalid target payload' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'Target amount must be a non-negative number' }, { status: 400 });
    }

    const { data: existing } = await bhs_supabas
      .from('web_Sales_DB_TARGET')
      .select('ID')
      .eq('USER_ID', uid)
      .eq('YEAR', y)
      .eq('MONTH', m)
      .eq('TARGET_TYPE', targetType)
      .maybeSingle();

    let saveError;
    if (existing) {
      const { error } = await bhs_supabas
        .from('web_Sales_DB_TARGET')
        .update({ TARGET_AMOUNT: amount })
        .eq('ID', existing.ID);
      saveError = error;
    } else {
      const { error } = await bhs_supabas.from('web_Sales_DB_TARGET').insert({
        USER_ID: uid,
        YEAR: y,
        MONTH: m,
        TARGET_TYPE: targetType,
        TARGET_AMOUNT: amount,
      });
      saveError = error;
    }

    if (saveError) throw saveError;

    return NextResponse.json({ success: true, message: 'Target saved successfully' });
  } catch (error: any) {
    console.error('API Error saving target:', error);
    return NextResponse.json(
      { error: 'Failed to save target', details: error.message || error },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, year, month, type, targets } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const isManager = await checkIsManager(userId);
    if (!isManager) {
      return NextResponse.json({ error: 'Unauthorized. Only sales managers can save targets.' }, { status: 403 });
    }

    const targetType = parseTargetType(type);
    const y = parseInt(String(year), 10);
    const m = parseInt(String(month), 10);

    if (!targetType || !y || !m || m < 1 || m > 12) {
      return NextResponse.json({ error: 'Invalid batch payload' }, { status: 400 });
    }

    if (!Array.isArray(targets)) {
      return NextResponse.json({ error: 'targets array is required' }, { status: 400 });
    }

    for (const row of targets) {
      const uid = String(row.userId || '').trim().toUpperCase();
      const amount = Number(row.targetAmount);
      if (!uid) continue;
      if (!Number.isFinite(amount) || amount < 0) {
        return NextResponse.json({ error: `Invalid amount for user ${uid}` }, { status: 400 });
      }

      const { data: existing } = await bhs_supabas
        .from('web_Sales_DB_TARGET')
        .select('ID')
        .eq('USER_ID', uid)
        .eq('YEAR', y)
        .eq('MONTH', m)
        .eq('TARGET_TYPE', targetType)
        .maybeSingle();

      if (existing) {
        const { error } = await bhs_supabas
          .from('web_Sales_DB_TARGET')
          .update({ TARGET_AMOUNT: amount })
          .eq('ID', existing.ID);
        if (error) throw error;
      } else {
        const { error } = await bhs_supabas.from('web_Sales_DB_TARGET').insert({
          USER_ID: uid,
          YEAR: y,
          MONTH: m,
          TARGET_TYPE: targetType,
          TARGET_AMOUNT: amount,
        });
        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true, message: 'Targets saved successfully' });
  } catch (error: any) {
    console.error('API Error batch saving targets:', error);
    return NextResponse.json(
      { error: 'Failed to save targets', details: error.message || error },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const targetUserId = searchParams.get('targetUserId');
    const year = parseInt(searchParams.get('year') || '', 10);
    const month = parseInt(searchParams.get('month') || '', 10);
    const type = parseTargetType(searchParams.get('type'));

    if (!userId || !targetUserId) {
      return NextResponse.json({ error: 'User ID and target user ID are required' }, { status: 400 });
    }
    if (!year || !month || !type) {
      return NextResponse.json({ error: 'Valid year, month, and type are required' }, { status: 400 });
    }

    const isManager = await checkIsManager(userId);
    if (!isManager) {
      return NextResponse.json({ error: 'Unauthorized. Only sales managers can delete targets.' }, { status: 403 });
    }

    const { error } = await bhs_supabas
      .from('web_Sales_DB_TARGET')
      .delete()
      .eq('USER_ID', targetUserId.trim().toUpperCase())
      .eq('YEAR', year)
      .eq('MONTH', month)
      .eq('TARGET_TYPE', type);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Target deleted successfully' });
  } catch (error: any) {
    console.error('API Error deleting target:', error);
    return NextResponse.json(
      { error: 'Failed to delete target', details: error.message || error },
      { status: 500 }
    );
  }
}
