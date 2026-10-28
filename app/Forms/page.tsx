'use client';

// Forms home: one card per form the user can open. Each form lives in its own folder (e.g. ./SupplierPayment).

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ClipboardList } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';
import { FORMS } from './Shared/FormsRegistry';
import { getAllowedForms } from './Shared/FormsAccess';

export default function FormsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);
  useModuleTabAudit('All Forms');

  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setAllowed(await getAllowedForms());
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load the forms');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await restoreSessionUser();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          await load();
        }
      } finally {
        setIsChecking(false);
      }
    })();
  }, [load]);

  if (isChecking) return <MainLoader message="Loading Forms..." />;
  if (!isAuthenticated)
    return (
      <Login
        onLogin={async (user: any) => {
          setIsAuthenticated(true);
          setCurrentUser(user);
          localStorage.setItem('currentUser', JSON.stringify(user));
          await load();
        }}
      />
    );

  // still loading: the loader alone, in the same place as every module
  if (allowed === null && !loadError)
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full flex flex-col">
          <TabLoader className="!min-h-[70vh] flex-1" />
        </div>
      </div>
    );

  const forms = FORMS.filter((f) => allowed?.includes(f.id)).sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-black">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => (window.location.href = '/')}
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-center transition-colors"
            title="Back Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="w-12 h-12 rounded-2xl bg-[#0a0f1d] text-[#D4AF37] flex items-center justify-center shadow-lg shadow-black/10">
            <ClipboardList className="w-6 h-6" />
          </span>
          <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">Forms</h1>
        </div>

        {loadError ? (
          <TabFetchError message={loadError} onRetry={() => void load()} className="min-h-[50vh]" />
        ) : allowed === null ? (
          <TabLoader className="!min-h-[50vh]" />
        ) : forms.length === 0 ? (
          <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have access to any form.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {forms.map((f) => (
              <button
                key={f.id}
                onClick={() => (window.location.href = f.path)}
                className="group relative overflow-hidden text-left rounded-3xl bg-white border border-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] p-6 min-h-[132px] flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgba(24,46,86,0.35)] hover:border-[#C4A052]/40 transition-all duration-300"
              >
                {/* soft corner glow + accent bar */}
                <span className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br from-[#C4A052]/25 to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity" />
                <span className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-gradient-to-b from-[#182E56] to-[#C4A052] opacity-70 group-hover:opacity-100 transition-opacity" />

                <span className="relative block text-lg font-black tracking-tight text-slate-900">{f.title}</span>

                <span className="relative mt-6 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 group-hover:text-[#182E56] transition-colors">Open</span>
                  <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center group-hover:bg-[#182E56] group-hover:text-[#C4A052] transition-colors">
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
