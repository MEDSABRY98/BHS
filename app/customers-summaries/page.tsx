'use client';

import { Suspense, useEffect, useState } from 'react';
import CustomersSummariesTab from '@/components/02-Debit/CustomersSummariesTab';
import Login from '@/components/01-Unified/Login';
import Loading from '@/components/01-Unified/Loading';
import { ArrowLeft, RefreshCcw, FileSpreadsheet } from 'lucide-react';
import { InvoiceRow } from '@/types';

function CustomersSummariesPageContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [data, setData] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem('currentUser');
      }
    }
    setIsChecking(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const fetchData = async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true);
      else if (data.length === 0) setLoading(true);

      const response = await fetch('/api/sheets');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to fetch data');
      }

      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  if (isChecking) return <Loading />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const isInitialLoading = loading && data.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
        <div className="w-full px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 min-h-[5rem]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.location.href = '/'}
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-slate-800">Customers Summaries</h1>
              <button
                onClick={() => fetchData(true)}
                disabled={loading || isRefreshing}
                className={`p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all ${loading || isRefreshing ? 'opacity-50' : 'hover:scale-105 active:scale-95'}`}
                title="Refresh Data"
              >
                <RefreshCcw className={`w-5 h-5 ${loading || isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-2 sm:px-4 pt-4">
        <main className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[calc(100vh-7rem)]">
          {isInitialLoading ? (
            <Loading message="Loading Summaries Data..." />
          ) : error && data.length === 0 ? (
            <div className="flex items-center justify-center h-full pt-20">
              <div className="text-center bg-red-50 p-6 rounded-lg max-w-md">
                <p className="text-red-600 text-lg mb-4 font-semibold">Error loading data</p>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={() => fetchData()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 shadow-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <CustomersSummariesTab data={data} onRefresh={() => fetchData(true)} />
          )}
        </main>
      </div>
    </div>
  );
}

export default function CustomersSummariesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CustomersSummariesPageContent />
    </Suspense>
  );
}
