'use client';

import { useState, useEffect } from 'react';

import InventoryProductsBalanceTab from './Components/InventoryProductsBalanceTab';
import InventoryProductOrdersTab from './Components/InventoryCategoriesTab';
import Login from '@/app/Components/Login';
import Loading from '@/app/Components/Loading';
import { ArrowLeft, Box, Package, Layers } from 'lucide-react';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'products_balance' | 'categories'>('products_balance');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Shared state for Orders
  const [orderItems, setOrderItems] = useState<any[]>([]);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        JSON.parse(savedUser);
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

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  if (isChecking) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-12">
      {/* --- Top Navigation Bar --- */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <button
              onClick={() => window.location.href = '/'}
              className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-200">
                <Box className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Inventory Analysis</h1>
            </div>
          </div>

          {/* Header Navigation Tabs */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <button
              onClick={() => setActiveTab('products_balance')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'products_balance'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-100'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Products Balance</span>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'categories'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-100'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Categories Analysis</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className={activeTab === 'products_balance' ? 'block' : 'hidden'}>
          <InventoryProductsBalanceTab />
        </div>
        <div className={activeTab === 'categories' ? 'block' : 'hidden'}>
          <InventoryProductOrdersTab orderItems={orderItems} setOrderItems={setOrderItems} />
        </div>
      </div>
    </div>
  );
}
