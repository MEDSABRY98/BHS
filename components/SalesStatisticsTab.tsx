'use client';

import { useState, useMemo } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { MapPin, ShoppingBag, UserCircle, DollarSign, Package } from 'lucide-react';

interface SalesStatisticsTabProps {
  data: SalesInvoice[];
  loading: boolean;
}

export default function SalesStatisticsTab({ data, loading }: SalesStatisticsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'area' | 'merchandiser' | 'salesrep'>('area');
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Filter data based on filters
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Year filter
    if (filterYear.trim()) {
      const yearNum = parseInt(filterYear.trim(), 10);
      if (!isNaN(yearNum)) {
        filtered = filtered.filter(item => {
          if (!item.invoiceDate) return false;
          try {
            const date = new Date(item.invoiceDate);
            return !isNaN(date.getTime()) && date.getFullYear() === yearNum;
          } catch (e) {
            return false;
          }
        });
      }
    }

    // Month filter
    if (filterMonth.trim()) {
      const monthNum = parseInt(filterMonth.trim(), 10);
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        filtered = filtered.filter(item => {
          if (!item.invoiceDate) return false;
          try {
            const date = new Date(item.invoiceDate);
            return !isNaN(date.getTime()) && date.getMonth() + 1 === monthNum;
          } catch (e) {
            return false;
          }
        });
      }
    }

    // Date from filter
    if (dateFrom) {
      filtered = filtered.filter(item => {
        if (!item.invoiceDate) return false;
        try {
          const itemDate = new Date(item.invoiceDate);
          const fromDate = new Date(dateFrom);
          return !isNaN(itemDate.getTime()) && itemDate >= fromDate;
        } catch (e) {
          return false;
        }
      });
    }

    // Date to filter
    if (dateTo) {
      filtered = filtered.filter(item => {
        if (!item.invoiceDate) return false;
        try {
          const itemDate = new Date(item.invoiceDate);
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999); // Include the entire end date
          return !isNaN(itemDate.getTime()) && itemDate <= toDate;
        } catch (e) {
          return false;
        }
      });
    }

    return filtered;
  }, [data, filterYear, filterMonth, dateFrom, dateTo]);

  // Calculate statistics for Area
  const areaStats = useMemo(() => {
    const areaMap = new Map<string, { amount: number; qty: number; count: number }>();

    filteredData.forEach(item => {
      if (!item.area) return;
      const existing = areaMap.get(item.area) || { amount: 0, qty: 0, count: 0 };
      areaMap.set(item.area, {
        amount: existing.amount + (item.amount || 0),
        qty: existing.qty + (item.qty || 0),
        count: existing.count + 1
      });
    });

    // Calculate unique months for each area
    const areaMonthsMap = new Map<string, Set<string>>();
    filteredData.forEach(item => {
      if (!item.area || !item.invoiceDate) return;
      const date = new Date(item.invoiceDate);
      if (isNaN(date.getTime())) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!areaMonthsMap.has(item.area)) {
        areaMonthsMap.set(item.area, new Set());
      }
      areaMonthsMap.get(item.area)!.add(monthKey);
    });

    // Calculate monthly data for each area (needed for growth calculation)
    const monthlyData = new Map<string, Map<string, { amount: number; qty: number }>>();

    filteredData.forEach(item => {
      if (!item.area || !item.invoiceDate) return;
      const date = new Date(item.invoiceDate);
      if (isNaN(date.getTime())) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(item.area)) {
        monthlyData.set(item.area, new Map());
      }
      const areaMonths = monthlyData.get(item.area)!;

      if (!areaMonths.has(monthKey)) {
        areaMonths.set(monthKey, { amount: 0, qty: 0 });
      }
      const monthData = areaMonths.get(monthKey)!;
      monthData.amount += item.amount || 0;
      monthData.qty += item.qty || 0;
    });

    // Calculate total amount for percentage calculation
    const totalAmountAll = Array.from(areaMap.values()).reduce((sum, v) => sum + v.amount, 0);

    const stats = Array.from(areaMap.entries()).map(([area, values]) => {
      const monthsCount = areaMonthsMap.get(area)?.size || 1;
      const averageMonthly = values.amount / monthsCount;

      // Calculate monthly growth from monthlyData
      const areaMonthlyData = monthlyData.get(area);
      let averageMonthlyGrowth = 0;
      if (areaMonthlyData && areaMonthlyData.size > 1) {
        const sortedMonths = Array.from(areaMonthlyData.entries())
          .sort((a, b) => a[0].localeCompare(b[0]));
        const growths: number[] = [];
        for (let i = 1; i < sortedMonths.length; i++) {
          const prevAmount = sortedMonths[i - 1][1].amount;
          const currAmount = sortedMonths[i][1].amount;
          growths.push(currAmount - prevAmount);
        }
        if (growths.length > 0) {
          averageMonthlyGrowth = growths.reduce((sum, g) => sum + g, 0) / growths.length;
        }
      }

      return {
        name: area,
        totalAmount: values.amount,
        totalQty: values.qty,
        invoiceCount: values.count,
        averageMonthly: averageMonthly,
        averageMonthlyGrowth: averageMonthlyGrowth,
        percentageOfTotal: totalAmountAll > 0 ? (values.amount / totalAmountAll) * 100 : 0
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);

    return { stats, monthlyData };
  }, [filteredData]);

  // Calculate statistics for Merchandiser
  const merchandiserStats = useMemo(() => {
    const merchandiserMap = new Map<string, { amount: number; qty: number; count: number }>();

    filteredData.forEach(item => {
      if (!item.merchandiser) return;
      const existing = merchandiserMap.get(item.merchandiser) || { amount: 0, qty: 0, count: 0 };
      merchandiserMap.set(item.merchandiser, {
        amount: existing.amount + (item.amount || 0),
        qty: existing.qty + (item.qty || 0),
        count: existing.count + 1
      });
    });

    // Calculate unique months for each merchandiser
    const merchandiserMonthsMap = new Map<string, Set<string>>();
    filteredData.forEach(item => {
      if (!item.merchandiser || !item.invoiceDate) return;
      const date = new Date(item.invoiceDate);
      if (isNaN(date.getTime())) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!merchandiserMonthsMap.has(item.merchandiser)) {
        merchandiserMonthsMap.set(item.merchandiser, new Set());
      }
      merchandiserMonthsMap.get(item.merchandiser)!.add(monthKey);
    });

    // Calculate monthly data for each merchandiser (needed for growth calculation)
    const monthlyData = new Map<string, Map<string, { amount: number; qty: number }>>();

    filteredData.forEach(item => {
      if (!item.merchandiser || !item.invoiceDate) return;
      const date = new Date(item.invoiceDate);
      if (isNaN(date.getTime())) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(item.merchandiser)) {
        monthlyData.set(item.merchandiser, new Map());
      }
      const merchandiserMonths = monthlyData.get(item.merchandiser)!;

      if (!merchandiserMonths.has(monthKey)) {
        merchandiserMonths.set(monthKey, { amount: 0, qty: 0 });
      }
      const monthData = merchandiserMonths.get(monthKey)!;
      monthData.amount += item.amount || 0;
      monthData.qty += item.qty || 0;
    });

    // Calculate total amount for percentage calculation
    const totalAmountAll = Array.from(merchandiserMap.values()).reduce((sum, v) => sum + v.amount, 0);

    const stats = Array.from(merchandiserMap.entries()).map(([merchandiser, values]) => {
      const monthsCount = merchandiserMonthsMap.get(merchandiser)?.size || 1;
      const averageMonthly = values.amount / monthsCount;

      // Calculate monthly growth from monthlyData
      const merchandiserMonthlyData = monthlyData.get(merchandiser);
      let averageMonthlyGrowth = 0;
      if (merchandiserMonthlyData && merchandiserMonthlyData.size > 1) {
        const sortedMonths = Array.from(merchandiserMonthlyData.entries())
          .sort((a, b) => a[0].localeCompare(b[0]));
        const growths: number[] = [];
        for (let i = 1; i < sortedMonths.length; i++) {
          const prevAmount = sortedMonths[i - 1][1].amount;
          const currAmount = sortedMonths[i][1].amount;
          growths.push(currAmount - prevAmount);
        }
        if (growths.length > 0) {
          averageMonthlyGrowth = growths.reduce((sum, g) => sum + g, 0) / growths.length;
        }
      }

      return {
        name: merchandiser,
        totalAmount: values.amount,
        totalQty: values.qty,
        invoiceCount: values.count,
        averageMonthly: averageMonthly,
        averageMonthlyGrowth: averageMonthlyGrowth,
        percentageOfTotal: totalAmountAll > 0 ? (values.amount / totalAmountAll) * 100 : 0
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);

    return { stats, monthlyData };
  }, [filteredData]);

  // Calculate statistics for Sales Rep
  const salesRepStats = useMemo(() => {
    const salesRepMap = new Map<string, { amount: number; qty: number; count: number }>();

    filteredData.forEach(item => {
      if (!item.salesRep) return;
      const existing = salesRepMap.get(item.salesRep) || { amount: 0, qty: 0, count: 0 };
      salesRepMap.set(item.salesRep, {
        amount: existing.amount + (item.amount || 0),
        qty: existing.qty + (item.qty || 0),
        count: existing.count + 1
      });
    });

    // Calculate unique months for each sales rep
    const salesRepMonthsMap = new Map<string, Set<string>>();
    filteredData.forEach(item => {
      if (!item.salesRep || !item.invoiceDate) return;
      const date = new Date(item.invoiceDate);
      if (isNaN(date.getTime())) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!salesRepMonthsMap.has(item.salesRep)) {
        salesRepMonthsMap.set(item.salesRep, new Set());
      }
      salesRepMonthsMap.get(item.salesRep)!.add(monthKey);
    });

    // Calculate monthly data for each sales rep (needed for growth calculation)
    const monthlyData = new Map<string, Map<string, { amount: number; qty: number }>>();

    filteredData.forEach(item => {
      if (!item.salesRep || !item.invoiceDate) return;
      const date = new Date(item.invoiceDate);
      if (isNaN(date.getTime())) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(item.salesRep)) {
        monthlyData.set(item.salesRep, new Map());
      }
      const salesRepMonths = monthlyData.get(item.salesRep)!;

      if (!salesRepMonths.has(monthKey)) {
        salesRepMonths.set(monthKey, { amount: 0, qty: 0 });
      }
      const monthData = salesRepMonths.get(monthKey)!;
      monthData.amount += item.amount || 0;
      monthData.qty += item.qty || 0;
    });

    // Calculate total amount for percentage calculation
    const totalAmountAll = Array.from(salesRepMap.values()).reduce((sum, v) => sum + v.amount, 0);

    const stats = Array.from(salesRepMap.entries()).map(([salesRep, values]) => {
      const monthsCount = salesRepMonthsMap.get(salesRep)?.size || 1;
      const averageMonthly = values.amount / monthsCount;

      // Calculate monthly growth from monthlyData
      const salesRepMonthlyData = monthlyData.get(salesRep);
      let averageMonthlyGrowth = 0;
      if (salesRepMonthlyData && salesRepMonthlyData.size > 1) {
        const sortedMonths = Array.from(salesRepMonthlyData.entries())
          .sort((a, b) => a[0].localeCompare(b[0]));
        const growths: number[] = [];
        for (let i = 1; i < sortedMonths.length; i++) {
          const prevAmount = sortedMonths[i - 1][1].amount;
          const currAmount = sortedMonths[i][1].amount;
          growths.push(currAmount - prevAmount);
        }
        if (growths.length > 0) {
          averageMonthlyGrowth = growths.reduce((sum, g) => sum + g, 0) / growths.length;
        }
      }

      return {
        name: salesRep,
        totalAmount: values.amount,
        totalQty: values.qty,
        invoiceCount: values.count,
        averageMonthly: averageMonthly,
        averageMonthlyGrowth: averageMonthlyGrowth,
        percentageOfTotal: totalAmountAll > 0 ? (values.amount / totalAmountAll) * 100 : 0
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);

    return { stats, monthlyData };
  }, [filteredData]);

  const getCurrentStats = () => {
    switch (activeSubTab) {
      case 'area':
        return areaStats;
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

    const months = Array.from(monthlyData.entries())
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
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading statistics...</p>
        </div>
      </div>
    );
  }

  const totals = getTotalStats();
  const current = getCurrentStats();

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Statistics</h1>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Year</label>
              <input
                type="number"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                placeholder="e.g., 2024"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
                min="2000"
                max="2100"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Month (1-12)</label>
              <input
                type="number"
                value={filterMonth}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12)) {
                    setFilterMonth(value);
                  }
                }}
                placeholder="e.g., 1-12"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
                min="1"
                max="12"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
              />
            </div>
          </div>
          {(filterYear || filterMonth || dateFrom || dateTo) && (
            <div className="mt-4">
              <button
                onClick={() => {
                  setFilterYear('');
                  setFilterMonth('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Clear All Filters
              </button>
            </div>
          )}
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
              onClick={() => setActiveSubTab('merchandiser')}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${activeSubTab === 'merchandiser'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              <ShoppingBag className="w-5 h-5" />
              Merchandiser
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
    </div>
  );
}

