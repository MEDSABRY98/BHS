'use client';

import { useState, useEffect, useMemo } from 'react';
import { bhs_supabas } from '@/lib/Supabase';
import { FileText, Loader2, Download, Printer, AlertCircle, Search, Calendar } from 'lucide-react';
import { generatePendingDriverInvoicesPDF } from '@/app/LPOs/Pdf/PendingDriverInvoicesPdf';
import NoData from '@/app/Components/NoDataTab';

export default function PendingDriverInvoices() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingDriverId, setGeneratingDriverId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);

  useEffect(() => {
    const mainUserStr = localStorage.getItem('currentUser');
    if (mainUserStr) {
      const u = JSON.parse(mainUserStr);
      setCurrentAdmin({
        id: u.id || u.ID || 'R-0001',
        name: u.name || u.NAME || 'MED Sabry'
      });
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setIsLoading(true);
    try {
      // 1. Fetch drivers
      const { data: driversData, error: drvErr } = await bhs_supabas
        .from('bhs_USERS')
        .select('*')
        .eq('USER_TYPE', 'Driver')
        .order('NAME');
      if (drvErr) throw drvErr;
      setDrivers(driversData || []);

      // 2. Fetch all pending driver invoices (where handover status !== Confirmed)
      const { data: ordersData, error: ordErr } = await bhs_supabas
        .from('app_lpos_ORDERS')
        .select(`
          *,
          bhs_CUSTOMERS ( "CUSTOMER NAME":"CUSTOMER SUB NAME" ),
          app_lpos_DRIVERS (
            DRIVERS_NAME,
            STATUS,
            OFFICE_HANDOVER_STATUS
          )
        `);
      if (ordErr) throw ordErr;

      // Filter in frontend to handle NULLs and non-Confirmed handovers accurately
      const pendingList = (ordersData || []).filter((order: any) => {
        const driverRecord = order.app_lpos_DRIVERS?.[0];
        return driverRecord && driverRecord.OFFICE_HANDOVER_STATUS !== 'Confirmed';
      });
      setInvoices(pendingList);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter invoices by Date Range and Customer Name:
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Customer search filter
      if (customerSearch) {
        const custName = inv.bhs_CUSTOMERS?.['CUSTOMER NAME'] || '';
        if (!custName.toLowerCase().includes(customerSearch.trim().toLowerCase())) {
          return false;
        }
      }

      const dateStr = inv.ORDER_DATE || inv.CREATED_AT;
      if (dateStr) {
        const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        if (fromDate && datePart < fromDate) return false;
        if (toDate && datePart > toDate) return false;
      }
      return true;
    });
  }, [invoices, fromDate, toDate, customerSearch]);

  // Aggregate metrics per driver
  const driverMetrics = useMemo(() => {
    return drivers.map((driver) => {
      // Find invoices for this driver
      const driverInvoices = filteredInvoices.filter(
        (inv) => inv.app_lpos_DRIVERS?.[0]?.DRIVERS_NAME === driver.ID
      );

      // Unique customers count
      const uniqueCustomerIds = new Set(
        driverInvoices.map((inv) => inv.CUSTOMER_ID).filter(Boolean)
      );

      // Average delay days
      let totalDelayDays = 0;
      driverInvoices.forEach((inv) => {
        const dateStr = inv.ORDER_DATE || inv.CREATED_AT;
        if (dateStr) {
          const invoiceDate = new Date(dateStr);
          const diffTime = Math.max(0, Date.now() - invoiceDate.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          totalDelayDays += diffDays;
        }
      });

      const avgDelayDays = driverInvoices.length > 0
        ? Math.round(totalDelayDays / driverInvoices.length)
        : 0;

      return {
        driver,
        invoices: driverInvoices,
        pendingCount: driverInvoices.length,
        uniqueCustomersCount: uniqueCustomerIds.size,
        avgDelayDays,
      };
    }).sort((a, b) => b.pendingCount - a.pendingCount); // Sort drivers with most pending invoices first
  }, [drivers, filteredInvoices]);

  const handlePdfAction = async (action: 'download' | 'print', driver: any, driverInvoices: any[]) => {
    if (driverInvoices.length === 0) return;
    setGeneratingDriverId(driver.ID);
    try {
      // Fetch driver signature from database
      let driverSignature = '';
      const { data: driverData, error: driverErr } = await bhs_supabas
        .from('bhs_USERS')
        .select('SIGNATURE')
        .eq('ID', driver.ID)
        .single();
      if (!driverErr && driverData?.SIGNATURE) {
        driverSignature = driverData.SIGNATURE;
      }

      // Fetch admin signature from database
      let adminSignature = '';
      if (currentAdmin?.id) {
        const { data: adminData, error: adminErr } = await bhs_supabas
          .from('bhs_USERS')
          .select('SIGNATURE')
          .eq('ID', currentAdmin.id)
          .single();
        if (!adminErr && adminData?.SIGNATURE) {
          adminSignature = adminData.SIGNATURE;
        }
      }

      // Sort driverInvoices by oldest date, then by Invoice/Order ID
      const sortedDriverInvoices = [...driverInvoices].sort((a, b) => {
        const dateA = a.ORDER_DATE ? new Date(a.ORDER_DATE).getTime() : (a.CREATED_AT ? new Date(a.CREATED_AT).getTime() : 0);
        const dateB = b.ORDER_DATE ? new Date(b.ORDER_DATE).getTime() : (b.CREATED_AT ? new Date(b.CREATED_AT).getTime() : 0);

        if (dateA !== dateB) {
          return dateA - dateB;
        }

        const invA = a.INVOICE_ID || a.ORDER_ID || '';
        const invB = b.INVOICE_ID || b.ORDER_ID || '';
        return invA.localeCompare(invB);
      });

      await generatePendingDriverInvoicesPDF(
        driver.NAME,
        sortedDriverInvoices,
        action,
        fromDate,
        toDate,
        driverSignature,
        adminSignature
      );
    } catch (err) {
      console.error('PDF Generation failed:', err);
    } finally {
      setGeneratingDriverId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Search and Filters */}
      <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-end gap-6">

          {/* Customer Search Input */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between ml-1 mb-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block">
                Search Customer
              </label>
              {customerSearch && (
                <button
                  onClick={() => setCustomerSearch('')}
                  className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by customer name..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-12 pr-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-black focus:outline-none focus:border-black transition-all hover:bg-gray-100/50 h-[56px] focus:ring-4 focus:ring-black/5 placeholder:text-gray-400 font-sans"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Date Filters */}
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

        </div>
      </div>

      {/* Driver Pending Invoices Overview */}
      <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-8 px-2">
          <div>
            <h3 className="text-2xl font-black text-black tracking-tight">
              Pending Invoices Overview
            </h3>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading Driver Metrics...</p>
          </div>
        ) : driverMetrics.length === 0 ? (
          <NoData title="NO LOGISTICS DRIVERS FOUND" />
        ) : (
          <div className="overflow-x-auto rounded-[2.5rem] border border-gray-50">
            <table className="w-full text-center border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-6 px-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Driver Name</th>
                  <th className="py-6 px-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pending Invoices</th>
                  <th className="py-6 px-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customers</th>
                  <th className="py-6 px-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Avg. Delay Days</th>
                  <th className="py-6 px-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] pr-10">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {driverMetrics.map(({ driver, invoices: driverInvoices, pendingCount, uniqueCustomersCount, avgDelayDays }) => (
                  <tr key={driver.ID} className="group hover:bg-gray-50/50 transition-all duration-200">
                    <td className="py-6 px-6 text-center">
                      <span className="text-sm font-black text-black group-hover:text-[#D4AF37] transition-colors">
                        {driver.NAME}
                      </span>
                    </td>
                    <td className="py-6 px-6 text-center">
                      <span className={`text-sm font-black ${pendingCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {pendingCount}
                      </span>
                    </td>
                    <td className="py-6 px-6 text-center">
                      <span className="text-sm font-bold text-gray-600">
                        {uniqueCustomersCount}
                      </span>
                    </td>
                    <td className="py-6 px-6 text-center">
                      <span className={`text-sm font-black ${avgDelayDays > 5 ? 'text-red-500' : avgDelayDays > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {avgDelayDays > 0 ? `${avgDelayDays} Days` : '-'}
                      </span>
                    </td>
                    <td className="py-6 px-6 text-right pr-10">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          disabled={pendingCount === 0 || generatingDriverId !== null}
                          onClick={() => handlePdfAction('print', driver, driverInvoices)}
                          title="Print Report"
                          className="w-10 h-10 bg-white border border-gray-200 text-black hover:border-black hover:bg-gray-50 rounded-xl transition-all flex items-center justify-center shadow-sm disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          disabled={pendingCount === 0 || generatingDriverId !== null}
                          onClick={() => handlePdfAction('download', driver, driverInvoices)}
                          title="Download PDF"
                          className="w-10 h-10 bg-black text-[#D4AF37] hover:bg-gray-900 rounded-xl shadow-md transition-all flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        >
                          {generatingDriverId === driver.ID ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
