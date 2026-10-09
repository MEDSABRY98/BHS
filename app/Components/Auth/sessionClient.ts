'use client';

import { getCurrentUser, logoutAction, verifyUserCredentials } from '@/app/DataBase/Service/database_service';

// One restore per page load, shared by the session provider and the pages.
let restorePromise: Promise<any | null> | null = null;

function readJson(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function doRestore(): Promise<any | null> {
  // 1. Valid session cookie -> fresh user from the server
  const user = await getCurrentUser();
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify({ ...(readJson('currentUser') || {}), ...user }));
    localStorage.removeItem('userPassword');
    return user;
  }

  // 2. One-time migration: users logged in before the session cookie existed
  //    still have the password in localStorage. Use it once to get a cookie,
  //    then delete it from the browser.
  const savedUser = readJson('currentUser');
  const savedPassword = localStorage.getItem('userPassword');
  if (savedUser?.name && savedPassword) {
    try {
      const result = await verifyUserCredentials(savedUser.name, savedPassword);
      if (result.success && result.user) {
        localStorage.setItem('currentUser', JSON.stringify({ ...savedUser, ...result.user }));
        return result.user;
      }
    } finally {
      localStorage.removeItem('userPassword');
    }
  }

  // 3. Not logged in
  localStorage.removeItem('currentUser');
  localStorage.removeItem('userPassword');
  return null;
}

/** Returns the logged-in user (or null). Safe to call from many places. */
export function restoreSessionUser(): Promise<any | null> {
  if (!restorePromise) {
    restorePromise = doRestore().catch((err) => {
      console.error('Session restore failed:', err);
      return readJson('currentUser'); // network error: keep the UI usable, server still enforces auth
    });
    // allow a fresh check later in the same tab (e.g. after login/logout)
    restorePromise.finally(() => setTimeout(() => { restorePromise = null; }, 5000));
  }
  return restorePromise;
}

/** Clears the server session and local user data. */
export async function logoutEverywhere() {
  restorePromise = null;
  localStorage.removeItem('currentUser');
  localStorage.removeItem('userPassword');
  try {
    await logoutAction();
  } catch (err) {
    console.error('Logout failed:', err);
  }
}
