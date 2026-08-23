'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabsNav from './TabsNav';
import SubCustomerSummaryTab from './SubCustomerSummary/SubCustomerSummaryTab';
import DashboardTab from './Dashboard/DashboardTab';
import SubCustomersTab from './SubCustomers/SubCustomersTab';
import MonthlyTab from './Monthly/MonthlyTab';
import CategoriesTab from './Categories/CategoriesTab';
import ProductsTab from './Products/ProductsTab';
import InvoicesTab from './Invoices/InvoicesTab';
import InvoiceDetailModal from './InvoiceDetailModal';
import { useCustomerDetailsData } from './UseCustomerDetailsData';
import {
  exportInvoicesToExcel,
  exportProductsToExcel,
  exportSingleInvoiceToExcel,
  exportSubCustomersToExcel,
} from './Exports';
import type { CustomerDetailsTabId, SalesCustomerDetailsProps, SelectedInvoice } from './Types';
import { trackSalesCustomerDetailsTab } from '@/app/Audit/Model/SalesTabAudit';

export default function SalesCustomerDetails({
  customerName,
  customerId,
  customerType = 'sub',
  userId,
  onBack,
  initialTab,
  showCosts = true,
  auditParentTabId = 'sales-customers',
  onOpenMainCustomer,
}: SalesCustomerDetailsProps) {
  const [activeTab, setActiveTab] = useState<CustomerDetailsTabId>(
    initialTab ?? (customerType === 'sub' ? 'summary' : 'dashboard')
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<'all' | 'sales' | 'returns'>('all');
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<SelectedInvoice | null>(null);
  const invoicesPerPage = 50;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setInvoicesPage(1);
  }, [invoiceTypeFilter, debouncedSearchQuery]);

  useEffect(() => {
    trackSalesCustomerDetailsTab(auditParentTabId, activeTab);
  }, [auditParentTabId, activeTab]);

  const {
    loading,
    customerData,
    monthlySales,
    productsData,
    subCustomersData,
    groupedInvoicesData,
    dashboardMetrics,
    chartData,
    subCustomerSummary,
  } = useCustomerDetailsData({
    customerName,
    customerId,
    customerType,
    userId,
    debouncedSearchQuery,
    invoiceTypeFilter,
  });

  if (loading) {
    return <TabLoader />;
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title="Back to Customers"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-3xl font-bold text-gray-800">{customerName}</h1>
      </div>

      <div className="mb-6">
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by product, barcode, merchandiser, sales rep, invoice..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
          />
        </div>
      </div>

      <TabsNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        customerType={customerType}
        subCustomersCount={subCustomersData.length}
      />

      {activeTab === 'summary' && customerType === 'sub' && (
        <SubCustomerSummaryTab
          customerName={customerName}
          summary={subCustomerSummary}
          onOpenMainCustomer={onOpenMainCustomer}
        />
      )}

      {activeTab === 'dashboard' && (
        <DashboardTab dashboardMetrics={dashboardMetrics} chartData={chartData} />
      )}

      {activeTab === 'subcustomers' && customerType === 'main' && (
        <SubCustomersTab
          subCustomersData={subCustomersData}
          onExport={() => exportSubCustomersToExcel(subCustomersData, customerName)}
        />
      )}

      {activeTab === 'categories' && (
        <CategoriesTab data={customerData} customerName={customerName} searchQuery={debouncedSearchQuery} />
      )}

      {activeTab === 'monthly' && <MonthlyTab monthlySales={monthlySales} />}

      {activeTab === 'products' && (
        <ProductsTab
          productsData={productsData}
          showCosts={showCosts}
          onExport={() => exportProductsToExcel(productsData, customerName, showCosts)}
        />
      )}

      {activeTab === 'invoices' && (
        <InvoicesTab
          groupedInvoicesData={groupedInvoicesData}
          customerType={customerType}
          customerName={customerName}
          invoiceTypeFilter={invoiceTypeFilter}
          onInvoiceTypeFilterChange={setInvoiceTypeFilter}
          invoicesPage={invoicesPage}
          onInvoicesPageChange={setInvoicesPage}
          invoicesPerPage={invoicesPerPage}
          onSelectInvoice={setSelectedInvoice}
          onExport={() => exportInvoicesToExcel(groupedInvoicesData, customerName, customerType)}
        />
      )}

      {selectedInvoice && (
        <InvoiceDetailModal
          selectedInvoice={selectedInvoice}
          showCosts={showCosts}
          onClose={() => setSelectedInvoice(null)}
          onExport={(invoice) => exportSingleInvoiceToExcel(invoice, showCosts)}
        />
      )}
    </div>
  );
}
