'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { SalesInvoice } from '@/lib/supabase';
import { ArrowLeft, Search } from 'lucide-react';
import { useSalesModuleFilters } from '@/app/Sales/Model/SalesFilters';
import SalesTabLoader from '@/app/Sales/Shared/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { getCategoryDetailsData } from '../Service/sales_products_service';
import { trackSalesCategoryDetailsTab } from '@/app/Audit/Model/SalesTabAudit';

import DashboardTab from '../ProductDetails/DashboardTab';
import MonthlySalesTab from '../ProductDetails/MonthlySalesTab';
import CustomersTab from '../ProductDetails/CustomersTab';
import CitiesTab from '../ProductDetails/CitiesTab';
import SalespersonsTab from '../ProductDetails/SalespersonsTab';
import CategoryProductsTab from './CategoryProductsTab';

type CategoryTabId = 'dashboard' | 'monthly' | 'products' | 'customers' | 'cities' | 'salespersons';

interface SalesCategoryDetailsProps {
  category: string;
  userId?: string;
  onBack: () => void;
  initialTab?: CategoryTabId;
  filterYear?: string;
}

const TABS: { id: CategoryTabId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'monthly', label: 'Sales by Month' },
  { id: 'products', label: 'Products' },
  { id: 'customers', label: 'Customers' },
  { id: 'cities', label: 'Cities' },
  { id: 'salespersons', label: 'Salespersons' },
];

