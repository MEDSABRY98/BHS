'use client';

import { Suspense, useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, RefreshCcw } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { DebitDataProvider, useDebitData } from '@/app/Debit/Context/DebitDataContext';
import { toast } from '@/app/Components/Notification';
import DebitInsightsDashboard from './DebitInsightsDashboard';
import { useDebitInsightsTabAudit } from '@/app/Audit/Modules/DebitInsightsTabAudit';

function isInsightsAllowed(currentUser: any): boolean {
  const userName = currentUser?.name?.toLowerCase() || '';
  if (userName === 'med sabry') return true;

  try {
    const perms = JSON.parse(currentUser?.role || '{}');
    if (Array.isArray(perms.systems)) {
      if (perms.systems.includes('debit_insights')) return true;
      return perms.systems.includes('debit');
    }
  } catch {
    // default allow
  }
  return true;
}

function DebitInsightsContent({ currentUser }: { currentUser: any }) {
  const { data, loading, isRefreshing, error, refresh, ensureFullData } = useDebitData();
  useDebitInsightsTabAudit();

  useEffect(() => {
    void ensureFullData();
  }, [ensureFullData]);

  const handleRefresh = async () => {
    const loadingId = toast.loading('Refreshing debit data...');
    await refresh(true);
    toast.dismiss(loadingId);
    toast.success('Debit data refreshed.');
  };

  if (!isInsightsAllowed(currentUser)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-gray-600 font-medium">You do not have access to Debit Insights.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-8 lg:px-10 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 min-h-[5rem]">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Debit Insights</h1>
              </div>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={loading || isRefreshing}
                className={`p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all ${loading || isRefreshing ? 'opacity-50' : 'hover:scale-105 active:scale-95'}`}
                title="Refresh Data"
              >
                <RefreshCcw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-8 lg:px-10 pt-4 pb-6">
        {error ? (
          <TabFetchError
            message={error}
            onRetry={async () => {
              toast.info('Retrying data load...');
              await refresh();
            }}
          />
        ) : (
          <DebitInsightsDashboard data={data} loading={loading} />
        )}
      </div>
    </div>
  );
}

function DebitInsightsPageInner() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('currentUser');
      }
    }
    setIsChecking(false);
  }, []);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  if (isChecking) return <Loading />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  return (
    <DebitDataProvider enabled={isAuthenticated}>
      <DebitInsightsContent currentUser={currentUser} />
    </DebitDataProvider>
  );
}

export default function DebitInsightsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <DebitInsightsPageInner />
    </Suspense>
  );
}
