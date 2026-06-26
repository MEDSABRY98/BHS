'use client';

import { useState, useMemo, useEffect } from 'react';
import { Package, Users, ArrowUp, ArrowDown, FileSpreadsheet, LayoutGrid, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';
import SalesTabLoader from './SalesTabLoader';

interface SalesTop10TabProps {
  refreshTrigger?: number;
  filters: any;
  userId: string;
}

type SortDirection = 'asc' | 'desc';
type Top10SubTab = 'main' | 'sub' | 'products';

interface Top10Row {
  customer?: string;
  barcode?: string;
  products?: string[];
  totalAmount: number;
  totalQty: number;
  transactions: number;
}

function sortAndLimitRows(
  rows: Top10Row[],
  sortBy: 'amount' | 'qty',
  direction: SortDirection,
  limit: number
) {
  const sorted = [...rows];

  if (sortBy === 'amount') {
    sorted.sort((a, b) =>
      direction === 'asc' ? a.totalAmount - b.totalAmount : b.totalAmount - a.totalAmount
    );
  } else {
    sorted.sort((a, b) =>
      direction === 'asc' ? a.totalQty - b.totalQty : b.totalQty - a.totalQty
    );
  }

  return sorted.slice(0, limit);
}

function calculateTotals(rows: Top10Row[]) {
  if (rows.length === 0) {
    return { totalAmount: 0, totalQty: 0, totalTransactions: 0 };
  }

  return {
    totalAmount: rows.reduce((sum, item) => sum + item.totalAmount, 0),
    totalQty: rows.reduce((sum, item) => sum + item.totalQty, 0),
    totalTransactions: rows.reduce((sum, item) => sum + item.transactions, 0),
  };
}

export default function SalesTop10Tab({ filters, userId, refreshTrigger }: SalesTop10TabProps) {
  const [loading, setLoading] = useState(true);
  const [topCount, setTopCount] = useState<number>(10);
  const [activeSubTab, setActiveSubTab] = useState<Top10SubTab>('main');

  const [productSortBy, setProductSortBy] = useState<'amount' | 'qty'>('amount');
  const [productSortDirection, setProductSortDirection] = useState<SortDirection>('desc');

  const [customerSortBy, setCustomerSortBy] = useState<'amount' | 'qty'>('amount');
  const [customerSortDirection, setCustomerSortDirection] = useState<SortDirection>('desc');

  const [productsData, setProductsData] = useState<Top10Row[]>([]);
  const [mainCustomersData, setMainCustomersData] = useState<Top10Row[]>([]);
  const [subCustomersData, setSubCustomersData] = useState<Top10Row[]>([]);

  useEffect(() => {
    const fetchTop10Data = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch('/api/Sales/Top10', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, filters })
        });
        if (!response.ok) throw new Error('Failed to fetch Top 10 data');
        const data = await response.json();
        setProductsData(data.productsData || []);
        setMainCustomersData(data.mainCustomersData || []);
        setSubCustomersData(data.subCustomersData || []);
      } catch (err) {
        console.error('Error fetching Top 10:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTop10Data();
  }, [filters, userId, refreshTrigger]);

  const sortedMainCustomers = useMemo(
    () => sortAndLimitRows(mainCustomersData, customerSortBy, customerSortDirection, topCount),
    [mainCustomersData, customerSortBy, customerSortDirection, topCount]
  );

  const sortedSubCustomers = useMemo(
    () => sortAndLimitRows(subCustomersData, customerSortBy, customerSortDirection, topCount),
    [subCustomersData, customerSortBy, customerSortDirection, topCount]
  );

  const sortedProducts = useMemo(
    () => sortAndLimitRows(productsData, productSortBy, productSortDirection, topCount),
    [productsData, productSortBy, productSortDirection, topCount]
  );

  const mainCustomerTotals = useMemo(() => calculateTotals(sortedMainCustomers), [sortedMainCustomers]);
  const subCustomerTotals = useMemo(() => calculateTotals(sortedSubCustomers), [sortedSubCustomers]);
  const productTotals = useMemo(() => calculateTotals(sortedProducts), [sortedProducts]);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const addCustomerSheet = (sheetName: string, rows: Top10Row[], totals: ReturnType<typeof calculateTotals>) => {
      const headers = ['#', 'Customer', 'Amount', 'Qty', 'Transactions'];
      const dataRows = rows.map((item, index) => [
        index + 1,
        item.customer,
        item.totalAmount.toFixed(2),
        item.totalQty.toFixed(0),
        item.transactions
      ]);

      if (rows.length > 0) {
        dataRows.push([
          '',
          'Total',
          totals.totalAmount.toFixed(2),
          totals.totalQty.toFixed(0),
          totals.totalTransactions
        ]);
      }

      const sheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    };

    addCustomerSheet('Main Customers', sortedMainCustomers, mainCustomerTotals);
    addCustomerSheet('Sub Customers', sortedSubCustomers, subCustomerTotals);

    const productHeaders = ['#', 'BARCODE', 'Product', 'Amount', 'Qty', 'Transactions'];
    const productRows = sortedProducts.map((item, index) => [
      index + 1,
      item.barcode,
      (item.products || []).join(', '),
      item.totalAmount.toFixed(2),
      item.totalQty.toFixed(0),
      item.transactions
    ]);

    if (sortedProducts.length > 0) {
      productRows.push([
        '',
        '',
        'Total',
        productTotals.totalAmount.toFixed(2),
        productTotals.totalQty.toFixed(0),
        productTotals.totalTransactions
      ]);
    }

    const productSheet = XLSX.utils.aoa_to_sheet([productHeaders, ...productRows]);
    XLSX.utils.book_append_sheet(workbook, productSheet, 'Products');

    const filename = `sales_top10_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const renderCustomerTable = (
    rows: Top10Row[],
    totals: ReturnType<typeof calculateTotals>,
    title: string,
    accentClass: string
  ) => (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-xl font-bold text-gray-800 flex items-center gap-2 ${accentClass}`}>
          <Users className="w-5 h-5" />
          {title}
        </h3>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Sort by:</label>
          <select
            value={customerSortBy}
            onChange={(e) => setCustomerSortBy(e.target.value as 'amount' | 'qty')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm font-medium"
          >
            <option value="amount">Value (Amount)</option>
            <option value="qty">Quantity</option>
          </select>
          <button
            onClick={() => setCustomerSortDirection(customerSortDirection === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            title="Toggle sort direction"
          >
            {customerSortDirection === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-16">#</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-56">Customer</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-32">Amount</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-24">Qty</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-32">Transactions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-600 font-medium text-center">{index + 1}</td>
                <td className="py-3 px-4 text-sm text-gray-800 font-medium text-center w-56 truncate" title={item.customer}>{item.customer}</td>
                <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
                  {item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
                  {item.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
                <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">{item.transactions}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  No data available
                </td>
              </tr>
            )}
            {rows.length > 0 && (
              <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                <td className="py-3 px-4 text-sm text-gray-800 text-center" colSpan={2}>Total</td>
                <td className="py-3 px-4 text-sm text-gray-800 text-center">
                  {totals.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-sm text-gray-800 text-center">
                  {totals.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
                <td className="py-3 px-4 text-sm text-gray-800 text-center">
                  {totals.totalTransactions}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) {
    return <SalesTabLoader />;
  }

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h1 className="text-2xl font-medium text-slate-800">Sales TOP10</h1>
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-sm w-full sm:w-[480px]">
            <button
              onClick={() => setActiveSubTab('main')}
              className={`flex-1 min-w-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'main' ? 'bg-white text-green-700 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Main Customers</span>
              </div>
            </button>
            <button
              onClick={() => setActiveSubTab('sub')}
              className={`flex-1 min-w-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'sub' ? 'bg-white text-green-700 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Sub Customers</span>
              </div>
            </button>
            <button
              onClick={() => setActiveSubTab('products')}
              className={`flex-1 min-w-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'products' ? 'bg-white text-green-700 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Package className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Products</span>
              </div>
            </button>
          </div>
          <button
            onClick={exportToExcel}
            className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
          </button>
        </div>

        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Display</label>
          <input
            type="number"
            min="1"
            max="100"
            value={topCount}
            onChange={(e) => setTopCount(Number(e.target.value))}
            className="w-12 text-center font-bold text-slate-700 focus:outline-none"
          />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l pl-3">Results</span>
        </div>
      </div>

      {activeSubTab === 'main' && renderCustomerTable(
        sortedMainCustomers,
        mainCustomerTotals,
        `Top ${topCount} Main Customers`,
        'text-purple-600'
      )}

      {activeSubTab === 'sub' && renderCustomerTable(
        sortedSubCustomers,
        subCustomerTotals,
        `Top ${topCount} Sub Customers`,
        'text-indigo-600'
      )}

      {activeSubTab === 'products' && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 text-green-600">
              <Package className="w-5 h-5" />
              Top {topCount} Products
            </h3>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <select
                value={productSortBy}
                onChange={(e) => setProductSortBy(e.target.value as 'amount' | 'qty')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium"
              >
                <option value="amount">Value (Amount)</option>
                <option value="qty">Quantity</option>
              </select>
              <button
                onClick={() => setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc')}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                title="Toggle sort direction"
              >
                {productSortDirection === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-14">#</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-36">BARCODE</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-44">Product</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-36">Amount</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-28">Qty</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-36">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-600 font-medium text-center">{index + 1}</td>
                    <td className="py-3 px-4 text-sm text-gray-800 font-medium text-center font-mono">{item.barcode}</td>
                    <td className="py-3 px-4 text-sm text-gray-800 font-medium text-center w-44">
                      <div className="flex flex-col gap-1">
                        {(item.products || []).map((product, idx) => (
                          <div key={idx} className="whitespace-normal break-words leading-snug">{product}</div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
                      {item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
                      {item.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">{item.transactions}</td>
                  </tr>
                ))}
                {sortedProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No data available
                    </td>
                  </tr>
                )}
                {sortedProducts.length > 0 && (
                  <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                    <td className="py-3 px-4 text-sm text-gray-800 text-center" colSpan={3}>Total</td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {productTotals.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {productTotals.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {productTotals.totalTransactions}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
