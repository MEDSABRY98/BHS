'use client';

import type { ActivitySessionPayload, SessionDownload, SessionTab } from './ActivityTypes';
import { SerializeSessionDownloads, SerializeSessionTabs } from './ActivityTypes';
import { ResolveModuleName } from './ModulePathMap';
import { IngestActivityEvents, UpdateActivitySession } from '@/app/Audit/Service/AuditService';

const FLUSH_INTERVAL_MS = 45_000;
const MAX_QUEUE_SIZE = 50;
const SESSION_STORAGE_KEY = 'bhs_audit_active_session';

type QueuedSession = ActivitySessionPayload;

type ActiveSession = {
  moduleName: string;
  enteredAt: string;
  downloads: SessionDownload[];
  tabs: SessionTab[];
  recordId: string | null;
};

type StoredSessionState = {
  userId: string;
  moduleName: string;
  recordId: string | null;
  enteredAt: string;
  downloads: SessionDownload[];
  tabs: SessionTab[];
  moduleSubTab: string | null;
  savedAt: string;
};

let queue: QueuedSession[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let activeSession: ActiveSession | null = null;
let moduleSubTab: string | null = null;
let initialized = false;
let resumeCheckDone = false;

function GetCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;
    const user = JSON.parse(raw);
    const id = user?.id ?? user?.ID;
    return id != null && String(id).trim() ? String(id).trim() : null;
  } catch {
    return null;
  }
}

function IsPageReload(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === 'reload';
}

function ReadStoredSession(): StoredSessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSessionState;
  } catch {
    return null;
  }
}

