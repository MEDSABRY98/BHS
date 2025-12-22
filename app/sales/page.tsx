'use client';

import { useState, useEffect } from 'react';
import SalesSidebar from '@/components/SalesSidebar';
import SalesOverviewTab from '@/components/SalesOverviewTab';
import SalesCustomersTab from '@/components/SalesCustomersTab';
import SalesProductsTab from '@/components/SalesProductsTab';
import Login from '@/components/Login';
import { SalesInvoice } from '@/lib/googleSheets';

export default function SalesPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('sales-overview');
  const [data, setData] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

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

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
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

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading sales data...</p>
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
      case 'sales-customers':
        return <SalesCustomersTab data={data} loading={loading} />;
      case 'sales-products':
        return <SalesProductsTab data={data} loading={loading} />;
      default:
        return <SalesOverviewTab data={data} loading={loading} />;
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <SalesSidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onLogout={handleLogout}
        currentUser={currentUser}
        lastUpdated={lastUpdated}
      />
      <main className="flex-1 ml-64 overflow-y-auto">
        {renderTabContent()}
      </main>
    </div>
  );
}

