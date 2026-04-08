'use client';

import React from 'react';
import { FileText } from 'lucide-react';
import { InvoiceRow } from '@/types';
import { generatePaymentAnalysisPDF } from '@/lib/pdf/PdfPaymentAnalysis';

// Sub-components
import { usePaymentTDataTab } from './payment-tracker/PaymentTDataHookTab';
import PaymentTDashboardTab from './payment-tracker/PaymentTDashboardTab';
import PaymentTCustomerTab from './payment-tracker/PaymentTCustomerTab';
import PaymentTPeriodTab from './payment-tracker/PaymentTPeriodTab';
import PaymentTAreaTab from './payment-tracker/PaymentTAreaTab';
import PaymentTExportTab from './payment-tracker/PaymentTExportTab';

interface PaymentTrackerTabProps {
  data: InvoiceRow[];
}

export default function PaymentTrackerTab({ data }: PaymentTrackerTabProps) {
  // Use our modular hook for all logic
  const p = usePaymentTDataTab(data);

  return (
    <div className="space-y-6">

      {/* Search and Filters Header - Modern Floating Card */}
      <div className="flex flex-col gap-8 bg-white/80 backdrop-blur-md p-7 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">

        {/* Row 1: Search box, Year/Month, and Date Filters */}
        <div className="flex flex-wrap lg:flex-nowrap items-end gap-4 pb-1">

          {/* Search Box - Enhanced Modern Style */}
          <div className="flex-1 min-w-[220px] space-y-1.5 relative group">
            <label className="text-[10px] font-bold text-gray-400 select-none uppercase tracking-[0.15em] ml-1 block h-3.5">Global Search</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search by customer, invoice or ID..."
                value={p.search}
                onChange={(e) => p.setSearch(e.target.value)}
                className="w-full pl-11 pr-5 py-3 bg-gray-50/50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white transition-all duration-300 text-sm font-medium"
              />
            </div>
          </div>

          <div className="h-10 w-px bg-gray-100 hidden lg:block mx-2 mb-1"></div>

          {/* Year & Month Inputs - Compact & Stylish */}
          <div className="flex items-end gap-2">
            <div className="w-24 space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] ml-1 h-3.5 block">Year</label>
              <input
                type="text"
                placeholder="YYYY"
                maxLength={4}
                value={p.chartYear}
                onChange={(e) => p.setChartYear(e.target.value)}
                className="w-full px-3 py-3 bg-gray-50/50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white transition-all duration-300 text-sm font-bold text-center"
              />
            </div>
            <div className="w-24 space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] ml-1 h-3.5 block">Month</label>
              <input
                type="text"
                placeholder="MM"
                maxLength={2}
                value={p.chartMonth}
                onChange={(e) => p.setChartMonth(e.target.value)}
                className="w-full px-3 py-3 bg-gray-50/50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white transition-all duration-300 text-sm font-bold text-center"
              />
            </div>
          </div>

          {/* Date Range - Premium Styling */}
          <div className="flex items-end gap-2">
            <div className="w-full sm:w-40 space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] ml-1 h-3.5 block">From</label>
              <input
                type="date"
                value={p.dateFrom}
                onChange={(e) => p.setDateFrom(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white transition-all duration-300 text-sm font-medium"
              />
            </div>
            <div className="w-full sm:w-40 space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] ml-1 h-3.5 block">To</label>
              <input
                type="date"
                value={p.dateTo}
                onChange={(e) => p.setDateTo(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white transition-all duration-300 text-sm font-medium"
              />
            </div>
          </div>

          {/* Sales Rep - Clean Dropdown */}
          <div className="w-full sm:w-56 space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] ml-1 h-3.5 block">Representative</label>
            <div className="relative">
              <select
                value={p.selectedSalesRep}
                onChange={(e) => p.setSelectedSalesRep(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white transition-all duration-300 text-sm font-medium appearance-none h-[46px]"
              >
                <option value="">Full Sales Force</option>
                {p.salesReps.map((rep) => (
                  <option key={rep} value={rep}>{rep}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-400">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>

          {/* PDF Action - Premium Vibrant Red */}
          <button
            onClick={() => p.setIsPdfExportOpen(true)}
            className="h-[46px] w-[46px] bg-rose-600 text-white rounded-2xl flex items-center justify-center lg:ml-auto mb-[1px] hover:bg-rose-700 transition-colors shadow-sm active:scale-95"
            title="Generate PDF Analytics"
          >
            <FileText className="h-6 w-6" />
          </button>
        </div>

        {/* Row 2: Tabs Switcher - Segmented Control Style */}
        <div className="flex items-center gap-1 p-1 bg-gray-50/80 rounded-[20px] border border-gray-100 w-full shadow-inner">
          {(['dashboard', 'customer', 'period', 'area'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                p.setActiveSubTab(tab);
                p.setDetailMode('none');
                p.setSelectedCustomer(null);
                p.setSelectedPeriod(null);
              }}
              className={`flex-1 py-3 rounded-2xl text-xs font-black tracking-widest uppercase transition-all duration-500 ${p.activeSubTab === tab
                ? 'bg-white text-indigo-600 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.02] scale-100 translate-z-0'
                : 'text-gray-400 hover:text-gray-600 hover:bg-white/40 scale-[0.98]'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 pb-12 px-2 sm:px-6 lg:px-8 mt-4">
        {p.activeSubTab === 'dashboard' && (
          <PaymentTDashboardTab
            dashboardData={p.dashboardData}
            chartPeriodType={p.chartPeriodType}
            setChartPeriodType={p.setChartPeriodType}
            chartYear={p.chartYear}
            setChartYear={p.setChartYear}
            chartMonth={p.chartMonth}
            setChartMonth={p.setChartMonth}
            averageCollections={p.averageCollections}
            averageCollectionDays={p.averageCollectionDays}
            dateFrom={p.dateFrom}
            dateTo={p.dateTo}
          />
        )}

        {p.activeSubTab === 'customer' && (
          <PaymentTCustomerTab
            detailMode={p.detailMode}
            setDetailMode={p.setDetailMode}
            selectedCustomer={p.selectedCustomer}
            setSelectedCustomer={p.setSelectedCustomer}
            filteredByCustomer={p.filteredByCustomer}
            customerTotals={p.customerTotals}
            customerDetailPayments={p.customerDetailPayments}
            customerChartData={p.customerChartData}
            customerAvgDays={p.customerAvgDays}
            lastCustomerSelection={p.lastCustomerSelection}
            setLastCustomerSelection={p.setLastCustomerSelection}
            sortColumn={p.sortColumn}
            setSortColumn={p.setSortColumn}
            sortDirection={p.sortDirection}
            setSortDirection={p.setSortDirection}
          />
        )}

        {p.activeSubTab === 'period' && (
          <PaymentTPeriodTab
            detailMode={p.detailMode}
            setDetailMode={p.setDetailMode}
            periodType={p.periodType}
            setPeriodType={p.setPeriodType}
            selectedPeriod={p.selectedPeriod}
            setSelectedPeriod={p.setSelectedPeriod}
            paymentsByPeriod={p.paymentsByPeriod}
            periodTotals={p.periodTotals}
            periodDetailPayments={p.periodDetailPayments}
            setLastPeriodSelection={p.setLastPeriodSelection}
          />
        )}

        {p.activeSubTab === 'area' && (
          <PaymentTAreaTab areaStats={p.areaStats} />
        )}
      </div>

      {/* Export Modals */}
      <PaymentTExportTab
        isPdfExportOpen={p.isPdfExportOpen}
        setIsPdfExportOpen={p.setIsPdfExportOpen}
        pdfExportSections={p.pdfExportSections}
        setPdfExportSections={p.setPdfExportSections}
        isCustomerSelectionOpen={p.isCustomerSelectionOpen}
        setIsCustomerSelectionOpen={p.setIsCustomerSelectionOpen}
        checklistSearch={p.checklistSearch}
        setChecklistSearch={p.setChecklistSearch}
        filteredCustomerChecklist={p.filteredCustomerChecklist}
        pdfSelectedCustomers={p.pdfSelectedCustomers}
        setPdfSelectedCustomers={p.setPdfSelectedCustomers}
        allCustomers={p.allCustomers}
        generatePaymentAnalysisPDF={generatePaymentAnalysisPDF}
        data={data}
        startDate={p.startDate}
        endDate={p.endDate}
        salesRep={p.selectedSalesRep}
        searchQuery={p.search}
      />
    </div>
  );
}