export default function SalesCategoryDetails({ category, userId, onBack, initialTab = 'dashboard', filterYear }: SalesCategoryDetailsProps) {
  const { commonFilters: filters } = useSalesModuleFilters();
  const [data, setData] = useState<SalesInvoice[]>([]);
  const [allData, setAllData] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CategoryTabId>(initialTab);

  useEffect(() => {
    trackSalesCategoryDetailsTab(activeTab);
  }, [activeTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const fetchRequestId = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const requestId = ++fetchRequestId.current;

    const fetchCategoryDetails = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        const result = await getCategoryDetailsData(userId, filters, category);
        if (requestId !== fetchRequestId.current) return;
        setData(result.data || []);
        setAllData(result.allData || []);
      } catch (err) {
        if (requestId !== fetchRequestId.current) return;
        console.error('Error fetching Category Details:', err);
        setLoadError(err instanceof Error ? err.message : 'Could not load category details');
      } finally {
        if (requestId === fetchRequestId.current) {
          setLoading(false);
        }
      }
    };

    fetchCategoryDetails();
    return () => {
      fetchRequestId.current += 1;
    };
  }, [userId, filters, category, reloadKey]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const matchCategory = useCallback(
    (item: SalesInvoice) => ((item as any).productTag || 'Uncategorized') === category,
    [category]
  );

  // Rows of this category (server already limited to it) + search
  const categoryData = useMemo(() => {
    let filtered = data.filter(matchCategory);

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.product?.toLowerCase().includes(query) ||
        item.barcode?.toLowerCase().includes(query) ||
        item.customerName?.toLowerCase().includes(query) ||
        item.merchandiser?.toLowerCase().includes(query) ||
        item.salesRep?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [data, matchCategory, debouncedSearchQuery]);

  // Monthly sales data
  const monthlySales = useMemo(() => {
    const monthMap = new Map<string, { month: string; monthKey: string; amount: number; qty: number; invoiceNumbers: Set<string> }>();

    categoryData.forEach(item => {
      if (!item.invoiceDate) return;

      try {
        const date = new Date(item.invoiceDate);
        if (isNaN(date.getTime())) return;

        const year = date.getFullYear();
        const month = date.getMonth();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabel = `${monthNames[month]} ${String(year).slice(-2)}`;

        const existing = monthMap.get(monthKey) || {
          month: monthLabel,
          monthKey,
          amount: 0,
          qty: 0,
          invoiceNumbers: new Set<string>()
        };

        existing.amount += item.amount;
        existing.qty += item.qty;

        // Add invoice number for transaction count (only invoices starting with "SAL")
        if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
          existing.invoiceNumbers.add(item.invoiceNumber);
        }

        monthMap.set(monthKey, existing);
      } catch (e) {
        // Skip invalid dates
      }
    });

    // Sort by date descending (newest first)
    const sorted = Array.from(monthMap.values()).map(item => ({
      month: item.month,
      monthKey: item.monthKey,
      amount: item.amount,
      qty: item.qty,
      count: item.invoiceNumbers.size
    })).sort((a, b) => {
      return b.monthKey.localeCompare(a.monthKey);
    });

    // Fill in missing months from first sale month to current month
    if (sorted.length > 0) {
      // Find first month (oldest) and last month (newest)
      const firstMonthKey = sorted[sorted.length - 1].monthKey; // Oldest (last in descending order)
      const lastMonthKey = sorted[0].monthKey; // Newest (first in descending order)

      // Parse first month
      const [firstYear, firstMonth] = firstMonthKey.split('-').map(Number);

      // Get current date
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // 1-based
      const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      // Use current month or last sale month, whichever is newer
      const endMonthKey = currentMonthKey > lastMonthKey ? currentMonthKey : lastMonthKey;
      const [endYear, endMonth] = endMonthKey.split('-').map(Number);

      // Create a map for quick lookup
      const monthDataMap = new Map(sorted.map(item => [item.monthKey, item]));

      // Generate all months from first to end
      const allMonths: Array<{
        month: string;
        monthKey: string;
        amount: number;
        qty: number;
        count: number;
        isZeroMonth: boolean;
      }> = [];

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      let year = firstYear;
      let month = firstMonth;

      while (year < endYear || (year === endYear && month <= endMonth)) {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const monthLabel = `${monthNames[month - 1]} ${String(year).slice(-2)}`;

        const existingData = monthDataMap.get(monthKey);

        if (existingData) {
          allMonths.push({
            ...existingData,
            isZeroMonth: false
          });
        } else {
          // Zero month - no sales
          allMonths.push({
            month: monthLabel,
            monthKey,
            amount: 0,
            qty: 0,
            count: 0,
            isZeroMonth: true
          });
        }

        // Move to next month
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }

      // Sort by date descending (newest first)
      allMonths.sort((a, b) => b.monthKey.localeCompare(a.monthKey));

      // Calculate amount change from previous month
      return allMonths.map((item, index) => {
        const previousAmount = index < allMonths.length - 1 ? allMonths[index + 1].amount : null;
        const amountChange = previousAmount !== null ? item.amount - previousAmount : null;

        return {
          ...item,
          amountChange
        };
      });
    }

    return [];
  }, [categoryData]);

  if (loading) {
    return <SalesTabLoader />;
  }

  if (loadError) {
    return <TabFetchError message={loadError} onRetry={() => setReloadKey((k) => k + 1)} className="min-h-[60vh]" />;
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title="Back to Categories"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{category}</h1>
          <p className="text-sm text-gray-600 mt-1">Category Details</p>
        </div>
      </div>

      {/* Search Filter */}
      <div className="mb-6">
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by product, barcode, customer, merchandiser, sales rep..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
          />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mb-6 flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${activeTab === tab.id
              ? 'text-green-600 border-green-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <DashboardTab
          productData={categoryData}
          monthlySales={monthlySales}
          allData={allData}
          productId={category}
          filterYear={filterYear}
          matchItem={matchCategory}
        />
      )}

      {activeTab === 'monthly' && <MonthlySalesTab monthlySales={monthlySales} />}

      {activeTab === 'products' && <CategoryProductsTab categoryData={categoryData} category={category} />}

      {activeTab === 'customers' && <CustomersTab productData={categoryData} productId={category} />}

      {activeTab === 'cities' && <CitiesTab productData={categoryData} productId={category} />}

      {activeTab === 'salespersons' && <SalespersonsTab productData={categoryData} productId={category} />}
    </div>
  );
}
