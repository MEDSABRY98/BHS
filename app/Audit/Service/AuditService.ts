'use server';

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { AllocateActivityIds } from '@/app/Audit/Utils/ActivityId';
import {
  CountSessionDownloads,
  ParseSessionDownloads,
  ParseSessionTabs,
  type ActivityByModuleRow,
  type ActivityByUserRow,
  type ActivityRecord,
  type ActivitySessionPayload,
  type ActivitySummaryResponse,
} from '@/app/Audit/Utils/ActivityTypes';

const TABLE = 'bhs_USERS_ACTIVITY';
const USERS_TABLE = 'bhs_USERS';
const ADMIN_NAME = 'MED Sabry';

function IsValidSession(event: unknown): event is ActivitySessionPayload {
  if (!event || typeof event !== 'object') return false;
  const row = event as Record<string, unknown>;
  if (typeof row.USER_ID !== 'string' || !row.USER_ID.trim()) return false;
  if (typeof row.MODULE_NAME !== 'string' || !row.MODULE_NAME.trim()) return false;
  return true;
}

function IsAdmin(name: string | null | undefined): boolean {
  return (name || '').trim().toLowerCase() === ADMIN_NAME.toLowerCase();
}

function DayBounds(dateStr: string): { start: string; end: string } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { start: start.toISOString(), end: end.toISOString() };
}

function SessionMinutes(event: ActivityRecord): number {
  if (typeof event.SESSION_MINUTES === 'number' && event.SESSION_MINUTES >= 0) {
    return event.SESSION_MINUTES;
  }
  if (event.SESSION_ENTERED_AT && event.SESSION_EXITED_AT) {
    const entered = new Date(event.SESSION_ENTERED_AT).getTime();
    const exited = new Date(event.SESSION_EXITED_AT).getTime();
    if (Number.isFinite(entered) && Number.isFinite(exited) && exited > entered) {
      return Math.max(0, Math.round((exited - entered) / 60000));
    }
  }
  return 0;
}

function SumSessionMinutes(events: ActivityRecord[]): number {
  return events.reduce((sum, event) => sum + SessionMinutes(event), 0);
}

function BuildByUser(
  events: ActivityRecord[],
  userNames: Record<string, string>,
): ActivityByUserRow[] {
  const map = new Map<string, ActivityRecord[]>();
  events.forEach((event) => {
    const list = map.get(event.USER_ID) || [];
    list.push(event);
    map.set(event.USER_ID, list);
  });

  return Array.from(map.entries())
    .map(([userId, userEvents]) => {
      const modules = [...new Set(userEvents.map((e) => e.MODULE_NAME))].sort();
      const lastActivity = userEvents.reduce<string | null>((latest, event) => {
        if (!latest || event.CREATED_AT > latest) return event.CREATED_AT;
        return latest;
      }, null);

      return {
        userId,
        userName: userNames[userId] || userId,
        sessions: userEvents.length,
        downloads: CountSessionDownloads(userEvents),
        modules,
        lastActivity,
        sessionMinutes: SumSessionMinutes(userEvents),
      };
    })
    .sort((a, b) => a.userName.localeCompare(b.userName));
}

function BuildByModule(events: ActivityRecord[]): ActivityByModuleRow[] {
  const map = new Map<string, ActivityRecord[]>();
  events.forEach((event) => {
    const list = map.get(event.MODULE_NAME) || [];
    list.push(event);
    map.set(event.MODULE_NAME, list);
  });

  return Array.from(map.entries())
    .map(([moduleName, moduleEvents]) => {
      const userIds = [...new Set(moduleEvents.map((e) => e.USER_ID))].sort();
      return {
        moduleName,
        uniqueUsers: userIds.length,
        sessions: moduleEvents.length,
        downloads: CountSessionDownloads(moduleEvents),
        userIds,
        sessionMinutes: SumSessionMinutes(moduleEvents),
      };
    })
    .sort((a, b) => a.moduleName.localeCompare(b.moduleName));
}

function MapRows(data: Record<string, unknown>[] | null): ActivityRecord[] {
  return (data || []).map((row) => ({
    ID: String(row.ID ?? ''),
    USER_ID: String(row.USER_ID ?? ''),
    MODULE_NAME: String(row.MODULE_NAME ?? ''),
    FILE_NAME: row.FILE_NAME ? String(row.FILE_NAME) : null,
    TABS: row.TABS ? String(row.TABS) : null,
    SESSION_ENTERED_AT: row.SESSION_ENTERED_AT ? String(row.SESSION_ENTERED_AT) : null,
    SESSION_EXITED_AT: row.SESSION_EXITED_AT ? String(row.SESSION_EXITED_AT) : null,
    SESSION_MINUTES:
      row.SESSION_MINUTES === null || row.SESSION_MINUTES === undefined
        ? null
        : Number(row.SESSION_MINUTES),
    CREATED_AT: String(row.CREATED_AT ?? ''),
  }));
}

