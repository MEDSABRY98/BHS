'use client';

import { useState, useEffect, useMemo } from 'react';
import { app_lpos_supabase } from '@/lib/supabase';
import { FileText, Loader2, Download, Printer, Search } from 'lucide-react';
import { generatePendingCustomerInvoicesPDF } from '@/lib/pdf/PendingCustomerInvoicesPdf';
import NoData from '@/components/01-Unified/NoDataTab';
import SearchSelect from '../../components/DropDownList';

export default function PendingCustomerInvoices() {
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [drivers, setDrivers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchDrivers();
    fetchPendingInvoices();
  }, []);

  async function fetchDrivers() {
    try {
      const { data, error } = await app_lpos_supabase
        .from('bhs_USERS')
        .select('*')
        .eq('USER_TYPE', 'Driver')
        .order('NAME');
      if (error) throw error;
      setDrivers(data || []);
    } catch (err) {
      console.error('Error fetching drivers:', err);
    }
  }

  async function fetchPendingInvoices() {
    setIsInvoicesLoading(true);
    try {
      const { data, error } = await app_lpos_supabase
        .from('app_lpos_ORDERS')
        .select(`
          *,
          bhs_CUSTOMERS ( "CUSTOMER NAME" ),
          app_lpos_DRIVERS!inner (
            DRIVERS_NAME,
            STATUS,
            OFFICE_HANDOVER_STATUS
          )
        `);

      if (error) throw error;

      // Filter in frontend to handle NULLs and non-Confirmed handovers accurately
      const pendingList = (data || []).filter((order: any) => {
        const driverRecord = order.app_lpos_DRIVERS?.[0];
        return driverRecord && driverRecord.OFFICE_HANDOVER_STATUS !== 'Confirmed';
      });

      setInvoices(pendingList);
    } catch (err) {
      console.error('Error fetching pending customer invoices:', err);
    } finally {
      setIsInvoicesLoading(false);
    }
  }

  const isSearchValid = customerSearch.trim().length >= 2;

  // Filter invoices by search term, date range, and selected driver:
  const filteredInvoices = useMemo(() => {
    if (!isSearchValid) return [];

    return invoices.filter((inv) => {
      // 1. Customer Name match
      const custName = inv.bhs_CUSTOMERS?.['CUSTOMER NAME'] || '';
      if (!custName.toLowerCase().includes(customerSearch.trim().toLowerCase())) {
        return false;
      }

      // 2. Driver filter match (Optional)
      if (selectedDriverId) {
        const driverRecord = inv.app_lpos_DRIVERS?.[0];
        if (driverRecord?.DRIVERS_NAME !== selectedDriverId) {
          return false;
        }
      }

      // 3. Date range match
      const dateStr = inv.ORDER_DATE || inv.CREATED_AT;
      if (dateStr) {
        const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        if (fromDate && datePart < fromDate) return false;
        if (toDate && datePart > toDate) return false;
      }
      return true;
    });
  }, [invoices, customerSearch, isSearchValid, fromDate, toDate, selectedDriverId]);

  // Sorted invoices:
  // 1st: by Date from oldest
  // 2nd: by Invoice ID / Order ID
  const sortedInvoices = useMemo(() => {
    return [...filteredInvoices].sort((a, b) => {
      const dateA = a.ORDER_DATE ? new Date(a.ORDER_DATE).getTime() : (a.CREATED_AT ? new Date(a.CREATED_AT).getTime() : 0);
      const dateB = b.ORDER_DATE ? new Date(b.ORDER_DATE).getTime() : (b.CREATED_AT ? new Date(b.CREATED_AT).getTime() : 0);

      if (dateA !== dateB) {
        return dateA - dateB;
      }

      const invA = a.INVOICE_ID || a.ORDER_ID || '';
      const invB = b.INVOICE_ID || b.ORDER_ID || '';
      return invA.localeCompare(invB);
    });
  }, [filteredInvoices]);

  const getDriverName = (driverId: string) => {
    const drv = drivers.find(d => d.ID === driverId);
    return drv ? drv.NAME : driverId || 'Unassigned';
  };

  const handlePdfAction = async (action: 'download' | 'print') => {
    if (sortedInvoices.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      await generatePendingCustomerInvoicesPDF(
        customerSearch.trim(),
        sortedInvoices,
        drivers,
        action,
        fromDate,
        toDate
      );
    } catch (err) {
      console.error('PDF Generation failed:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const totalAmount = useMemo(() => {
    return sortedInvoices.reduce((sum, item) => sum + (parseFloat(item.AMOUNT) || 0), 0);
  }, [sortedInvoices]);

  return (
    <div className="space-y-8">
      {/* Search and Filters */}
      <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-end gap-6">
          {/* Customer Search Input */}
          <div className="flex-1 min-w-0">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 mb-2 block">
              Search Customer
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by customer name..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-12 pr-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-black focus:outline-none focus:border-black transition-all hover:bg-gray-100/50 cursor-pointer h-[56px] focus:ring-4 focus:ring-black/5"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Driver Dropdown Filter */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between ml-1 mb-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block">
                Filter by Driver
              </label>
              {selectedDriverId && (
                <button
                  onClick={() => setSelectedDriverId('')}
                  className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <SearchSelect
              label=""
              placeholder="All Drivers"
              options={drivers.map((d) => ({ id: d.ID, label: d.NAME }))}
              value={selectedDriverId}
              onChange={setSelectedDriverId}
              heightClass="h-[56px]"
            />
          </div>

          <div className="w-full lg:w-48 shrink-0">
            <div className="flex items-center justify-between ml-1 mb-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block">
                From Date
              </label>
              {fromDate && (
                <button
                  onClick={() => setFromDate('')}
                  className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-black focus:outline-none focus:border-black transition-all hover:bg-gray-100/50 cursor-pointer h-[56px] focus:ring-4 focus:ring-black/5"
            />
          </div>

          <div className="w-full lg:w-48 shrink-0">
            <div className="flex items-center justify-between ml-1 mb-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block">
                To Date
              </label>
              {toDate && (
                <button
                  onClick={() => setToDate('')}
                  className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-black focus:outline-none focus:border-black transition-all hover:bg-gray-100/50 cursor-pointer h-[56px] focus:ring-4 focus:ring-black/5"
            />
          </div>

          <div className="flex gap-4 shrink-0 w-full lg:w-auto justify-end lg:justify-start">
            {isSearchValid && sortedInvoices.length > 0 && (
              <>
                <button
                  disabled={isGeneratingPdf}
                  onClick={() => handlePdfAction('print')}
                  title="Print Report"
                  className="w-[56px] h-[56px] bg-white border border-gray-200 text-black hover:border-black hover:bg-gray-50 rounded-2xl transition-all flex items-center justify-center shadow-sm cursor-pointer"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button
                  disabled={isGeneratingPdf}
                  onClick={() => handlePdfAction('download')}
                  title="Download PDF"
                  className="w-[56px] h-[56px] bg-black text-[#D4AF37] rounded-2xl shadow-xl shadow-black/10 hover:bg-gray-900 transition-all flex items-center justify-center cursor-pointer"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Results Content */}
      {isInvoicesLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-[3rem] border border-gray-100 shadow-sm">
          <Loader2 className="w-10 h-10 text-[#D4AF37] animate-spin mb-4" />
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading Invoices...</p>
        </div>
      ) : !isSearchValid ? (
        <NoData title="Type customer name to search" />
      ) : sortedInvoices.length === 0 ? (
        <NoData title="NO MATCHING PENDING INVOICES" />
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Pending Invoices</p>
                <h4 className="text-3xl font-black text-black">{sortedInvoices.length}</h4>
              </div>
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-500 font-black">
                #
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 text-[#D4AF37]">Total Value</p>
                <h4 className="text-3xl font-black text-black">
                  {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-gray-400 font-bold">AED</span>
                </h4>
              </div>
              <div className="w-12 h-12 bg-[#D4AF37]/10 rounded-2xl flex items-center justify-center text-[#D4AF37] font-black">
                AED
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
            {/* Table Header Action Bar */}
            <div className="px-8 py-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
              <div>
                <h3 className="text-sm font-black text-black uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-[#D4AF37] rounded-full" />
                  Search matches for: "{customerSearch}"
                </h3>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/30">
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Invoice Date</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Invoice ID</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer Name</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Driver</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedInvoices.map((inv) => {
                    const driverId = inv.app_lpos_DRIVERS?.[0]?.DRIVERS_NAME || '';
                    const displayDriverName = getDriverName(driverId);
                    return (
                      <tr key={inv.ID} className="group hover:bg-gray-50/30 transition-colors">
                        <td className="px-8 py-5 whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-500">
                            {inv.ORDER_DATE
                              ? new Date(inv.ORDER_DATE).toLocaleDateString('en-GB')
                              : (inv.CREATED_AT ? new Date(inv.CREATED_AT).toLocaleDateString('en-GB') : '-')}
                          </span>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                          <span className="text-sm font-black text-black">
                            {inv.INVOICE_ID || inv.ORDER_ID || '-'}
                          </span>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-800">
                            {inv.bhs_CUSTOMERS?.['CUSTOMER NAME'] || 'Unknown Customer'}
                          </span>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-700">
                            {displayDriverName}
                          </span>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                          <span className="text-sm font-black text-black">
                            {(parseFloat(inv.AMOUNT) || 0).toLocaleString()} <span className="text-[10px] text-gray-400 font-bold">AED</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
