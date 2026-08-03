export type SessionDownload = {
  name: string;
  type: string;
  tab?: string;
};

export type ActivitySessionPayload = {
  USER_ID: string;
  MODULE_NAME: string;
  FILE_NAME?: string | null;
  SESSION_ENTERED_AT?: string | null;
  SESSION_EXITED_AT?: string | null;
  SESSION_MINUTES?: number | null;
};

export type ActivityRecord = ActivitySessionPayload & {
  ID: string;
  CREATED_AT: string;
};

export type ActivityByUserRow = {
  userId: string;
  userName: string;
  sessions: number;
  downloads: number;
  modules: string[];
  lastActivity: string | null;
  sessionMinutes: number;
};

export type ActivityByModuleRow = {
  moduleName: string;
  uniqueUsers: number;
  sessions: number;
  downloads: number;
  userIds: string[];
  sessionMinutes: number;
};

export type ActivitySummaryResponse = {
  events: ActivityRecord[];
  byUser: ActivityByUserRow[];
  byModule: ActivityByModuleRow[];
  userNames: Record<string, string>;
};

export function ParseSessionDownloads(raw: string | null | undefined): SessionDownload[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [{ name: raw, type: 'file' }];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const name = String(row.name ?? row.fileName ?? row.FILE_NAME ?? '').trim();
        if (!name) return null;
        const tab = String(row.tab ?? row.sourceTab ?? row.TAB ?? '').trim();
        return {
          name,
          type: String(row.type ?? row.fileType ?? row.FILE_TYPE ?? 'file').trim() || 'file',
          ...(tab ? { tab } : {}),
        };
      })
      .filter((item): item is SessionDownload => item !== null);
  } catch {
    return [{ name: raw, type: 'file' }];
  }
}

export function SerializeSessionDownloads(files: SessionDownload[]): string | null {
  if (!files.length) return null;
  return JSON.stringify(files);
}

export function CountSessionDownloads(events: ActivityRecord[]): number {
  return events.reduce((sum, event) => sum + ParseSessionDownloads(event.FILE_NAME).length, 0);
}
