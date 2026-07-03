import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import { checkIsManager } from '@/app/Sales/Utils/SalesMappingCache';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export type TargetType = 'sales_rep' | 'merchandiser';

function parseTargetType(value: string | null): TargetType | null {
  if (value === 'sales_rep' || value === 'merchandiser') return value;
  return null;
}

// Replaced by inline logic in GET for better merging

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const listYears = searchParams.get('listYears') === 'true';

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const isManager = await checkIsManager(userId);

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

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Valid year and month are required' }, { status: 400 });
    }

    const { data: personnelData, error: personnelError } = await bhs_supabas
      .from('web_Sales_DB_PERSONNEL')
      .select('ID, NAME, ROLE_TYPE, SUPERVISOR_ID')
      .eq('IS_ACTIVE', true);

    if (personnelError && personnelError.code !== '42P01') {
      console.warn('Personnel table error:', personnelError);
    }

    const { data: rows, error } = await bhs_supabas
      .from('web_Sales_DB_TARGET')
      .select('"USER_ID", "YEAR", "MONTH", "TARGET_AMOUNT", "TARGET_TYPE"')
      .eq('YEAR', year)
      .eq('MONTH', month);

    if (error) throw error;

    // Fallbacks for historical data
    const { data: oldUsers } = await bhs_supabas.from('bhs_USERS').select('ID, NAME');
    const nameFallbackMap = new Map<string, string>();
    (oldUsers || []).forEach((u) => nameFallbackMap.set(u.ID, u.NAME));

    const { data: inactivePersonnel } = await bhs_supabas
      .from('web_Sales_DB_PERSONNEL')
      .select('ID, NAME, ROLE_TYPE, SUPERVISOR_ID')
      .eq('IS_ACTIVE', false);
    (inactivePersonnel || []).forEach((p) => nameFallbackMap.set(p.ID, p.NAME));

    const finalDataMap = new Map<string, any>();

    // Add active personnel
    (personnelData || []).forEach((p) => {
      finalDataMap.set(p.ID, {
        userId: p.ID,
        userName: p.NAME,
        targetAmount: 0,
        year,
        month,
        type: p.ROLE_TYPE as TargetType,
        supervisorId: p.SUPERVISOR_ID,
        merchandisers: []
      });
    });

    // Merge actual targets
    (rows || []).forEach((row) => {
      const existing = finalDataMap.get(row.USER_ID);
      if (existing) {
        existing.targetAmount = Number(row.TARGET_AMOUNT) || 0;
      } else {
        const fallbackName = nameFallbackMap.get(row.USER_ID) || row.USER_ID;
        finalDataMap.set(row.USER_ID, {
          userId: row.USER_ID,
          userName: fallbackName,
          targetAmount: Number(row.TARGET_AMOUNT) || 0,
          year: row.YEAR,
          month: row.MONTH,
          type: row.TARGET_TYPE as TargetType,
          supervisorId: null,
          merchandisers: []
        });
      }
    });

    const allData = Array.from(finalDataMap.values());
    allData.sort((a, b) => a.userName.localeCompare(b.userName));

    // Build Hierarchy
    let salesReps: any[] = [];
    const unassignedMerchandisers: any[] = [];
    const repMap = new Map<string, any>();

    allData.forEach(d => {
      if (d.type === 'sales_rep') {
        repMap.set(d.userId, d);
        salesReps.push(d);
      }
    });

    // If not a manager, filter sales reps to only the logged-in user
    if (!isManager) {
      const currentUserName = nameFallbackMap.get(userId?.toUpperCase() || '') || '';
      if (currentUserName) {
        salesReps = salesReps.filter(r => r.userName === currentUserName);
      } else {
        salesReps = []; // Fallback if name not found
      }
    }

    allData.forEach(d => {
      if (d.type === 'merchandiser') {
        if (d.supervisorId && repMap.has(d.supervisorId)) {
          repMap.get(d.supervisorId).merchandisers.push(d);
        } else {
          unassignedMerchandisers.push(d);
        }
      }
    });

    return NextResponse.json({ success: true, data: { salesReps, unassignedMerchandisers }, isManager });
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
    if (!isManager && parseTargetType(type) === 'sales_rep') {
      return NextResponse.json({ error: 'Unauthorized. Sales reps cannot modify their own targets.' }, { status: 403 });
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
      // Check if they are trying to save any sales_rep targets
      const hasSalesRepTarget = targets.some((t: any) => parseTargetType(t.type) === 'sales_rep' || t.type === 'sales_rep');
      if (hasSalesRepTarget) {
        return NextResponse.json({ error: 'Unauthorized. Sales reps cannot modify their own target.' }, { status: 403 });
      }
    }

    const y = parseInt(String(year), 10);
    const m = parseInt(String(month), 10);

    if (!y || !m || m < 1 || m > 12) {
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

      const targetType = parseTargetType(row.type) || 'sales_rep';

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
