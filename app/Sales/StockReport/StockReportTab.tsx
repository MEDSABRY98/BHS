'use client';

import { useState, useEffect } from 'react';
import { SalesInvoice } from '@/lib/supabase';;
import { Users, Tag, Percent } from 'lucide-react';
import { useSalesRawData } from '@/app/Sales/Context/SalesRawDataContext';
import SalesST_ByCustomers from './ST_ByCustomersTab';
import SalesST_ByProduct from './ST_ByProductTab';
import SalesST_CustomerMarginTab from './ST_CustomerMarginTab';
import SalesTabLoader from '@/app/Sales/Shared/TabLoader';

interface SalesStockReportTabProps {
  userId: string;
  showCosts?: boolean;
}

type TabMode = 'customers' | 'products' | 'margin';

export default function SalesStockReportTab({ userId, showCosts = true }: SalesStockReportTabProps) {
  const { stockReport, loading, ensureRawData } = useSalesRawData();
  const [activeTab, setActiveTab] = useState<TabMode>('customers');

  useEffect(() => {
    void ensureRawData();
  }, [ensureRawData]);

  const customersData = stockReport?.customersData ?? [];
  const subCustomersData = stockReport?.subCustomersData ?? [];
  const productList = stockReport?.productList ?? [];

  if (loading && !stockReport) {
    return <SalesTabLoader />;
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

        <div className="flex w-full sm:flex-1 sm:max-w-3xl sm:min-w-[600px] bg-slate-100 p-1.5 rounded-[20px] backdrop-blur-sm self-stretch sm:self-auto border border-white">
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3 rounded-[16px] text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'customers'
              ? 'bg-white text-green-600 shadow-md scale-[1.02]'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>By Customers</span>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3 rounded-[16px] text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'products'
              ? 'bg-white text-indigo-600 shadow-md scale-[1.02]'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <Tag className="w-4 h-4 shrink-0" />
            <span>By Product</span>
          </button>
          {showCosts && (
            <button
              onClick={() => setActiveTab('margin')}
              className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3 rounded-[16px] text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'margin'
                ? 'bg-white text-emerald-600 shadow-md scale-[1.02]'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <Percent className="w-4 h-4 shrink-0" />
              <span>Profit / Loss</span>
            </button>
          )}
        </div>
      </div>

      {/* View Content */}
      <div className="transition-all duration-500">
        {activeTab === 'customers' ? (
          <SalesST_ByCustomers customersData={customersData} loading={loading} showCosts={showCosts} />
        ) : activeTab === 'products' ? (
          <SalesST_ByProduct productList={productList} loading={loading} showCosts={showCosts} />
        ) : (
          showCosts ? <SalesST_CustomerMarginTab subCustomersData={subCustomersData} loading={loading} /> : null
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

