'use server';

import { bhs_supabas } from '@/lib/supabase';
import { checkHasSalesDataAccess } from '@/app/Sales/Utils/SalesMappingCache';

export type TargetType = 'sales_rep' | 'merchandiser';

function parseTargetType(value: string | null): TargetType | null {
  if (value === 'sales_rep' || value === 'merchandiser') return value;
  return null;
}

export async function getTargetYears() {
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

  return Array.from(years).sort((a, b) => a - b);
}

export async function getTargetsData(userId: string, year: number, month: number) {
  const isManager = await checkHasSalesDataAccess(userId);

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

  const { data: oldUsers } = await bhs_supabas.from('bhs_USERS').select('ID, NAME');
  const nameFallbackMap = new Map<string, string>();
  (oldUsers || []).forEach((u) => nameFallbackMap.set(u.ID, u.NAME));

  const { data: inactivePersonnel } = await bhs_supabas
    .from('web_Sales_DB_PERSONNEL')
    .select('ID, NAME, ROLE_TYPE, SUPERVISOR_ID')
    .eq('IS_ACTIVE', false);
  (inactivePersonnel || []).forEach((p) => nameFallbackMap.set(p.ID, p.NAME));

  const finalDataMap = new Map<string, any>();

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

  let salesReps: any[] = [];
  const unassignedMerchandisers: any[] = [];
  const repMap = new Map<string, any>();

  allData.forEach(d => {
    if (d.type === 'sales_rep') {
      repMap.set(d.userId, d);
      salesReps.push(d);
    }
  });

  if (!isManager) {
    const currentUserName = nameFallbackMap.get(userId?.toUpperCase() || '') || '';
    if (currentUserName) {
      salesReps = salesReps.filter(r => r.userName === currentUserName);
    } else {
      salesReps = []; 
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

  return { salesReps, unassignedMerchandisers, hasSalesDataAccess: isManager };
}

export async function saveTarget(userId: string, targetUserId: string, year: number, month: number, type: string, targetAmount: number) {
  const isManager = await checkHasSalesDataAccess(userId);
  if (!isManager && parseTargetType(type) === 'sales_rep') {
    throw new Error('Unauthorized. Sales reps cannot modify their own targets.');
  }

  const targetType = parseTargetType(type);
  const uid = String(targetUserId || '').trim().toUpperCase();
  const amount = Number(targetAmount);

  if (!uid || !targetType || !year || !month || month < 1 || month > 12) {
    throw new Error('Invalid target payload');
  }
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Target amount must be a non-negative number');
  }

  const { data: existing } = await bhs_supabas
    .from('web_Sales_DB_TARGET')
    .select('ID')
    .eq('USER_ID', uid)
    .eq('YEAR', year)
    .eq('MONTH', month)
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
      YEAR: year,
      MONTH: month,
      TARGET_TYPE: targetType,
      TARGET_AMOUNT: amount,
    });
    if (error) throw error;
  }

  return { success: true };
}

export async function batchSaveTargets(userId: string, year: number, month: number, type: string, targets: any[]) {
  const isManager = await checkHasSalesDataAccess(userId);
  if (!isManager) {
    const hasSalesRepTarget = targets.some((t: any) => parseTargetType(t.type) === 'sales_rep' || t.type === 'sales_rep');
    if (hasSalesRepTarget) {
      throw new Error('Unauthorized. Sales reps cannot modify their own target.');
    }
  }

  for (const row of targets) {
    const uid = String(row.userId || '').trim().toUpperCase();
    const amount = Number(row.targetAmount);
    if (!uid) continue;
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Invalid amount for user ${uid}`);
    }

    const targetType = parseTargetType(row.type) || 'sales_rep';

    const { data: existing } = await bhs_supabas
      .from('web_Sales_DB_TARGET')
      .select('ID')
      .eq('USER_ID', uid)
      .eq('YEAR', year)
      .eq('MONTH', month)
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
        YEAR: year,
        MONTH: month,
        TARGET_TYPE: targetType,
        TARGET_AMOUNT: amount,
      });
      if (error) throw error;
    }
  }

  return { success: true };
}

export async function deleteTarget(userId: string, targetUserId: string, year: number, month: number, type: string) {
  const targetType = parseTargetType(type);
  if (!targetType) throw new Error('Invalid target type');

  const isManager = await checkHasSalesDataAccess(userId);
  if (!isManager) {
    throw new Error('Unauthorized. Only sales managers can delete targets.');
  }

  const { error } = await bhs_supabas
    .from('web_Sales_DB_TARGET')
    .delete()
    .eq('USER_ID', targetUserId.trim().toUpperCase())
    .eq('YEAR', year)
    .eq('MONTH', month)
    .eq('TARGET_TYPE', targetType);

  if (error) throw error;

  return { success: true };
}