function WriteStoredSession(session: ActiveSession, userId: string) {
  if (typeof window === 'undefined') return;
  const payload: StoredSessionState = {
    userId,
    moduleName: session.moduleName,
    recordId: session.recordId,
    enteredAt: session.enteredAt,
    downloads: session.downloads,
    tabs: session.tabs,
    moduleSubTab,
    savedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
}

function ClearStoredSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function RestoreActiveSession(stored: StoredSessionState): ActiveSession {
  const session: ActiveSession = {
    moduleName: stored.moduleName,
    enteredAt: stored.enteredAt,
    downloads: stored.downloads,
    tabs: stored.tabs,
    recordId: stored.recordId,
  };
  activeSession = session;
  moduleSubTab = stored.moduleSubTab;
  return session;
}

function SessionMinutes(enteredAt: string, exitedAt: string): number {
  const entered = new Date(enteredAt).getTime();
  const exited = new Date(exitedAt).getTime();
  if (!Number.isFinite(entered) || !Number.isFinite(exited) || exited <= entered) return 0;
  return Math.max(0, Math.round((exited - entered) / 60000));
}

async function FinalizeStoredSession(stored: StoredSessionState, exitedAt: string = new Date().toISOString()) {
  const payload = {
    MODULE_NAME: stored.moduleName,
    FILE_NAME: SerializeSessionDownloads(stored.downloads),
    TABS: SerializeSessionTabs(stored.tabs),
    SESSION_EXITED_AT: exitedAt,
    SESSION_MINUTES: SessionMinutes(stored.enteredAt, exitedAt),
  };

  if (stored.recordId) {
    try {
      const result = await UpdateActivitySession(stored.recordId, payload);
      if (result.ok) return;
    } catch {
      // fall through
    }
  }

  Enqueue({
    USER_ID: stored.userId,
    MODULE_NAME: stored.moduleName,
    FILE_NAME: payload.FILE_NAME,
    TABS: payload.TABS,
    SESSION_ENTERED_AT: stored.enteredAt,
    SESSION_EXITED_AT: payload.SESSION_EXITED_AT,
    SESSION_MINUTES: payload.SESSION_MINUTES,
  });
  await FlushActivityQueue();
}

async function ResolveStoredSessionOnLoad(moduleName: string | null, userId: string | null) {
  if (resumeCheckDone) return;
  resumeCheckDone = true;

  const stored = ReadStoredSession();
  if (!stored) return;

  const sameUser = !!userId && stored.userId === userId;
  const sameModule = !!moduleName && stored.moduleName === moduleName;
  const reloadResume = IsPageReload() && sameUser && sameModule;

  if (reloadResume) {
    RestoreActiveSession(stored);
    ClearStoredSession();
    return;
  }

  await FinalizeStoredSession(stored);
  ClearStoredSession();
}

function StartSession(moduleName: string, enteredAt: string = new Date().toISOString()) {
  const session: ActiveSession = {
    moduleName,
    enteredAt,
    downloads: [],
    tabs: [],
    recordId: null,
  };
  activeSession = session;
  void OpenSessionRecord(session);
}

async function OpenSessionRecord(session: ActiveSession) {
  const userId = GetCurrentUserId();
  if (!userId) return;

  const enteredAt = session.enteredAt;
  try {
    const result = await IngestActivityEvents([
      {
        USER_ID: userId,
        MODULE_NAME: session.moduleName,
        FILE_NAME: null,
        TABS: SerializeSessionTabs(session.tabs),
        SESSION_ENTERED_AT: enteredAt,
        SESSION_EXITED_AT: enteredAt,
        SESSION_MINUTES: 0,
      },
    ]);

    if (result.ok && result.ids?.[0] && activeSession === session) {
      session.recordId = result.ids[0];
      WriteStoredSession(session, userId);
      if (session.downloads.length > 0 || session.tabs.length > 0) {
        await PersistSessionState(session);
      }
    }
  } catch {
    // silent — audit must not affect UX
  }
}

async function PersistSessionState(session: ActiveSession) {
  if (!session.recordId) return;

  const userId = GetCurrentUserId();
  if (userId) {
    WriteStoredSession(session, userId);
  }

  try {
    await UpdateActivitySession(session.recordId, {
      MODULE_NAME: session.moduleName,
      FILE_NAME: SerializeSessionDownloads(session.downloads),
      TABS: SerializeSessionTabs(session.tabs),
    });
  } catch {
    // silent — audit must not affect UX
  }
}

async function PersistSessionStateWithRetry(session: ActiveSession) {
  if (session.recordId) {
    await PersistSessionState(session);
    return;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (session.recordId) {
      await PersistSessionState(session);
      return;
    }
    if (activeSession !== session) return;
  }
}

function SnapshotActiveSessionForReload() {
  if (!activeSession) return;
  const userId = GetCurrentUserId();
  if (!userId) return;
  WriteStoredSession(activeSession, userId);
}

async function CloseActiveSession(exitedAt: string = new Date().toISOString()): Promise<boolean> {
  if (!activeSession) return false;

  const userId = GetCurrentUserId();
  const session = activeSession;
  activeSession = null;
  ClearStoredSession();

  if (!userId) return false;

  const payload = {
    MODULE_NAME: session.moduleName,
    FILE_NAME: SerializeSessionDownloads(session.downloads),
    TABS: SerializeSessionTabs(session.tabs),
    SESSION_EXITED_AT: exitedAt,
    SESSION_MINUTES: SessionMinutes(session.enteredAt, exitedAt),
  };

  if (session.recordId) {
    try {
      const result = await UpdateActivitySession(session.recordId, payload);
      if (result.ok) return true;
    } catch {
      // fall through to queued insert
    }
  }

  Enqueue({
    USER_ID: userId,
    MODULE_NAME: session.moduleName,
    FILE_NAME: payload.FILE_NAME,
    TABS: payload.TABS,
    SESSION_ENTERED_AT: session.enteredAt,
    SESSION_EXITED_AT: payload.SESSION_EXITED_AT,
    SESSION_MINUTES: payload.SESSION_MINUTES,
  });
  return true;
}

function EnsureModuleSession(moduleName: string) {
  EnsureFlushLoop();
  if (!activeSession || activeSession.moduleName !== moduleName) {
    void SwitchModuleSession(moduleName);
  }
}

export async function EnsureCurrentModuleSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const userId = GetCurrentUserId();
  const moduleName = ResolveModuleName(window.location.pathname);
  if (!userId || !moduleName) return false;

  EnsureFlushLoop();
  await SwitchModuleSession(moduleName);
  return !!activeSession;
}

