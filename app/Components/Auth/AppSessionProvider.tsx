'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { fetchUserSession } from '@/app/DataBase/Service/database_service';

const POLL_MS = 20_000;
export const SESSION_EVENT = 'bhs-permissions-updated';

export type SessionUser = {
  id?: string;
  name?: string;
  NAME?: string;
  role?: string;
  userAdmin?: string;
  salesDataAccess?: boolean;
  [key: string]: unknown;
} | null;

const SessionContext = createContext<SessionUser>(null);

const PATH_SYSTEMS = [
  { prefix: '/CashReceipt', id: 'cash-receipt' },
  { prefix: '/CashHandover', id: 'cash-handover' },
  { prefix: '/PettyCash', id: 'petty-cash' },
  { prefix: '/DocumentsTracking', id: 'documents-tracking' },
  { prefix: '/CustomersSummaries', id: 'customers-summaries' },
  { prefix: '/DebitInsights', id: 'debit_insights' },
  { prefix: '/Debit', id: 'debit' },
  { prefix: '/CustomersDocuments', id: 'customers-documents' },
  { prefix: '/InventoryAnalysis', id: 'inventory' },
  { prefix: '/InventoryItemCode', id: 'inventory-item-code' },
  { prefix: '/InventoryCounting', id: 'inventory-counting' },
  { prefix: '/InventoryScrap', id: 'inventory-scrap' },
  { prefix: '/PurchasePriceTracking', id: 'purchase-price-tracking' },
  { prefix: '/Sales', id: 'sales' },
  { prefix: '/LPOs', id: 'lpo-management' },
  { prefix: '/DataBase', id: 'database' },
  { prefix: '/CustomersDiscounts', id: 'customers-discounts' },
].sort((a, b) => b.prefix.length - a.prefix.length);

function readStoredUser(): SessionUser {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('currentUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function resolveSystemId(pathname: string): string | null {
  if (!pathname || pathname === '/') return null;
  if (pathname === '/AdminControl' || pathname.startsWith('/AdminControl/')) return null;
  const match = PATH_SYSTEMS.find((route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`));
  return match?.id ?? null;
}

function isUnrestricted(user: SessionUser): boolean {
  if (!user) return false;
  const name = String(user.name || user.NAME || '').trim().toLowerCase();
  if (name === 'med sabry') return true;
  if (String(user.userAdmin || '').trim().toLowerCase() === 'admin') return true;
  if (String(user.role || '').trim() === 'Admin') return true;
  return false;
}

function isSystemAllowed(user: SessionUser, systemId: string): boolean {
  if (!user || isUnrestricted(user)) return true;
  try {
    const roleStr = String(user.role || '').trim();
    if (!roleStr) return true;
    const perms = JSON.parse(roleStr);
    if (Array.isArray(perms.systems)) return perms.systems.includes(systemId);
  } catch {
    return true;
  }
  return true;
}

function sessionFingerprint(user: SessionUser): string {
  if (!user) return '';
  return `${user.id ?? ''}|${user.name ?? user.NAME ?? ''}|${user.role ?? ''}|${user.userAdmin ?? ''}|${String(user.salesDataAccess ?? '')}`;
}

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser>(null);
  const pathname = usePathname();
  const router = useRouter();
  const userRef = useRef<SessionUser>(null);
  const pathnameRef = useRef(pathname);
  userRef.current = user;
  pathnameRef.current = pathname;

  const applyUser = useCallback((next: SessionUser) => {
    const prev = userRef.current;
    if (sessionFingerprint(prev) === sessionFingerprint(next)) {
      const systemId = resolveSystemId(pathnameRef.current);
      if (systemId && next && !isSystemAllowed(next, systemId)) {
        router.replace('/');
      }
      return;
    }

    setUser(next);
    if (next) {
      try {
        const stored = readStoredUser() || {};
        const merged = { ...stored, ...next };
        localStorage.setItem('currentUser', JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: merged }));
      } catch {
        // ignore storage errors
      }
    }

    const systemId = resolveSystemId(pathnameRef.current);
    if (systemId && next && !isSystemAllowed(next, systemId)) {
      router.replace('/');
    }
  }, [router]);

  const syncFromDb = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    const stored = readStoredUser();
    const name = String(stored?.name || stored?.NAME || '').trim();
    if (!name) {
      if (userRef.current) setUser(null);
      return;
    }

    const result = await fetchUserSession(name);
    if (!result.success || !result.user) return;
    applyUser({ ...(stored || {}), ...result.user });
  }, [applyUser]);

  useEffect(() => {
    setUser(readStoredUser());
    void syncFromDb();

    const timer = window.setInterval(() => {
      void syncFromDb();
    }, POLL_MS);

    const onFocus = () => {
      void syncFromDb();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void syncFromDb();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'currentUser') setUser(readStoredUser());
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, [syncFromDb]);

  useEffect(() => {
    const systemId = resolveSystemId(pathname);
    if (systemId && user && !isSystemAllowed(user, systemId)) {
      router.replace('/');
    }
  }, [pathname, user, router]);

  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useLiveCurrentUser(): SessionUser {
  return useContext(SessionContext);
}

export function useSyncLiveUser(setCurrentUser: (value: any) => void) {
  const liveUser = useLiveCurrentUser();

  useEffect(() => {
    if (!liveUser) return;
    setCurrentUser((prev: any) => {
      if (!prev) return liveUser;
      if (
        prev.role === liveUser.role &&
        prev.userAdmin === liveUser.userAdmin &&
        prev.salesDataAccess === liveUser.salesDataAccess
      ) {
        return prev;
      }
      return { ...prev, ...liveUser };
    });
  }, [liveUser, setCurrentUser]);

  return liveUser;
}
