'use client';

import React from 'react';
import { FileText, X } from 'lucide-react';
import { InvoiceRow } from '@/types';
import { generatePaymentAnalysisPDF } from '@/app/Debit/Pdf/PaymentUtils';

// Sub-components
import { usePaymentTDataTab } from './PaymentTDataHookTab';
import PaymentTDashboardTab from './PaymentTDashboardTab';
import PaymentTDetailsDashboardTab from './PaymentTDetailsDashboardTab';
import PaymentTCustomerTab from './PaymentTCustomerTab';
import PaymentTPeriodTab from './PaymentTPeriodTab';
import PaymentTAreaTab from './PaymentTAreaTab';
import PaymentTExportTab from './PaymentTExportTab';

interface PaymentTrackerTabProps {
  data: InvoiceRow[];
}

export default function PaymentTrackerTab({ data }: PaymentTrackerTabProps) {
  // Use our modular hook for all logic
  const p = usePaymentTDataTab(data);

  const inputClass = 'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 text-sm';
  const labelClass = 'text-xs font-medium text-gray-500 mb-1 block';

  return (
    <div className="space-y-6">

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap lg:flex-nowrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className={labelClass}>Search</label>
            <input
              type="text"
              placeholder="Customer, invoice or ID..."
              value={p.search}
              onChange={(e) => p.setSearch(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="w-20">
            <label className={labelClass}>Year</label>
            <input type="text" placeholder="YYYY" maxLength={4} value={p.chartYear} onChange={(e) => p.setChartYear(e.target.value)} className={`${inputClass} text-center font-medium`} />
          </div>
          <div className="w-16">
            <label className={labelClass}>Month</label>
            <input type="text" placeholder="MM" maxLength={2} value={p.chartMonth} onChange={(e) => p.setChartMonth(e.target.value)} className={`${inputClass} text-center font-medium`} />
          </div>
          <div className="w-full sm:w-36">
            <label className={labelClass}>From</label>
            <input type="date" value={p.dateFrom} onChange={(e) => p.setDateFrom(e.target.value)} className={inputClass} />
          </div>
          <div className="w-full sm:w-36">
            <label className={labelClass}>To</label>
            <input type="date" value={p.dateTo} onChange={(e) => p.setDateTo(e.target.value)} className={inputClass} />
          </div>
          <div className="w-full sm:w-48">
            <label className={labelClass}>Representative</label>
            <select value={p.selectedSalesRep} onChange={(e) => p.setSelectedSalesRep(e.target.value)} className={inputClass}>
              <option value="">All Reps</option>
              {p.salesReps.map((rep) => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                p.setSearch('');
                p.setChartYear('');
                p.setChartMonth('');
                p.setDateFrom('');
                p.setDateTo('');
                p.setSelectedSalesRep('');
              }}
              className="h-9 w-9 border border-gray-200 text-gray-500 rounded-lg flex items-center justify-center hover:bg-gray-50"
              title="Clear filters"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={() => p.setIsPdfExportOpen(true)}
              className="h-9 w-9 bg-gray-800 text-white rounded-lg flex items-center justify-center hover:bg-gray-700"
              title="Export PDF"
            >
              <FileText className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg border border-gray-200 w-full">
          {(['dashboard', 'details-dashboard', 'customer', 'period', 'area'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                p.setActiveSubTab(tab);
                p.setDetailMode('none');
                p.setSelectedCustomer(null);
                p.setSelectedPeriod(null);
              }}
              className={`flex-1 py-2 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors ${p.activeSubTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

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

            dateFrom={p.dateFrom}
            dateTo={p.dateTo}
          />
        )}

        {p.activeSubTab === 'details-dashboard' && (
          <PaymentTDetailsDashboardTab
            data={data}
            startDate={p.startDate}
            endDate={p.endDate}
            searchQuery={p.search}
            salesRep={p.selectedSalesRep}
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
