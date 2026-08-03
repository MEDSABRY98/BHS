'use client';

import type { ActivitySessionPayload, SessionDownload } from './ActivityTypes';
import { SerializeSessionDownloads } from './ActivityTypes';
import { ResolveModuleName } from './ModulePathMap';
import { IngestActivityEvents } from '@/app/Audit/Service/AuditService';

const FLUSH_INTERVAL_MS = 45_000;
const MAX_QUEUE_SIZE = 50;

type QueuedSession = ActivitySessionPayload;

type ActiveSession = {
  moduleName: string;
  enteredAt: string;
  downloads: SessionDownload[];
};

let queue: QueuedSession[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let activeSession: ActiveSession | null = null;
let initialized = false;

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

function SessionMinutes(enteredAt: string, exitedAt: string): number {
  const entered = new Date(enteredAt).getTime();
  const exited = new Date(exitedAt).getTime();
  if (!Number.isFinite(entered) || !Number.isFinite(exited) || exited <= entered) return 0;
  return Math.max(0, Math.round((exited - entered) / 60000));
}

function StartSession(moduleName: string, enteredAt: string = new Date().toISOString()) {
  activeSession = { moduleName, enteredAt, downloads: [] };
}

function ResumeSessionIfNeeded() {
  if (activeSession || typeof window === 'undefined') return;
  const userId = GetCurrentUserId();
  const moduleName = ResolveModuleName(window.location.pathname);
  if (!userId || !moduleName) return;
  StartSession(moduleName);
}

function CloseActiveSession(exitedAt: string = new Date().toISOString()): boolean {
  if (!activeSession) return false;

  const userId = GetCurrentUserId();
  const { moduleName, enteredAt, downloads } = activeSession;
  activeSession = null;

  if (!userId) return false;

  Enqueue({
    USER_ID: userId,
    MODULE_NAME: moduleName,
    FILE_NAME: SerializeSessionDownloads(downloads),
    SESSION_ENTERED_AT: enteredAt,
    SESSION_EXITED_AT: exitedAt,
    SESSION_MINUTES: SessionMinutes(enteredAt, exitedAt),
  });
  return true;
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

function CloseSessionAndSend() {
  CloseActiveSession();
  void FlushActivityQueue();
}

export async function CloseSessionAndFlush() {
  CloseActiveSession();
  await FlushActivityQueue();
}

function EnsureFlushLoop() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  flushTimer = setInterval(() => {
    void FlushActivityQueue();
  }, FLUSH_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      CloseSessionAndSend();
      return;
    }
    ResumeSessionIfNeeded();
  });

  window.addEventListener('pagehide', () => {
    CloseSessionAndSend();
  });
}

export function InitActivityQueue() {
  EnsureFlushLoop();
}

export function TrackModuleVisit(pathname: string) {
  const userId = GetCurrentUserId();
  const moduleName = ResolveModuleName(pathname);
  if (!userId || !moduleName) return;

  if (activeSession?.moduleName === moduleName) return;

  CloseSessionAndSend();
  StartSession(moduleName);
  EnsureFlushLoop();
}

export function TrackDownload(fileName: string, fileType: string) {
  const userId = GetCurrentUserId();
  if (!userId || !fileName) return;

  const moduleName = ResolveModuleName(window.location.pathname) ?? 'Unknown Module';
  EnsureFlushLoop();

  if (!activeSession || activeSession.moduleName !== moduleName) {
    if (activeSession) CloseSessionAndSend();
    StartSession(moduleName);
  }

  activeSession!.downloads.push({ name: fileName, type: fileType });
}

export function InferFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'zip') return 'zip';
  return ext || 'file';
}
