'use server';
import { getSessionUser, isAdminUser, requireSession, UnauthorizedError } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const TABLE = 'web_Documents_Tracking';
const SYSTEM_ID = 'documents-tracking';
const db = () => getSupabaseAdmin();

/** Session + module access (role JSON systems[] must include documents-tracking when present). */
async function requireDocsAccess() {
  await requireSession();
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (isAdminUser(user)) return user;
  try {
    const perms = JSON.parse(String(user.role || '').trim() || '{}');
    if (Array.isArray(perms?.systems) && !perms.systems.includes(SYSTEM_ID)) {
      throw new UnauthorizedError("You don't have access to Documents Tracking.");
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
  }
  return user;
}

/** Reads every row (Supabase returns max 1000 per request), fixed order. */
async function fetchAll(table: string, columns: string, orderBy: string): Promise<any[]> {
  const out: any[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await db()
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + size - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

function docNumber(id: unknown): number {
  const m = String(id ?? '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

async function nextDocNumber(): Promise<number> {
  const rows = await fetchAll(TABLE, '"DOCUMENT ID"', 'DOCUMENT ID');
  return rows.reduce((max: number, r: any) => Math.max(max, docNumber(r['DOCUMENT ID'])), 0) + 1;
}

const formatDocId = (n: number) => `DOC-${String(n).padStart(4, '0')}`;

/** Refuse to change/delete when the number belongs to more than one document (would hit both). */
async function assertSingleDocument(id: string) {
  const { count, error } = await db().from(TABLE).select('"DOCUMENT ID"', { count: 'exact', head: true }).eq('DOCUMENT ID', id);
  if (error) throw error;
  if ((count ?? 0) > 1) {
    throw new Error(`${id} is used by ${count} documents. Run documents_tracking_duplicates.sql in Supabase to renumber them, then try again.`);
  }
}

function mapUpdate(data: any): Record<string, unknown> {
  const mapData: Record<string, unknown> = {};
  if (data.receivedDate !== undefined) mapData["RECEIVED DATE"] = data.receivedDate;
  if (data.datedSendToOffice !== undefined) mapData["DATED SEND TO OFFICE"] = data.datedSendToOffice;
  if (data.documentDate !== undefined) mapData["DOCUMENT DATE"] = data.documentDate;
  if (data.documentNumber !== undefined) mapData["DOCUMENT NUMBER"] = data.documentNumber;
  if (data.documentName !== undefined) mapData["DOCUMENT NAME"] = data.documentName;
  if (data.receivedFrom !== undefined) mapData["RECEIVED FROM"] = data.receivedFrom;
  if (data.documentAmount !== undefined) {
    const n = parseFloat(data.documentAmount);
    mapData["DOCUMENT AMOUNT"] = Number.isFinite(n) ? n : null;
  }
  if (data.documentNotes !== undefined) mapData["DOCUMENT NOTES"] = data.documentNotes;
  if (data.whoDeliveryForOffice !== undefined) mapData["WHO DELIVERY FOR OFFICE?"] = data.whoDeliveryForOffice;
  if (data.whoTakeFromOffice !== undefined) mapData["WHO TAKE FROM OFFICE?"] = data.whoTakeFromOffice;
  if (data.documentStatus !== undefined) mapData["DOCUMENT STATUS"] = data.documentStatus;
  return mapData;
}

export async function getDocumentsTracking() {
  await requireDocsAccess();
    try {
        const data = (await fetchAll(TABLE, '*', 'DOCUMENT ID'))
            .sort((a, b) => docNumber(a['DOCUMENT ID']) - docNumber(b['DOCUMENT ID']));

        // Map Supabase columns to the frontend expected format
        const records = (data || []).map((row: any) => ({
            rowIndex: row['DOCUMENT ID'],
            documentId: row['DOCUMENT ID'] || '',
            receivedDate: row['RECEIVED DATE'] || '',
            datedSendToOffice: row['DATED SEND TO OFFICE'] || '',
            documentDate: row['DOCUMENT DATE'] || '',
            documentNumber: row['DOCUMENT NUMBER'] || '',
            documentName: row['DOCUMENT NAME'] || '',
            receivedFrom: row['RECEIVED FROM'] || '',
            documentAmount: row['DOCUMENT AMOUNT'] ? parseFloat(row['DOCUMENT AMOUNT']) : 0,
            documentNotes: row['DOCUMENT NOTES'] || '',
            whoDeliveryForOffice: row['WHO DELIVERY FOR OFFICE?'] || '',
            whoTakeFromOffice: row['WHO TAKE FROM OFFICE?'] || '',
            documentStatus: row['DOCUMENT STATUS'] || ''
        }));

        return { records };
    } catch (error) {
        console.error('Service error getting tracking data:', error);
        throw new Error('Failed to fetch tracking data');
    }
}

export async function addDocumentsTrackingRecords(records: any[]) {
  await requireDocsAccess();
    try {
        if (!records || !Array.isArray(records) || records.length === 0) {
            throw new Error('Records array is required');
        }

        // Numbers are always taken on the server from the real last number
        // (the browser's number is ignored). Retry if another user took them meanwhile.
        for (let attempt = 0; attempt < 5; attempt++) {
            const start = await nextDocNumber();
            const insertData = records.map((record: any, i: number) => ({
                "DOCUMENT ID": formatDocId(start + i),
                "RECEIVED DATE": record.receivedDate || '',
                "DATED SEND TO OFFICE": record.datedSendToOffice || '',
                "DOCUMENT DATE": record.documentDate || '',
                "DOCUMENT NUMBER": record.documentNumber || '',
                "DOCUMENT NAME": record.documentName || '',
                "RECEIVED FROM": record.receivedFrom || '',
                "DOCUMENT AMOUNT": record.documentAmount ? parseFloat(record.documentAmount) : null,
                "DOCUMENT NOTES": record.documentNotes || '',
                "WHO DELIVERY FOR OFFICE?": record.whoDeliveryForOffice || '',
                "WHO TAKE FROM OFFICE?": record.whoTakeFromOffice || '',
                "DOCUMENT STATUS": record.documentStatus || ''
            }));

            const { error } = await db().from(TABLE).insert(insertData);
            if (!error) {
                return { success: true, ids: insertData.map((r) => r["DOCUMENT ID"]) };
            }
            if (error.code !== '23505') throw error; // not a duplicate number
        }
        throw new Error('Could not reserve document numbers, please try again');
    } catch (error: any) {
        console.error('Service error adding records:', error);
        throw new Error(error.message || 'Failed to add records');
    }
}

export async function updateDocumentTrackingRecord(rowIndex: string, data: any) {
  await requireDocsAccess();
    try {
        if (!rowIndex) {
            throw new Error('rowIndex is required');
        }
        await assertSingleDocument(rowIndex);

        const { data: updated, error } = await db()
            .from(TABLE)
            .update(mapUpdate(data))
            .eq('DOCUMENT ID', rowIndex)
            .select('"DOCUMENT ID"');

        if (error) throw error;
        if (!updated || updated.length === 0) throw new Error('Document not found — refresh and try again');

        return { success: true };
    } catch (error: any) {
        console.error('Service error updating record:', error);
        throw new Error(error.message || 'Failed to update record');
    }
}

export async function bulkUpdateDocumentsTrackingRecords(updates: { rowIndex: string; data: any }[]) {
  await requireDocsAccess();
    try {
        if (!updates || !Array.isArray(updates)) {
            throw new Error('updates array is required for bulk update');
        }
        if (updates.length === 0) return { success: true };

        // Keep the current values so everything can be put back if one update fails
        const ids = updates.map((u) => u.rowIndex);
        for (const id of new Set(ids)) await assertSingleDocument(id);
        const { data: before, error: beforeErr } = await db().from(TABLE).select('*').in('DOCUMENT ID', ids);
        if (beforeErr) throw beforeErr;

        const done: string[] = [];
        try {
            for (const update of updates) {
                const mapData = mapUpdate(update.data);
                const { error } = await db().from(TABLE).update(mapData).eq('DOCUMENT ID', update.rowIndex);
                if (error) throw error;
                done.push(update.rowIndex);
            }
        } catch (err) {
            // Roll back the ones already changed
            for (const id of done) {
                const original = (before || []).find((r: any) => r['DOCUMENT ID'] === id);
                if (!original) continue;
                const restore = mapUpdate({
                    receivedDate: original['RECEIVED DATE'],
                    datedSendToOffice: original['DATED SEND TO OFFICE'],
                    documentDate: original['DOCUMENT DATE'],
                    documentNumber: original['DOCUMENT NUMBER'],
                    documentName: original['DOCUMENT NAME'],
                    receivedFrom: original['RECEIVED FROM'],
                    documentAmount: original['DOCUMENT AMOUNT'],
                    documentNotes: original['DOCUMENT NOTES'],
                    whoDeliveryForOffice: original['WHO DELIVERY FOR OFFICE?'],
                    whoTakeFromOffice: original['WHO TAKE FROM OFFICE?'],
                    documentStatus: original['DOCUMENT STATUS'],
                });
                await db().from(TABLE).update(restore).eq('DOCUMENT ID', id);
            }
            throw err;
        }

        return { success: true };
    } catch (error: any) {
        console.error('Service error bulk updating records:', error);
        throw new Error((error.message || 'Failed to update records') + ' — no documents were changed.');
    }
}

export async function deleteDocumentTrackingRecord(rowIndex: string) {
  await requireDocsAccess();
    try {
        if (!rowIndex) {
            throw new Error('rowIndex is required');
        }
        await assertSingleDocument(rowIndex);

        const { error } = await db()
            .from('web_Documents_Tracking')
            .delete()
            .eq('DOCUMENT ID', rowIndex);

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        console.error('Service error deleting record:', error);
        throw new Error(error.message || 'Failed to delete record');
    }
}

export async function getCustomers() {
  await requireDocsAccess();
    try {
        const data = await fetchAll('bhs_CUSTOMERS', '"CUSTOMER ID", "CUSTOMER MAIN NAME"', 'CUSTOMER ID');

        const uniqueNames = new Set<string>();
        const uniqueCustomers: { id: string, name: string }[] = [];

        (data || []).forEach((r: any) => {
            const name = (r['CUSTOMER MAIN NAME'] || '').trim();
            if (name && !uniqueNames.has(name)) {
                uniqueNames.add(name);
                uniqueCustomers.push({
                    id: r['CUSTOMER ID'] || '',
                    name: name
                });
            }
        });

        return { customers: uniqueCustomers };
    } catch (error) {
        console.error('Error fetching customers:', error);
        return { customers: [] };
    }
}

export async function getDeliveryPersonnel() {
  await requireDocsAccess();
    try {
        const data = await fetchAll(TABLE, '"DOCUMENT ID", "WHO DELIVERY FOR OFFICE?", "WHO TAKE FROM OFFICE?", "RECEIVED FROM"', 'DOCUMENT ID');

        // Fetch users from bhs_USERS as well to provide autocomplete for new staff
        const { data: userData, error: userError } = await db()
            .from('bhs_USERS')
            .select('NAME');
            
        if (userError) console.error('Error fetching users:', userError);

        const reps = new Set<string>();
        const receivers = new Set<string>();
        const receivedFromSet = new Set<string>();

        // Add historical names
        (data || []).forEach((r: any) => {
            const rep = (r['WHO DELIVERY FOR OFFICE?'] || '').trim();
            const receiver = (r['WHO TAKE FROM OFFICE?'] || '').trim();
            const receivedFrom = (r['RECEIVED FROM'] || '').trim();
            if (rep) reps.add(rep);
            if (receiver) receivers.add(receiver);
            if (receivedFrom) receivedFromSet.add(receivedFrom);
        });

        // Add actual user names
        (userData || []).forEach((u: any) => {
            const userName = (u.NAME || '').trim();
            if (userName) {
                reps.add(userName);
                receivers.add(userName);
            }
        });

        return {
            representatives: Array.from(reps).sort(),
            receivers: Array.from(receivers).sort(),
            receivedFromList: Array.from(receivedFromSet).sort()
        };
    } catch (error) {
        console.error('Error fetching delivery personnel:', error);
        return { representatives: [], receivers: [], receivedFromList: [] };
    }
}
