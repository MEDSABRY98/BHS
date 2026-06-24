'use client';

import { useState, useEffect, useRef } from 'react';

import CustomersTab from './Components/CustomersTab/CustomersTab';
import CustomersLandingTab from './Components/CustomersTab/CustomersSwitchsTab';
import CustomersGroupTab from './Components/CustomersGroupTab';
import OpenTransactionsTab from './Components/OpenTransactionsTab';
import AllTransactionsTab from './Components/AllTransactionsTab';
import PaymentTrackerTab from './Components/Payment-Tracker/PaymentTrackerTab';
import SalesRepsTab from './Components/SalesRepsTab';
import HistoryTab from './Components/HistoryTab';
import AgesTab from './Components/AgesTab';
import Login from '@/app/Components/Login';
import Loading from '@/app/Components/Loading';
import { InvoiceRow } from '@/types';
import { ArrowLeft, Wallet, LogOut, User, RefreshCcw, Menu } from 'lucide-react';
import DebitSidebar from './Components/DebitSidebar';

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Load sidebar collapsed state on mount
  useEffect(() => {
    const stored = localStorage.getItem('debitSidebarCollapsed');
    if (stored === 'false') {
      setIsSidebarCollapsed(false);
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    localStorage.setItem('debitSidebarCollapsed', String(nextState));
  };
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

  // Enforce subtab permissions
  useEffect(() => {
    if (currentUser && currentUser.name !== 'MED Sabry') {
      try {
        const perms = JSON.parse(currentUser.role || '{}');
        const allowedTabs = perms.debit || perms.debit_tabs;

        if (allowedTabs && Array.isArray(allowedTabs)) {
          // If current tab not allowed, switch to first allowed
          if (!allowedTabs.includes(activeTab)) {
            if (allowedTabs.length > 0) {
              setActiveTab(allowedTabs[0]);
            }
          }
        }
      } catch (e) { }
    }
  }, [currentUser, activeTab]);

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

  const fetchData = async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true);
      else setLoading(true);
      const response = await fetch('/api/Debit');
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
      setIsRefreshing(false);
    }
  };

  const allTabs = [
    { id: 'customers', label: 'Customers' },
    { id: 'customers-group', label: 'Customers Group' },
    { id: 'all-transactions', label: 'All Transactions' },
    { id: 'customers-open-matches', label: 'Open Transactions' },
    { id: 'payment-tracker', label: 'Payment Tracker' },
    { id: 'salesreps', label: 'Sales Reps' },
    { id: 'history', label: 'History' },
    { id: 'ages', label: 'Ages' },
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
              onClick={() => fetchData()}
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
      const allowedTabs = perms.debit || perms.debit_tabs;
      if (allowedTabs && Array.isArray(allowedTabs) && currentUser?.name !== 'MED Sabry') {
        if (!allowedTabs.includes(activeTab)) {
          // If for some reason the activeTab is still not allowed after the useEffect, show nothing or a fallback
          return <div className="p-20 text-center text-slate-400 font-bold">You don't have permission to view this section.</div>;
        }
      }
    } catch (e) {
      // Default to full access if not JSON
    }

    switch (activeTab) {
      case 'customers':
        return <CustomersLandingTab data={data} initialCustomer={initialCustomer} />;
      case 'customers-group':
        return <CustomersGroupTab data={data} />;
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
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <DebitSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUser={currentUser}
          lastUpdated={lastUpdated}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <DebitSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUser={currentUser}
          lastUpdated={lastUpdated}
          isCollapsed={false}
          onToggleCollapse={() => { }}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
          <div className="max-w-[98%] mx-auto px-4 py-3 flex items-center justify-between gap-4 min-h-[5rem]">
            {/* Left section: Hamburger for Mobile, Logo/Refresh/Upload for Desktop */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2.5 text-slate-600 hover:text-slate-900 lg:hidden rounded-xl hover:bg-slate-100 transition-all"
                title="Open Navigation Menu"
              >
                <Menu className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-3">
                {/* Refresh Data Button */}
                <button
                  onClick={() => fetchData(true)}
                  disabled={loading || isRefreshing}
                  className={`p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all ${loading || isRefreshing ? 'opacity-50' : 'hover:scale-105 active:scale-95'}`}
                  title="Refresh Data"
                >
                  <RefreshCcw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Middle Section: Display Active Tab Label */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-lg font-extrabold text-slate-800 tracking-tight">
                {allTabs.find(tab => tab.id === activeTab)?.label || 'Debit Analysis'}
              </span>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-3 w-10 h-10" />
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-[98%] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full">
          <main ref={mainContentRef} className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[calc(100vh-8rem)]">
            {renderTabContent()}
          </main>
        </div>
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

