'use client';

import { useState, useEffect, useRef } from 'react';

import CustomersTab from '@/components/CustomersTab';
import CustomersLanding from '@/components/CustomersLanding';
import OpenTransactionsTab from '@/components/OpenTransactionsTab';
import AllTransactionsTab from '@/components/AllTransactionsTab';
import PaymentTrackerTab from '@/components/PaymentTrackerTab';
import SalesRepsTab from '@/components/SalesRepsTab';
import HistoryTab from '@/components/HistoryTab';
import AgesTab from '@/components/AgesTab';
import AllNotesTab from '@/components/AllNotesTab';
import Login from '@/components/Login';
import Loading from '@/components/Loading';
import { InvoiceRow } from '@/types';
import { ArrowLeft, Wallet, LogOut, User } from 'lucide-react';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function DebitPageContent() {
  const searchParams = useSearchParams();
  const initialCustomer = searchParams?.get('customer') || undefined;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('customers');
  const [data, setData] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const mainContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem('currentUser');
      } finally {
        setIsChecking(false);
      }
    } else {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // No longer redirect based on hardcoded lists

  // Reset scroll position when tab changes
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userPassword');
    setActiveTab('customers');
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sheets');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to fetch data');
      }

      setData(result.data);

      // Find the latest date
      if (result.data && result.data.length > 0) {
        const dates = result.data
          .map((row: InvoiceRow) => row.date ? new Date(row.date).getTime() : 0)
          .filter((time: number) => !isNaN(time) && time > 0);

        if (dates.length > 0) {
          const maxDate = new Date(Math.max(...dates));
          setLastUpdated(maxDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }));
        }
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const allTabs = [
    { id: 'customers', label: 'Customers' },
    { id: 'all-transactions', label: 'All Transactions' },
    { id: 'customers-open-matches', label: 'Open Transactions' },
    { id: 'payment-tracker', label: 'Payment Tracker' },
    { id: 'salesreps', label: 'Sales Reps' },
    { id: 'history', label: 'History' },
    { id: 'ages', label: 'Ages' },
    { id: 'all-notes', label: 'All Notes' },
  ];

  const renderTabContent = () => {
    if (loading) {
      return <Loading message="Loading Debit Analysis Data..." />;
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center bg-red-50 p-6 rounded-lg">
            <p className="text-red-600 text-lg mb-4">Error loading data</p>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    // Check for dynamic JSON permission structure
    try {
      const perms = JSON.parse(currentUser?.role || '{}');
      if (perms.debit_tabs && currentUser?.name !== 'MED Sabry') {
        if (!perms.debit_tabs.includes(activeTab)) {
          return <CustomersTab data={data} />;
        }
      }
    } catch (e) {
      // Default to full access if not JSON
    }

    switch (activeTab) {
      case 'customers':
        return <CustomersLanding data={data} initialCustomer={initialCustomer} />;
      case 'all-transactions':
        return <AllTransactionsTab data={data} />;
      case 'customers-open-matches':
        return <OpenTransactionsTab data={data} />;
      case 'payment-tracker':
        return <PaymentTrackerTab data={data} />;
      case 'salesreps':
        return <SalesRepsTab data={data} />;
      case 'history':
        return <HistoryTab data={data} />;
      case 'ages':
        return <AgesTab data={data} />;
      case 'all-notes':
        return <AllNotesTab />;
      default:
        return <CustomersTab data={data} />;
    }
  };

  const isAutoDownload = initialCustomer && searchParams?.get('action') === 'download_report';

  if (isChecking) {
    return <Loading />;
  }

  if (!isAuthenticated && !isAutoDownload) {
    return <Login onLogin={handleLogin} />;
  }

  // If we are just downloading a report, don't show the full program UI (sidebar, header, etc.)
  if (initialCustomer && searchParams?.get('action') === 'download_report') {
    return (
      <div className="min-h-screen bg-white">
        {renderTabContent()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900 pb-12">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
        <div className="max-w-[98%] mx-auto px-4 py-3 flex flex-col xl:flex-row items-center justify-between gap-4 min-h-[5rem] relative">

          {/* Logo & Back */}
          <div className="flex items-center gap-4 shrink-0 w-full xl:w-auto justify-between xl:justify-start">
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.href = '/'}
                className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-200">
                  <Wallet className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Mobile: User/Logout visible here? No, keep layout simple. */}
          </div>

          {/* Wrapped Tabs - Center */}
          <div className="w-full xl:absolute xl:left-1/2 xl:-translate-x-1/2 flex justify-center xl:w-auto">
            <div className="flex items-center justify-center gap-2 h-[42px] overflow-x-auto no-scrollbar">
              {allTabs.map((tab) => {
                // Check for dynamic JSON permission structure
                try {
                  const perms = JSON.parse(currentUser?.role || '{}');
                  if (perms.debit_tabs && currentUser?.name !== 'MED Sabry') {
                    if (!perms.debit_tabs.includes(tab.id)) {
                      return null;
                    }
                  }
                } catch (e) {
                  // Default to full access
                }

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-44 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap text-center ${activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Spacer / User (User removed previously, just spacer or empty) */}
          <div className="hidden xl:block w-auto shrink-0">
            {/* Placeholder to balance the flex justify-between if needed, or keeping it empty is fine */}
          </div>

        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <main ref={mainContentRef} className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[calc(100vh-8rem)]">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
}

export default function DebitPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
      <DebitPageContent />
    </Suspense>
  );
}

