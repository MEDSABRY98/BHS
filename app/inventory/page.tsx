'use client';

import { useState, useEffect } from 'react';
import ProductAnalyzer from '@/components/ProductAnalyzerTab';
import ProductOrdersTab from '@/components/ProductOrdersTab';
import ProductOrdersMakeTab, { OrderItem } from '@/components/ProductOrdersMakeTab';
import Login from '@/components/Login';
import { ArrowLeft, Box } from 'lucide-react';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'analyzer' | 'orders' | 'make'>('orders');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Shared state for Orders
  const [poNumber, setPoNumber] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    // Fetch next PO Number from API
    const fetchPoNumber = async () => {
      try {
        const res = await fetch('/api/inventory/next-po');
        const data = await res.json();
        if (data.poNumber) {
          setPoNumber(data.poNumber);
        }
      } catch (error) {
        console.error('Error fetching PO number:', error);
        // Fallback
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        setPoNumber(`PO-${dateStr}-ERROR`);
      }
    };
    fetchPoNumber();
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        JSON.parse(savedUser);
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900 pb-12">
      {/* --- Top Navigation Bar --- */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between relative">
          <div className="flex items-center gap-6">
            <button
              onClick={() => window.location.href = '/'}
              className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-200">
                <Box className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Inventory</h1>
            </div>
          </div>

          {/* Tab Switcher - Centered */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                Orders Tracker
              </button>
              <button
                onClick={() => setActiveTab('make')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'make'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                Make Order
              </button>
              <button
                onClick={() => setActiveTab('analyzer')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'analyzer'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                Stock Analyzer
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className={activeTab === 'analyzer' ? 'block' : 'hidden'}>
          <ProductAnalyzer />
        </div>
        <div className={activeTab === 'orders' ? 'block' : 'hidden'}>
          <ProductOrdersTab orderItems={orderItems} setOrderItems={setOrderItems} />
        </div>
        <div className={activeTab === 'make' ? 'block' : 'hidden'}>
          <ProductOrdersMakeTab
            poNumber={poNumber}
            orderItems={orderItems}
            setOrderItems={setOrderItems}
            setPoNumber={setPoNumber}
          />
        </div>
      </div>
    </div>
  );
}


