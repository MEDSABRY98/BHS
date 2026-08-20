'use client';

import { useState, useMemo, useEffect } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useSalesRawData } from '@/app/Sales/Context/SalesRawDataContext';
import { exportSalesExcel } from '@/app/Sales/Utils/ExcelExport';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import SalesTabLoader from '@/app/Sales/Shared/TabLoader';
import ExportExcelModal from './ExportExcelModal';
import { trackSalesNestedTab, SALES_DAILY_SALES_TAB_LABELS } from '@/app/Audit/Model/SalesTabAudit';

import AllInvoicesTab from './AllInvoicesTab';
import SalesByDayTab from './SalesByDayTab';
import AvgSalesByDayTab from './AvgSalesByDayTab';

interface SalesDailySalesTabProps {
  userId: string;
  showCosts?: boolean;
}

export default function SalesDailySalesTab({ userId, showCosts = true }: SalesDailySalesTabProps) {
  const { ensureRawData, dailySales, loading, isInitialLoading, error } = useSalesRawData();

  useEffect(() => {
    void ensureRawData();
  }, [ensureRawData]);

  const dailySalesData = dailySales?.dailySalesData ?? [];
  const salesByDayData = dailySales?.salesByDayData ?? [];
  const avgSalesByDayData = dailySales?.avgSalesByDayData ?? [];

  const [activeSubTab, setActiveSubTab] = useState<'all-invoices' | 'sales-by-day' | 'avg-sales-by-day'>('all-invoices');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  useEffect(() => {
    trackSalesNestedTab('sales-daily-sales', activeSubTab, SALES_DAILY_SALES_TAB_LABELS);
  }, [activeSubTab]);

  const allInvoicesStats = useMemo(() => {
    const salesInvoices = dailySalesData.filter((inv: any) => inv.invoiceNumber.toUpperCase().startsWith('SAL'));
    const returnInvoices = dailySalesData.filter((inv: any) => inv.invoiceNumber.toUpperCase().startsWith('RSAL'));

    const totalSales = salesInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0);
    const totalReturns = returnInvoices.reduce((sum: number, inv: any) => sum + Math.abs(inv.amount), 0);

    const netSales = dailySalesData.reduce((sum: number, inv: any) => sum + inv.amount, 0);

    return {
      netSales,
      totalSales,
      totalReturns,
      salesCount: salesInvoices.length,
      returnsCount: returnInvoices.length
    };
  }, [dailySalesData]);

  // Format date as DD/MM/YYYY
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return '';
    }
  };

  if (isInitialLoading) {
    return <SalesTabLoader />;
  }

  if (error) {
    return (
      <TabFetchError
        message={error}
        onRetry={() => void ensureRawData()}
        isRetrying={loading}
        className="min-h-[360px]"
      />
    );
  }

  // Export to Excel - All Invoices
  const exportAllInvoicesToExcel = async (type: 'summary' | 'detailed') => {
    let worksheetData: Record<string, unknown>[] = [];
    let numericColumns: string[] = [];

    if (type === 'summary') {
      worksheetData = dailySalesData.map((item: any) => {
        const row: Record<string, unknown> = {
          'Date': formatDate(item.invoiceDate),
          'Invoice Number': item.invoiceNumber,
          'Main Customer Name': item.customerMainName || '',
          'Sub Customer Name': item.customerName || '',
          'City': item.market || item.area || '',
          'Salesman': item.salesRep || '',
          'Merchandiser': item.merchandiser || '',
          'Total': Number(item.amount) || 0,
        };
        return row;
      });
      numericColumns = ['Total'];
    } else {
      dailySalesData.forEach((invoice: any) => {
        const items = invoice.items || [];
        if (items.length === 0) {
          // If no items, at least output the invoice
          worksheetData.push({
            'Date': formatDate(invoice.invoiceDate),
            'Invoice Number': invoice.invoiceNumber,
            'Product ID': '',
            'Barcode': '',
            'Product Name': '',
            'Cost Price': 0,
            'Selling Price': 0,
            'Category': '',
            'Main Customer Name': invoice.customerMainName || '',
            'Sub Customer Name': invoice.customerName || '',
            'City': invoice.market || invoice.area || '',
            'Salesman': invoice.salesRep || '',
            'Merchandiser': invoice.merchandiser || '',
            'Total': Number(invoice.amount) || 0,
          });
        } else {
          items.forEach((line: any) => {
            worksheetData.push({
              'Date': formatDate(invoice.invoiceDate),
              'Invoice Number': invoice.invoiceNumber,
              'Product ID': line.productId || line.product || '',
              'Barcode': line.barcode || '',
              'Product Name': line.product || '',
              'Cost Price': Number(line.productCost) || 0,
              'Selling Price': Number(line.productPrice) || 0,
              'Category': line.productTag || '',
              'Main Customer Name': invoice.customerMainName || '',
              'Sub Customer Name': invoice.customerName || '',
              'City': invoice.market || invoice.area || '',
              'Salesman': invoice.salesRep || '',
              'Merchandiser': invoice.merchandiser || '',
              'Total': Number(line.amount) || 0,
            });
          });
        }
      });
      numericColumns = ['Cost Price', 'Selling Price', 'Total'];
    }

    await exportSalesExcel(worksheetData, `All_Invoices_${type}.xlsx`, {
      sheetName: 'All Invoices',
      numericColumns,
    });
  };

  // Export to Excel - Sales BY Day
  const exportSalesByDayToExcel = async () => {
    const worksheetData = salesByDayData.map(item => ({
      'Date': item.date,
      'Amount': item.amount,
      'Quantity': item.qty,
      'Invoices Count': item.salInvoicesCount,
      'Customers Count': item.salCustomersCount,
      'Products Count': item.salProductsCount
    }));

    await exportSalesExcel(worksheetData, 'Sales_BY_Day.xlsx', {
      sheetName: 'Sales BY Day',
      numericColumns: ['Amount', 'Quantity'],
    });
  };

  // Export to Excel - AVG Sales BY Day
  const exportAvgSalesByDayToExcel = async () => {
    const worksheetData = avgSalesByDayData.map(item => ({
      'Month/Year': item.monthYear,
      'Avg Daily Amount': item.avgAmount,
      'Avg Daily Quantity': item.avgQty,
      'Avg Daily Invoices': item.avgInvoices,
      'Avg Daily Customers': item.avgCustomers,
      'Avg Daily Products': item.avgProducts
    }));

    await exportSalesExcel(worksheetData, 'AVG_Sales_BY_Day.xlsx', {
      sheetName: 'AVG Sales BY Day',
      numericColumns: ['Avg Daily Amount', 'Avg Daily Quantity'],
    });
  };

  if (loading) {
    return <SalesTabLoader />;
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
        <h1 className="text-2xl font-medium text-slate-800">Sales Daily Sales</h1>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (activeSubTab === 'all-invoices') setIsExportModalOpen(true);
              else if (activeSubTab === 'sales-by-day') exportSalesByDayToExcel();
              else exportAvgSalesByDayToExcel();
            }}
            className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex gap-3">
          <button
            onClick={() => setActiveSubTab('all-invoices')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${activeSubTab === 'all-invoices'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            All Invoices
          </button>
          <button
            onClick={() => setActiveSubTab('sales-by-day')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${activeSubTab === 'sales-by-day'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Sales BY Day
          </button>
          <button
            onClick={() => setActiveSubTab('avg-sales-by-day')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${activeSubTab === 'avg-sales-by-day'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            AVG Sales BY Day
          </button>
        </div>
      </div>

      {/* Statistics Cards - Distributed Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Net Sales Card */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl px-5 py-3 shadow-lg text-white flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-green-100 text-xs uppercase font-bold tracking-wider">Net Sales</span>
            <span className="text-3xl font-black tracking-tight leading-none my-0.5">
              {allInvoicesStats.netSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-green-50 opacity-90 font-medium">AED (Sales - Returns)</span>
          </div>
        </div>

        {/* Sales Invoices Count Card */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl px-5 py-3 shadow-lg text-white flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-blue-100 text-xs uppercase font-bold tracking-wider">Sales Invoices</span>
            <span className="text-3xl font-black tracking-tight leading-none my-0.5">
              {allInvoicesStats.salesCount.toLocaleString('en-US')}
            </span>
            <span className="text-[10px] text-blue-50 opacity-90 font-medium">Count</span>
          </div>
          <div className="flex flex-col items-end justify-center">
            <div className="text-right">
              <span className="block text-[10px] text-blue-100 opacity-80 uppercase font-bold">Total Val</span>
              <span className="block text-2xl font-bold leading-none">
                {allInvoicesStats.totalSales.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-blue-100 opacity-90">AED</span>
            </div>
          </div>
        </div>

        {/* Returns Invoices Count Card */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl px-5 py-3 shadow-lg text-white flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-red-100 text-xs uppercase font-bold tracking-wider">Return Invoices</span>
            <span className="text-3xl font-black tracking-tight leading-none my-0.5">
              {allInvoicesStats.returnsCount.toLocaleString('en-US')}
            </span>
            <span className="text-[10px] text-red-50 opacity-90 font-medium">Count</span>
          </div>
          <div className="flex flex-col items-end justify-center">
            <div className="text-right">
              <span className="block text-[10px] text-red-100 opacity-80 uppercase font-bold">Total Val</span>
              <span className="block text-2xl font-bold leading-none">
                {allInvoicesStats.totalReturns.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-red-100 opacity-90">AED</span>
            </div>
          </div>
        </div>
      </div>

      {activeSubTab === 'all-invoices' && (
        <AllInvoicesTab 
          dailySalesData={dailySalesData} 
          showCosts={showCosts} 
          formatDate={formatDate} 
        />
      )}

      {activeSubTab === 'sales-by-day' && (
        <SalesByDayTab 
          salesByDayData={salesByDayData} 
        />
      )}

      {activeSubTab === 'avg-sales-by-day' && (
        <AvgSalesByDayTab 
          avgSalesByDayData={avgSalesByDayData} 
        />
      )}

      <ExportExcelModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={(type) => exportAllInvoicesToExcel(type)}
      />
    </div>
  );
}