async function ResolveUserFilter(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userFilter: string,
): Promise<string[] | null> {
  const trimmed = userFilter.trim();
  if (!trimmed) return null;

  if (/^R-\d+/i.test(trimmed)) return [trimmed];

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('ID')
    .or(`NAME.ilike.%${trimmed}%,ID.ilike.%${trimmed}%`);

  if (error) {
    console.error('[AuditService user filter]', error);
    return [trimmed];
  }

  const ids = (data || [])
    .map((row) => String((row as { ID?: string }).ID ?? '').trim())
    .filter(Boolean);

  return ids.length ? ids : [trimmed];
}

async function FetchUserNames(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userIds: string[],
): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return {};

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('ID, NAME')
    .in('ID', uniqueIds);

  if (error) {
    console.error('[AuditService user names]', error);
    return {};
  }

  const map: Record<string, string> = {};
  (data || []).forEach((row) => {
    const id = String((row as { ID?: string }).ID ?? '').trim();
    const name = String((row as { NAME?: string }).NAME ?? '').trim();
    if (id) map[id] = name || id;
  });

  return map;
}

export async function IngestActivityEvents(
  events: ActivitySessionPayload[],
): Promise<{ ok: boolean; inserted: number; ids?: string[]; error?: string }> {
  try {
    if (!events.length) return { ok: true, inserted: 0, ids: [] };

    const validEvents = events.filter(IsValidSession).slice(0, 100);
    if (!validEvents.length) return { ok: false, inserted: 0, error: 'No valid sessions' };

    const supabase = getSupabaseAdmin();
    const ids = await AllocateActivityIds(supabase, validEvents.length);

    const rows = validEvents.map((event, index) => ({
      ID: ids[index],
      USER_ID: event.USER_ID.trim(),
      MODULE_NAME: event.MODULE_NAME.trim(),
      FILE_NAME: event.FILE_NAME ?? null,
      TABS: event.TABS ?? null,
      SESSION_ENTERED_AT: event.SESSION_ENTERED_AT ?? null,
      SESSION_EXITED_AT: event.SESSION_EXITED_AT ?? null,
      SESSION_MINUTES: event.SESSION_MINUTES ?? null,
    }));

    const { error } = await supabase.from(TABLE).insert(rows);
    if (error) {
      console.error('[AuditService ingest]', error);
      return { ok: false, inserted: 0, error: error.message };
    }

    return { ok: true, inserted: rows.length, ids };
  } catch (error) {
    console.error('[AuditService ingest]', error);
    return { ok: false, inserted: 0, error: 'Ingest failed' };
  }
}

export async function UpdateActivitySession(
  id: string,
  patch: {
    MODULE_NAME?: string;
    FILE_NAME?: string | null;
    TABS?: string | null;
    SESSION_EXITED_AT?: string | null;
    SESSION_MINUTES?: number | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const sessionId = id.trim();
    if (!sessionId) return { ok: false, error: 'Missing session id' };

    const supabase = getSupabaseAdmin();
    const row: Record<string, unknown> = {};

    if (patch.MODULE_NAME?.trim()) row.MODULE_NAME = patch.MODULE_NAME.trim();
    if (patch.FILE_NAME !== undefined) row.FILE_NAME = patch.FILE_NAME;
    if (patch.TABS !== undefined) row.TABS = patch.TABS;
    if (patch.SESSION_EXITED_AT !== undefined) row.SESSION_EXITED_AT = patch.SESSION_EXITED_AT;
    if (patch.SESSION_MINUTES !== undefined) row.SESSION_MINUTES = patch.SESSION_MINUTES;

    if (!Object.keys(row).length) return { ok: true };

    const { error } = await supabase.from(TABLE).update(row).eq('ID', sessionId);
    if (error) {
      console.error('[AuditService update]', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error('[AuditService update]', error);
    return { ok: false, error: 'Update failed' };
  }
}

export async function GetActivitySummary(params: {
  date?: string;
  userId?: string;
  moduleName?: string;
  adminName: string;
}): Promise<ActivitySummaryResponse> {
  if (!IsAdmin(params.adminName)) {
    throw new Error('Forbidden');
  }

  const date = params.date || new Date().toISOString().split('T')[0];
  const { start, end } = DayBounds(date);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from(TABLE)
    .select(
      'ID, USER_ID, MODULE_NAME, FILE_NAME, TABS, SESSION_ENTERED_AT, SESSION_EXITED_AT, SESSION_MINUTES, CREATED_AT',
    )
    .gte('CREATED_AT', start)
    .lte('CREATED_AT', end)
    .order('CREATED_AT', { ascending: false })
    .limit(5000);

  if (params.userId?.trim()) {
    const userIds = await ResolveUserFilter(supabase, params.userId);
    if (userIds?.length === 1) query = query.eq('USER_ID', userIds[0]);
    else if (userIds?.length) query = query.in('USER_ID', userIds);
  }
  if (params.moduleName?.trim()) query = query.eq('MODULE_NAME', params.moduleName.trim());

  const { data, error } = await query;
  if (error) {
    console.error('[AuditService summary]', error);
    throw new Error(error.message);
  }

  const events = MapRows(data as Record<string, unknown>[] | null);
  const userNames = await FetchUserNames(supabase, events.map((event) => event.USER_ID));

  return {
    events,
    byUser: BuildByUser(events, userNames),
    byModule: BuildByModule(events),
    userNames,
  };
}

// Re-export for UI
export { ParseSessionDownloads, ParseSessionTabs, CountSessionDownloads };
