'use client';

import { useState, useMemo, useEffect, memo, useRef } from 'react';
import { SalesInvoice } from '@/lib/Sheets/GoogleSheets';
import { Search, Users, ChevronLeft, ChevronRight, Download, ArrowUpDown, ArrowUp, ArrowDown, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import SalesCustomerDetails from './SalesCustomerDetails';
import NoData from '@/app/Components/NoDataTab';
import Loading from '@/app/Components/Loading';

interface SalesInactiveCustomersTabProps {
  refreshTrigger?: number;
  filters: any;
  userId: string;
  days?: string;
  minAmount?: string;
}

const ITEMS_PER_PAGE = 50;

// Memoized row component
const InactiveCustomerRow = memo(({ item, rowNumber, onCustomerClick, onExclude, isExcluding }: {
  item: {
    customerId: string;
    customer: string;
    lastPurchaseDate: Date | null;
    daysSinceLastPurchase: number;
    totalAmount: number;
    averageOrderValue: number;
    orderCount: number;
    status: string;
  };
  rowNumber: number;
  onCustomerClick: (customer: string) => void;
  onExclude: (customerId: string, customerName: string) => void;
  isExcluding?: boolean;
}) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 group text-center">
      <td className="py-3 px-4 text-sm text-gray-600 font-medium">{rowNumber}</td>
      <td
        className="py-3 px-4 text-sm text-gray-800 font-medium cursor-pointer hover:text-green-600 hover:underline w-56 truncate"
        onClick={() => onCustomerClick(item.customer)}
        title={item.customer}
      >
        {item.customer}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
        {item.lastPurchaseDate ? new Date(item.lastPurchaseDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }) : '-'}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
        {item.daysSinceLastPurchase}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
        {item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
        {item.averageOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">{item.orderCount}</td>
      <td className="py-3 px-4 text-sm">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExclude(item.customerId, item.customer);
          }}
          disabled={isExcluding}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-30"
          title="Exclude from list"
        >
          {isExcluding ? <span className="text-[10px] text-red-600 font-bold">...</span> : <X className="w-4 h-4" />}
        </button>
      </td>
    </tr>
  );
});

InactiveCustomerRow.displayName = 'InactiveCustomerRow';

