'use client';

import { useState, useEffect, useRef } from 'react';
import SalesOverviewTab from '@/components/SalesOverviewTab';
import SalesTop10Tab from '@/components/SalesTop10Tab';
import SalesCustomersTab from '@/components/SalesCustomersTab';
import SalesInactiveCustomersTab from '@/components/SalesInactiveCustomersTab';
import SalesStatisticsTab from '@/components/SalesStatisticsTab';
import SalesDailySalesTab from '@/components/SalesDailySalesTab';
import SalesProductsTab from '@/components/SalesProductsTab';
import SalesDownloadFormTab from '@/components/SalesDownloadFormTab';
import Login from '@/components/Login';
import { SalesInvoice } from '@/lib/googleSheets';
import { ArrowLeft, BarChart3, LogOut, User } from 'lucide-react';

export default function SalesPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('sales-overview');
  const [data, setData] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

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
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

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
    setActiveTab('sales-overview');
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sales');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to fetch sales data');
      }

      setData(result.data);

      // Find the latest date from INVOICE DATE column
      if (result.data && result.data.length > 0) {
        const dates = result.data
          .map((row: SalesInvoice) => row.invoiceDate ? new Date(row.invoiceDate).getTime() : 0)
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
      console.error('Error fetching sales data:', err);
    } finally {
      setLoading(false);
    }
  };

  const allTabs = [
    { id: 'sales-overview', label: 'Overview' },
    { id: 'sales-top10', label: 'Top 10' },
    { id: 'sales-customers', label: 'Customers' },
    { id: 'sales-inactive-customers', label: 'Inactive' },
    { id: 'sales-statistics', label: 'Statistics' },
    { id: 'sales-daily-sales', label: 'Daily Sales' },
    { id: 'sales-products', label: 'Products' },
    { id: 'sales-download-form', label: 'Download' },
  ];

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Load Sales Analysis Data...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center bg-red-50 p-6 rounded-lg">
            <p className="text-red-600 text-lg mb-4">Error loading sales data</p>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'sales-overview':
        return <SalesOverviewTab data={data} loading={loading} />;
      case 'sales-top10':
        return <SalesTop10Tab data={data} loading={loading} />;
      case 'sales-customers':
        return <SalesCustomersTab data={data} loading={loading} />;
      case 'sales-inactive-customers':
        return <SalesInactiveCustomersTab data={data} loading={loading} />;
      case 'sales-statistics':
        return <SalesStatisticsTab data={data} loading={loading} />;
      case 'sales-daily-sales':
        return <SalesDailySalesTab data={data} loading={loading} />;
      case 'sales-products':
        return <SalesProductsTab data={data} loading={loading} />;
      case 'sales-download-form':
        return <SalesDownloadFormTab data={data} loading={loading} />;
      default:
        return <SalesOverviewTab data={data} loading={loading} />;
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-green-100 selection:text-green-900 pb-12">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
        <div className="max-w-[98%] mx-auto px-4 py-3 flex flex-col xl:flex-row items-center justify-between gap-4 min-h-[5rem]">

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
                <div className="bg-gradient-to-br from-green-600 to-emerald-600 text-white p-2.5 rounded-xl shadow-lg shadow-green-200">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h1 className="text-xl font-black text-slate-800 tracking-tight hidden md:block">Sales Analysis</h1>
              </div>
            </div>
          </div>

          {/* Wrapped Tabs - Center */}
          <div className="w-full xl:flex-1">
            <div className="grid grid-cols-8 gap-2 w-fit mx-auto h-[42px] overflow-y-auto no-scrollbar">
              {allTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-36 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap text-center ${activeTab === tab.id
                    ? 'bg-green-600 text-white shadow-md shadow-green-200'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Spacer / User */}
          <div className="hidden xl:block w-auto shrink-0">
            {/* Placeholder or User Menu if needed later */}
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

