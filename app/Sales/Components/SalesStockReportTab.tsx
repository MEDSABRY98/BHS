'use client';

import { useState, useEffect } from 'react';
import { SalesInvoice } from '@/lib/supabase';;
import { Users, Tag, BarChart2 } from 'lucide-react';
import SalesST_ByCustomers from './SalesST_ByCustomersTab';
import SalesST_ByProduct from './SalesST_ByProductTab';
import Loading from '@/app/Components/Loading';

interface SalesStockReportTabProps {
  refreshTrigger?: number;
  filters: any;
  userId: string;
}

type TabMode = 'customers' | 'products';

export default function SalesStockReportTab({ filters, userId, refreshTrigger }: SalesStockReportTabProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('customers');
  const [loading, setLoading] = useState(true);
  const [customersData, setCustomersData] = useState<any[]>([]);
  const [productList, setProductList] = useState<any[]>([]);

  useEffect(() => {
    const fetchStockData = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch('/api/Sales/StockReport', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters, userId })
        });
        if (!response.ok) throw new Error('Failed to fetch stock report');
        const result = await response.json();
        setCustomersData(result.customersData || []);
        setProductList(result.productList || []);
      } catch (error) {
        console.error('Error fetching stock report data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStockData();
  }, [filters, userId, refreshTrigger]);

  if (loading) {
    return <Loading fullScreen={false} />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Tab Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-medium text-slate-900 tracking-tight">Stock Analysis</h2>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-[20px] backdrop-blur-sm self-stretch sm:self-auto border border-white">
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-[16px] text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'customers'
              ? 'bg-white text-green-600 shadow-md scale-[1.02]'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <Users className="w-4 h-4" />
            <span>By Customers</span>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-[16px] text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'products'
              ? 'bg-white text-indigo-600 shadow-md scale-[1.02]'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <Tag className="w-4 h-4" />
            <span>By Product</span>
          </button>
        </div>
      </div>

      {/* View Content */}
      <div className="transition-all duration-500">
        {activeTab === 'customers' ? (
          <SalesST_ByCustomers customersData={customersData} loading={loading} />
        ) : (
          <SalesST_ByProduct productList={productList} loading={loading} />
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;700;900&display=swap');
        
        :root {
          --font-outfit: 'Outfit', sans-serif;
        }

        .font-outfit {
          font-family: var(--font-outfit);
        }
      `}</style>
    </div>
  );
}

