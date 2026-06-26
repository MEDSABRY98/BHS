'use client';

import { useState, useEffect } from 'react';
import InventoryCountingTab from './InventoryCountingTab';
import Login from '@/app/Components/Login';
import Loading from '@/app/Components/Loading';
import { ArrowLeft, ClipboardList, Lock } from 'lucide-react';

function hasInventoryCountingAccess(user: any): boolean {
  const userName = user?.name?.toLowerCase() || '';
  if (userName === 'med sabry') return true;

  try {
    const perms = JSON.parse(user?.role || '{}');

    if (perms.systems && Array.isArray(perms.systems)) {
      if (perms.systems.includes('inventory-counting')) return true;
    }

    const countingTabs = perms['inventory-counting'];
    if (Array.isArray(countingTabs) && countingTabs.length > 0) return true;

    const inventoryTabs = perms.inventory;
    if (Array.isArray(inventoryTabs)) {
      const legacyCountingIds = ['counting', 'normal_total', 'normal_record', 'damage_total', 'damage_record'];
      if (inventoryTabs.some((tabId: string) => legacyCountingIds.includes(tabId))) {
        return true;
      }
    }

    if (!perms.systems) return true;
  } catch {
    return true;
  }

  return false;
}

export default function InventoryCountingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setIsAuthenticated(true);
        setIsAllowed(hasInventoryCountingAccess(parsed));
      } catch {
        localStorage.removeItem('currentUser');
      } finally {
        setIsChecking(false);
      }
    } else {
      setIsChecking(false);
    }
  }, []);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    localStorage.setItem('currentUser', JSON.stringify(user));
    setIsAllowed(hasInventoryCountingAccess(user));
  };

  if (isChecking) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-lg border border-slate-200/60 flex flex-col items-center">
          <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mb-6 text-red-500 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Access Denied</h2>
          <p className="text-slate-500 mt-2 font-medium">You do not have permission to access Inventory Counting.</p>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="mt-8 w-full flex items-center justify-center gap-2.5 bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md active:scale-95 text-sm uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900 pb-12">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => { window.location.href = '/'; }}
              className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-200">
                <ClipboardList className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Inventory Counting</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <InventoryCountingTab />
        </div>
      </div>
    </div>
  );
}
