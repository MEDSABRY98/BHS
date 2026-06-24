'use client';

import { useState, useMemo, useEffect } from 'react';
import { SalesInvoice } from '@/lib/supabase';;
import { MapPin, ShoppingBag, UserCircle, DollarSign, Package, Store } from 'lucide-react';
import Loading from '@/app/Components/Loading';

interface SalesStatisticsTabProps {
  refreshTrigger?: number;
  filters: any;
  userId: string;
}

export default function SalesStatisticsTab({ filters, userId, refreshTrigger }: SalesStatisticsTabProps) {
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'area' | 'market' | 'merchandiser' | 'salesrep'>('area');

  const [areaStats, setAreaStats] = useState<{ stats: any[], monthlyData: any }>({ stats: [], monthlyData: {} });
  const [marketStats, setMarketStats] = useState<{ stats: any[], monthlyData: any }>({ stats: [], monthlyData: {} });
  const [merchandiserStats, setMerchandiserStats] = useState<{ stats: any[], monthlyData: any }>({ stats: [], monthlyData: {} });
  const [salesRepStats, setSalesRepStats] = useState<{ stats: any[], monthlyData: any }>({ stats: [], monthlyData: {} });

  // Fetch data
  useEffect(() => {
    const fetchStatistics = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch('/api/Sales/Statistics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters, userId })
        });
        if (!response.ok) throw new Error('Failed to fetch statistics data');
        const result = await response.json();

        // Helper to convert plain object back to Map for monthlyData
        const convertMonthlyDataToMap = (monthlyDataObj: any) => {
          if (!monthlyDataObj) return new Map();
          const map = new Map();
          for (const [dim, monthsMapObj] of Object.entries(monthlyDataObj)) {
            map.set(dim, new Map(Object.entries(monthsMapObj as object)));
          }
          return map;
        };

        setAreaStats({
          stats: result.areaStats?.stats || [],
          monthlyData: convertMonthlyDataToMap(result.areaStats?.monthlyData)
        });
        setMarketStats({
          stats: result.marketStats?.stats || [],
          monthlyData: convertMonthlyDataToMap(result.marketStats?.monthlyData)
        });
        setMerchandiserStats({
          stats: result.merchandiserStats?.stats || [],
          monthlyData: convertMonthlyDataToMap(result.merchandiserStats?.monthlyData)
        });
        setSalesRepStats({
          stats: result.salesRepStats?.stats || [],
          monthlyData: convertMonthlyDataToMap(result.salesRepStats?.monthlyData)
        });

      } catch (err) {
        console.error('Error fetching Statistics Data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatistics();
  }, [filters, userId, refreshTrigger]);

  const getCurrentStats = () => {
    switch (activeSubTab) {
      case 'area':
        return areaStats;
      case 'market':
        return marketStats;
      case 'merchandiser':
        return merchandiserStats;
      case 'salesrep':
        return salesRepStats;
    }
  };

  const getTotalStats = () => {
    const current = getCurrentStats();
    const totalAmount = current.stats.reduce((sum, item) => sum + item.totalAmount, 0);
    const totalQty = current.stats.reduce((sum, item) => sum + item.totalQty, 0);
    const totalInvoices = current.stats.reduce((sum, item) => sum + item.invoiceCount, 0);
    const averageMonthly = current.stats.reduce((sum, item) => sum + (item.averageMonthly || 0), 0) / current.stats.length || 0;
    return { totalAmount, totalQty, totalInvoices, averageMonthly, count: current.stats.length };
  };

  const renderMonthlyTable = (name: string) => {
    const current = getCurrentStats();
    const monthlyData = current.monthlyData.get(name);
    if (!monthlyData) return null;

    const months = Array.from(monthlyData.entries() as Iterable<[string, any]>)
      .map(([monthKey, values]) => {
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          monthKey,
          monthName: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          ...values
        };
      })
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    return (
      <div className="overflow-x-auto mt-4">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.monthKey} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="text-center py-3 px-4 text-sm font-medium text-gray-800">{month.monthName}</td>
                <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                  {month.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
                <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                  {month.qty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return <Loading fullScreen={false} />;
  }

  const totals = getTotalStats();
  const current = getCurrentStats();

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-slate-800">Sales Statistics</h1>
      </div>


      {/* Sub-tabs */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex gap-3">
          <button
            onClick={() => setActiveSubTab('area')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${activeSubTab === 'area'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <MapPin className="w-5 h-5" />
            Area
          </button>
          <button
            onClick={() => setActiveSubTab('market')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${activeSubTab === 'market'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <Store className="w-5 h-5" />
            Market
          </button>
          <button
            onClick={() => setActiveSubTab('salesrep')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${activeSubTab === 'salesrep'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <UserCircle className="w-5 h-5" />
            Sales Rep
          </button>
          <button
            onClick={() => setActiveSubTab('merchandiser')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${activeSubTab === 'merchandiser'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <ShoppingBag className="w-5 h-5" />
            Merchandiser
          </button>
        </div>
      </div>

      {/* Total Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total {activeSubTab === 'area' ? 'Areas' : activeSubTab === 'merchandiser' ? 'Merchandisers' : 'Sales Reps'}</p>
              <p className="text-2xl font-bold text-gray-800">{totals.count}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              {activeSubTab === 'area' ? (
                <MapPin className="w-6 h-6 text-blue-600" />
              ) : activeSubTab === 'merchandiser' ? (
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              ) : (
                <UserCircle className="w-6 h-6 text-blue-600" />
              )}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-gray-800">
                {totals.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Average Monthly Sales</p>
              <p className="text-2xl font-bold text-gray-800">
                {totals.averageMonthly.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Quantity</p>
              <p className="text-2xl font-bold text-gray-800">
                {totals.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Table */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          {activeSubTab === 'area' ? 'Area' : activeSubTab === 'merchandiser' ? 'Merchandiser' : 'Sales Rep'} Statistics
        </h2>
        {current.stats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No data available for the selected date range</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 min-w-[200px]">
                    {activeSubTab === 'area' ? 'Area' : activeSubTab === 'merchandiser' ? 'Merchandiser' : 'Sales Rep'}
                  </th>
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Total Amount</th>
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Average Monthly Sales</th>
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Average Monthly Growth</th>
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">% of Total Sales</th>
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Total Quantity</th>
                </tr>
              </thead>
              <tbody>
                {current.stats.map((stat, index) => (
                  <tr key={stat.name} className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="text-center py-3 px-4 text-base font-semibold text-gray-800 min-w-[200px]">{stat.name}</td>
                    <td className="text-center py-3 px-4 text-base font-semibold text-gray-800">
                      {stat.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="text-center py-3 px-4 text-base font-semibold text-gray-800">
                      {stat.averageMonthly.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="text-center py-3 px-4 text-base font-semibold text-gray-800">
                      {stat.averageMonthlyGrowth !== 0 ? (
                        <span className={stat.averageMonthlyGrowth > 0 ? 'text-green-600' : 'text-red-600'}>
                          {stat.averageMonthlyGrowth > 0 ? '+' : ''}
                          {stat.averageMonthlyGrowth.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="text-center py-3 px-4 text-base font-semibold text-gray-800">
                      {stat.percentageOfTotal.toFixed(2)}%
                    </td>
                    <td className="text-center py-3 px-4 text-base font-semibold text-gray-800">
                      {stat.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


