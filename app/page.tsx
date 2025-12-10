'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import CustomersTab from '@/components/CustomersTab';
import CustomersOpenMatchesTab from '@/components/CustomersOpenMatchesTab';
import CustomersByMonthsTab from '@/components/CustomersByMonthsTab';
import SalesRepsTab from '@/components/SalesRepsTab';
import YearsTab from '@/components/YearsTab';
import MonthsTab from '@/components/MonthsTab';
import AgesTab from '@/components/AgesTab';
import AllNotesTab from '@/components/AllNotesTab';
import Login from '@/components/Login';
import { InvoiceRow } from '@/types';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('customers');
  const [data, setData] = useState<InvoiceRow[]>([]);
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
    // Optional: Reset tab or data if needed
    setActiveTab('customers');
    // We keep the data if we want to avoid refetching on immediate relogin, 
    // but usually logout implies clearing session.
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

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading data...</p>
          </div>
        </div>
      );
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

    switch (activeTab) {
      case 'customers':
        return <CustomersTab data={data} />;
      case 'customers-open-matches':
        return <CustomersOpenMatchesTab data={data} />;
      case 'customers-by-months':
        return <CustomersByMonthsTab data={data} />;
      case 'salesreps':
        return <SalesRepsTab data={data} />;
      case 'years':
        return <YearsTab data={data} />;
      case 'months':
        return <MonthsTab data={data} />;
      case 'ages':
        return <AgesTab data={data} />;
      case 'all-notes':
        return <AllNotesTab />;
      default:
        return <CustomersTab data={data} />;
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
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