export function RefreshCurrentModuleAudit(subTab: string | null = null) {
  TrackModuleSubTab(subTab);
}

let switchSessionPromise: Promise<void> | null = null;

async function SwitchModuleSession(moduleName: string) {
  if (activeSession?.moduleName === moduleName) return;

  if (switchSessionPromise) {
    await switchSessionPromise;
    if (activeSession?.moduleName === moduleName) return;
  }

  switchSessionPromise = (async () => {
    if (activeSession?.moduleName === moduleName) return;

    if (activeSession) {
      await CloseActiveSession();
      await FlushActivityQueue();
    }

    SetModuleSubTab(null);
    StartSession(moduleName);
  })();

  try {
    await switchSessionPromise;
  } finally {
    switchSessionPromise = null;
  }
}

function RecordTabVisit(tabName: string) {
  if (!activeSession) return;

  const normalized = tabName.trim();
  if (!normalized) return;

  const lastTab = activeSession.tabs[activeSession.tabs.length - 1];
  if (lastTab?.name === normalized) return;

  activeSession.tabs.push({
    name: normalized,
    at: new Date().toISOString(),
  });
  void PersistSessionStateWithRetry(activeSession);
}

export function SetModuleSubTab(subTab: string | null) {
  moduleSubTab = subTab?.trim() || null;
}

export function TrackModuleSubTab(subTab: string | null) {
  if (typeof window === 'undefined') return;

  const userId = GetCurrentUserId();
  const moduleName = ResolveModuleName(window.location.pathname);
  if (!userId || !moduleName) return;

  const normalized = subTab?.trim() || null;
  EnsureFlushLoop();

  void (async () => {
    await SwitchModuleSession(moduleName);

    if (normalized) {
      RecordTabVisit(normalized);
    }

    SetModuleSubTab(normalized);

    if (activeSession) {
      WriteStoredSession(activeSession, userId);
      if (normalized) {
        await PersistSessionStateWithRetry(activeSession);
      }
    }
  })();
}

function PushDownload(fileName: string, fileType: string) {
  const download: SessionDownload = { name: fileName, type: fileType };
  if (moduleSubTab) download.tab = moduleSubTab;
  activeSession!.downloads.push(download);
}

function Enqueue(event: QueuedSession) {
  queue.push(event);
  if (queue.length >= MAX_QUEUE_SIZE) {
    void FlushActivityQueue();
  }
}

async function PostEvents(events: QueuedSession[]) {
  if (events.length === 0) return;
  try {
    await IngestActivityEvents(events);
  } catch {
    // silent — audit must not affect UX
  }
}

export async function FlushActivityQueue() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  await PostEvents(batch);
}

export async function CloseSessionAndFlush() {
  await CloseActiveSession();
  await FlushActivityQueue();
}

function EnsureFlushLoop() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  flushTimer = setInterval(() => {
    void FlushActivityQueue();
  }, FLUSH_INTERVAL_MS);

  window.addEventListener('pagehide', () => {
    SnapshotActiveSessionForReload();
  });
}

export function InitActivityQueue() {
  EnsureFlushLoop();
}

export function TrackModuleVisit(pathname: string) {
  const userId = GetCurrentUserId();
  const moduleName = ResolveModuleName(pathname);
  EnsureFlushLoop();

  void (async () => {
    await ResolveStoredSessionOnLoad(moduleName, userId);

    if (!userId) return;

    if (!moduleName) {
      if (activeSession) {
        await CloseActiveSession();
        await FlushActivityQueue();
      }
      SetModuleSubTab(null);
      return;
    }

    if (activeSession?.moduleName === moduleName) return;

    await SwitchModuleSession(moduleName);
  })();
}

export function TrackDownload(fileName: string, fileType: string) {
  const userId = GetCurrentUserId();
  if (!userId || !fileName) return;

  const moduleName = ResolveModuleName(window.location.pathname) ?? 'Unknown Module';
  EnsureModuleSession(moduleName);
  if (!activeSession) return;

  PushDownload(fileName, fileType);
  void PersistSessionStateWithRetry(activeSession);
}

export function InferFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'zip') return 'zip';
  return ext || 'file';
}