export default function SalesInactiveCustomersTab({ filters, userId, days = '30', minAmount = '0', refreshTrigger }: SalesInactiveCustomersTabProps) {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [excludedCustomerIds, setExcludedCustomerIds] = useState<Set<string>>(new Set());
  const [excludedCustomersData, setExcludedCustomersData] = useState<Array<{ customerId: string, customerName: string }>>([]);
  const [sortField, setSortField] = useState<'customer' | 'lastPurchaseDate' | 'daysSinceLastPurchase' | 'totalAmount' | 'averageOrderValue' | 'orderCount'>('daysSinceLastPurchase');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [excludingId, setExcludingId] = useState<string | null>(null);
  const [showExcludedModal, setShowExcludedModal] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [customerToExclude, setCustomerToExclude] = useState<{ id: string, name: string } | null>(null);

  const [serverInactiveCustomersData, setServerInactiveCustomersData] = useState<any[]>([]);

  // Fetch excluded customers
  useEffect(() => {
    const fetchExceptions = async () => {
      try {
        const response = await fetch('/api/InactiveCustomer');
        if (response.ok) {
          const result = await response.json();
          const excludedIds = new Set<string>();
          result.data.forEach((item: { customerId: string, customerName: string }) => {
            if (item.customerId) excludedIds.add(item.customerId.trim());
          });
          setExcludedCustomerIds(excludedIds);
          setExcludedCustomersData(result.data);
        }
      } catch (error) {
        console.error('Error fetching inactive customer exceptions:', error);
      }
    };
    fetchExceptions();
  }, [refreshTrigger]);

  // Fetch inactive customers from server
  useEffect(() => {
    const fetchInactiveCustomers = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/Sales/InactiveCustomers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters, userId, days, minAmount, refreshTrigger })
        });
        if (!response.ok) throw new Error('Failed to fetch inactive customers');
        const result = await response.json();
        setServerInactiveCustomersData(result.inactiveCustomersData || []);
      } catch (error) {
        console.error('Error fetching inactive customers:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInactiveCustomers();
  }, [filters, userId, days, minAmount, refreshTrigger]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Main data processing - filter excluded on client side
  const inactiveCustomersData = useMemo(() => {
    return serverInactiveCustomersData.filter(item => !excludedCustomerIds.has(item.customerId));
  }, [serverInactiveCustomersData, excludedCustomerIds]);

  // Search & Sort
  const filteredCustomers = useMemo(() => {
    let filtered = [...inactiveCustomersData];

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => item.customer.toLowerCase().includes(query));
    }

    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'lastPurchaseDate') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [inactiveCustomersData, debouncedSearchQuery, sortField, sortDirection]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('desc'); }
  };

  const getSortIcon = (field: typeof sortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 inline ml-1 opacity-20" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4 inline ml-1 text-green-600" /> : <ArrowDown className="w-4 h-4 inline ml-1 text-green-600" />;
  };

  const handleExcludeCustomer = async (customerId: string, customerName: string) => {
    setCustomerToExclude({ id: customerId, name: customerName });
  };

  const confirmExcludeCustomer = async () => {
    if (!customerToExclude) return;
    const { id: customerId, name: customerName } = customerToExclude;
    setCustomerToExclude(null);
    setExcludingId(customerId);

    try {
      const resp = await fetch('/api/InactiveCustomer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, customerName }),
      });
      if (resp.ok) {
        setExcludedCustomerIds(prev => new Set(prev).add(customerId));
        setExcludedCustomersData(prev => [...prev, { customerId, customerName }]);
      }
    } catch (e) { console.error(e); } finally { setExcludingId(null); }
  };

  const handleRestoreCustomer = async (customerId: string) => {
    setRestoringId(customerId);
    try {
      const resp = await fetch(`/api/InactiveCustomer?customerId=${encodeURIComponent(customerId)}`, { method: 'DELETE' });
      if (resp.ok) {
        setExcludedCustomerIds(prev => { const n = new Set(prev); n.delete(customerId); return n; });
        setExcludedCustomersData(prev => prev.filter(c => c.customerId !== customerId));
      }
    } catch (e) { console.error(e); } finally { setRestoringId(null); }
  };

  const totals = useMemo(() => {
    if (filteredCustomers.length === 0) return { totalAmount: 0, avgAOV: 0, totalOrders: 0 };
    const res = filteredCustomers.reduce((acc, item) => {
      acc.totalAmount += item.totalAmount;
      acc.totalAOV += item.averageOrderValue;
      acc.totalOrders += item.orderCount;
      return acc;
    }, { totalAmount: 0, totalAOV: 0, totalOrders: 0 });
    return { ...res, avgAOV: res.totalAOV / filteredCustomers.length };
  }, [filteredCustomers]);

  const exportToExcel = () => {
    const headers = ['#', 'Customer Name', 'Status', 'Last Purchase', 'Days Inactive', 'Amount', 'Amount Average', 'Orders'];
    const rows = filteredCustomers.map((item, i) => [
      i + 1, item.customer, item.status,
      item.lastPurchaseDate?.toLocaleDateString() || '-',
      item.daysSinceLastPurchase, item.totalAmount.toFixed(2),
      item.averageOrderValue.toFixed(2), item.orderCount
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Inactive Customers');
    XLSX.writeFile(wb, `inactive_customers_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return <Loading fullScreen={false} />;
  } if (selectedCustomer) return (
    <SalesCustomerDetails customerName={selectedCustomer} filters={filters} userId={userId} onBack={() => setSelectedCustomer(null)} initialTab="dashboard" />
  );

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = filteredCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-medium text-slate-800">Sales Inactive Customers</h1>
          <button
            onClick={() => setShowExcludedModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 text-xs font-bold border border-orange-100 hover:bg-orange-100 transition-all shadow-sm"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Hidden ({excludedCustomerIds.size})</span>
          </button>
        </div>

        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
            <input
              type="text"
              placeholder="Search by customer name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:border-green-500 outline-none transition-all shadow-sm text-sm font-medium"
            />
          </div>
          <button
            onClick={exportToExcel}
            className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-16">#</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 w-56" onClick={() => handleSort('customer')}>
                  Customer {getSortIcon('customer')}
                </th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 w-40" onClick={() => handleSort('lastPurchaseDate')}>
                  Last Purchase {getSortIcon('lastPurchaseDate')}
                </th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 w-32" onClick={() => handleSort('daysSinceLastPurchase')}>
                  Days Inactive {getSortIcon('daysSinceLastPurchase')}
                </th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 w-32" onClick={() => handleSort('totalAmount')}>
                  Amount {getSortIcon('totalAmount')}
                </th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 w-40" onClick={() => handleSort('averageOrderValue')}>
                  Amount Average {getSortIcon('averageOrderValue')}
                </th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 w-24" onClick={() => handleSort('orderCount')}>
                  Orders {getSortIcon('orderCount')}
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map((item, idx) => (
                <InactiveCustomerRow
                  key={item.customerId}
                  item={item}
                  rowNumber={startIndex + idx + 1}
                  onCustomerClick={setSelectedCustomer}
                  onExclude={handleExcludeCustomer}
                  isExcluding={excludingId === item.customerId}
                />
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12">
                    <NoData />
                  </td>
                </tr>
              )}
            </tbody>
            {filteredCustomers.length > 0 && (
              <tfoot className="bg-gray-50/50 font-bold border-t border-gray-100">
                <tr className="text-center">
                  <td colSpan={4} className="py-4 px-4 text-sm text-gray-500 uppercase tracking-widest">Totals</td>
                  <td className="py-4 px-4 text-sm text-gray-800">{totals.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="py-4 px-4 text-sm text-gray-800">{totals.avgAOV.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="py-4 px-4 text-sm text-gray-800">{totals.totalOrders.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {filteredCustomers.length > ITEMS_PER_PAGE && (
          <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500 font-medium">Found {filteredCustomers.length} results</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"><ChevronLeft className="w-5 h-5" /></button>
              <div className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 shadow-sm">Page {currentPage} / {totalPages}</div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {customerToExclude && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCustomerToExclude(null)} />
          <div className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">Hide Customer?</h3>
            <p className="text-gray-500 text-center mb-6 leading-relaxed">
              Are you sure you want to hide <span className="font-bold text-gray-900">"{customerToExclude.name}"</span>?
              They will no longer appear in the inactive list.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCustomerToExclude(null)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all">Cancel</button>
              <button onClick={confirmExcludeCustomer} className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200">Yes, Hide</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Modal */}
      {showExcludedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowExcludedModal(false)} />
          <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-white/20 animate-in fade-in zoom-in duration-300 overflow-hidden">
            <div className="px-8 py-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-gray-800">Hidden Inactive Customers</h2>
              <button onClick={() => setShowExcludedModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {excludedCustomersData.length === 0 ? (
                <div className="py-20 text-center text-gray-500 font-bold italic">No customers are currently hidden</div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {excludedCustomersData.map(c => (
                    <div key={c.customerId} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                      <span className="font-bold text-slate-700">{c.customerName}</span>
                      <button
                        onClick={() => handleRestoreCustomer(c.customerId)}
                        disabled={restoringId === c.customerId}
                        className="px-4 py-2 bg-green-50 text-green-600 text-xs font-bold rounded-lg hover:bg-green-600 hover:text-white transition-all disabled:opacity-30"
                      >
                        {restoringId === c.customerId ? 'Restoring...' : 'Restore'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

