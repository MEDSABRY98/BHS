'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { SalesInvoice } from '@/lib/supabase';
import { ArrowLeft, Search } from 'lucide-react';
import { useSalesModuleFilters } from '@/app/Sales/Model/SalesFilters';
import SalesTabLoader from '@/app/Sales/Shared/TabLoader';
import { getProductDetailsData } from '../Service/sales_products_service';
import { trackSalesProductDetailsTab } from '@/app/Audit/Model/SalesTabAudit';

// Import sub-tabs
import DashboardTab from './DashboardTab';
import MonthlySalesTab from './MonthlySalesTab';
import CustomersTab from './CustomersTab';
import CitiesTab from './CitiesTab';

interface SalesProductDetailsProps {
  productId: string;
  userId?: string;
  onBack: () => void;
  initialTab?: 'dashboard' | 'monthly' | 'products' | 'cities';
  filterYear?: string;
}

export default function SalesProductDetails({ productId, userId, onBack, initialTab = 'dashboard', filterYear }: SalesProductDetailsProps) {
  const { commonFilters: filters } = useSalesModuleFilters();
  const [data, setData] = useState<SalesInvoice[]>([]);
  const [allData, setAllData] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'monthly' | 'products' | 'cities'>(initialTab);

  useEffect(() => {
    trackSalesProductDetailsTab(activeTab);
  }, [activeTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const fetchRequestId = useRef(0);

  // Fetch product details when panel opens
  useEffect(() => {
    const requestId = ++fetchRequestId.current;

    const fetchProductDetails = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await getProductDetailsData(userId, filters, productId);
        if (requestId !== fetchRequestId.current) return;
        setData(result.data || []);
        setAllData(result.allData || []);
      } catch (err) {
        if (requestId !== fetchRequestId.current) return;
        console.error('Error fetching Product Details:', err);
      } finally {
        if (requestId === fetchRequestId.current) {
          setLoading(false);
        }
      }
    };

    fetchProductDetails();
    return () => {
      fetchRequestId.current += 1;
    };
  }, [userId, filters, productId]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter data for this product with search and date filters
  const productData = useMemo(() => {
    let filtered = data.filter(item => (item.productId || item.barcode || item.product) === productId);

    // Search filter
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.product?.toLowerCase().includes(query) ||
        item.customerName?.toLowerCase().includes(query) ||
        item.merchandiser?.toLowerCase().includes(query) ||
        item.salesRep?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [data, productId, debouncedSearchQuery]);

  // Get latest product metadata (name, barcode)
  const productInfo = useMemo(() => {
    if (productData.length === 0) return { name: productId, barcode: '-' };

    // Sort by date to get the latest
    const latest = [...productData].sort((a, b) => {
      const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
      const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
      return dateB - dateA;
    })[0];

    return {
      name: latest.product || productId,
      barcode: latest.barcode || '-'
    };
  }, [productData, productId]);

  const productName = productInfo.name;
  const currentBarcode = productInfo.barcode;

  // Monthly sales data
  const monthlySales = useMemo(() => {
    const monthMap = new Map<string, { month: string; monthKey: string; amount: number; qty: number; invoiceNumbers: Set<string> }>();

    productData.forEach(item => {
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
  }, [productData]);

  if (loading) {
    return <SalesTabLoader />;
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title="Back to Products"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{productName}</h1>
          <p className="text-sm text-gray-600 mt-1">Barcode: {currentBarcode} | ID: {productId}</p>
        </div>
      </div>

      {/* Search Filter */}
      <div className="mb-6">
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by customer, product, merchandiser, sales rep..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
          />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mb-6 flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${activeTab === 'dashboard'
            ? 'text-green-600 border-green-600'
            : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${activeTab === 'monthly'
            ? 'text-green-600 border-green-600'
            : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
        >
          Sales by Month
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${activeTab === 'products'
            ? 'text-green-600 border-green-600'
            : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
        >
          Customers
        </button>
        <button
          onClick={() => setActiveTab('cities')}
          className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${activeTab === 'cities'
            ? 'text-green-600 border-green-600'
            : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
        >
          Cities
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <DashboardTab
          productData={productData}
          monthlySales={monthlySales}
          allData={allData}
          productId={productId}
          filterYear={filterYear}
        />
      )}

      {activeTab === 'monthly' && (
        <MonthlySalesTab monthlySales={monthlySales} />
      )}

      {activeTab === 'products' && (
        <CustomersTab productData={productData} productId={productId} />
      )}

      {activeTab === 'cities' && (
        <CitiesTab productData={productData} productId={productId} />
      )}
    </div>
  );
}
