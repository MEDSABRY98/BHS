'use client';

import { useState, useEffect, useMemo } from 'react';
import { app_lpos_supabase } from '@/lib/supabase';
import SearchSelect from '../../components/DropDownList';
import { FileText, Loader2, Download, Printer, AlertCircle, FilePenLine } from 'lucide-react';
import { generateDeliveredDriverInvoicesPDF } from '@/lib/pdf/DeliveredDriverInvoicesPdf';
import NoData from '@/components/01-Unified/NoDataTab';
import SignatureModal from './SignatureModal';

export default function DeliveredDriverInvoices() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isDriversLoading, setIsDriversLoading] = useState(true);
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);

  useEffect(() => {
    const mainUserStr = localStorage.getItem('currentUser');
    if (mainUserStr) {
      const u = JSON.parse(mainUserStr);
      setCurrentAdmin({
        id: u.id || u.ID || 'U-0001',
        name: u.name || u.NAME || 'MED Sabry'
      });
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, []);

  useEffect(() => {
    if (selectedDriverId) {
      fetchDeliveredInvoices();
    } else {
      setInvoices([]);
    }
  }, [selectedDriverId]);

  async function fetchDrivers() {
    setIsDriversLoading(true);
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
    } finally {
      setIsDriversLoading(false);
    }
  }

  async function fetchDeliveredInvoices() {
    setIsInvoicesLoading(true);
    try {
      // Fetch all invoices assigned to this driver
      const { data, error } = await app_lpos_supabase
        .from('app_lpos_ORDERS')
        .select(`
          *,
          app_lpos_CUSTOMERS ( "CUSTOMER NAME" ),
          app_lpos_DRIVERS!inner (
            DRIVERS_NAME,
            STATUS,
            OFFICE_HANDOVER_STATUS,
            OFFICE_HANDOVER_TIME,
            DELIVERY_TIME
          )
        `)
        .eq('app_lpos_DRIVERS.DRIVERS_NAME', selectedDriverId);

      if (error) throw error;

      // Filter in frontend to show ONLY Confirmed handovers
      const deliveredList = (data || []).filter((order: any) => {
        const driverRecord = order.app_lpos_DRIVERS?.[0];
        return driverRecord && driverRecord.OFFICE_HANDOVER_STATUS === 'Confirmed';
      });

      setInvoices(deliveredList);
    } catch (err) {
      console.error('Error fetching delivered invoices:', err);
    } finally {
      setIsInvoicesLoading(false);
    }
  }

  // Filter invoices by Office Handover Date Range:
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const driverRecord = inv.app_lpos_DRIVERS?.[0];
      const dateStr = driverRecord?.OFFICE_HANDOVER_TIME || inv.ORDER_DATE || inv.CREATED_AT;
      if (!dateStr) return true;

      const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;

      if (fromDate && datePart < fromDate) return false;
      if (toDate && datePart > toDate) return false;
      return true;
    });
  }, [invoices, fromDate, toDate]);

  // Sorted invoices based on USER request:
  // 1st: by Date from oldest (من الأقدم)
  // 2nd: by Invoice ID (حسب رقم الفاتورة)
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

  const selectedDriverName = useMemo(() => {
    const drv = drivers.find(d => d.ID === selectedDriverId);
    return drv ? drv.NAME : '';
  }, [drivers, selectedDriverId]);

  const handlePdfAction = async (action: 'download' | 'print') => {
    if (sortedInvoices.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      // Fetch driver signature from database
      let driverSignature = '';
      const { data: driverData, error: driverErr } = await app_lpos_supabase
        .from('bhs_USERS')
        .select('SIGNATURE')
        .eq('ID', selectedDriverId)
        .single();
      if (!driverErr && driverData?.SIGNATURE) {
        driverSignature = driverData.SIGNATURE;
      }

      // Fetch admin signature from database
      let adminSignature = '';
      if (currentAdmin?.id) {
        const { data: adminData, error: adminErr } = await app_lpos_supabase
          .from('bhs_USERS')
          .select('SIGNATURE')
          .eq('ID', currentAdmin.id)
          .single();
        if (!adminErr && adminData?.SIGNATURE) {
          adminSignature = adminData.SIGNATURE;
        }
      }

      await generateDeliveredDriverInvoicesPDF(
        selectedDriverName, 
        sortedInvoices, 
        action, 
        fromDate, 
        toDate,
        driverSignature,
        adminSignature
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
      {/* Selector Area */}
      <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-end gap-6">
          <div className="flex-1 min-w-0">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 mb-2 block">
              Select Driver
            </label>
            <SearchSelect
              label=""
              placeholder="Pick a logistics driver..."
              options={drivers.map(d => ({ id: d.ID, label: d.NAME }))}
              value={selectedDriverId}
              onChange={setSelectedDriverId}
              isLoading={isDriversLoading}
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
            <button
              onClick={() => setIsSignatureModalOpen(true)}
              title="Manage Signatures"
              className="w-[68px] h-[68px] bg-white border border-gray-200 text-black hover:border-black hover:bg-gray-50 rounded-2xl transition-all flex items-center justify-center shadow-sm cursor-pointer"
            >
              <FilePenLine className="w-5 h-5" />
            </button>

            {selectedDriverId && sortedInvoices.length > 0 && (
              <>
                <button
                  disabled={isGeneratingPdf}
                  onClick={() => handlePdfAction('print')}
                  title="Print Report"
                  className="w-[68px] h-[68px] bg-white border border-gray-200 text-black hover:border-black rounded-2xl transition-all flex items-center justify-center shadow-sm cursor-pointer"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button
                  disabled={isGeneratingPdf}
                  onClick={() => handlePdfAction('download')}
                  title="Download PDF"
                  className="w-[68px] h-[68px] bg-black text-[#D4AF37] rounded-2xl shadow-xl shadow-black/10 hover:bg-gray-900 transition-all flex items-center justify-center cursor-pointer"
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

      {/* Report Results */}
      {selectedDriverId && (
        <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 px-2">
            <div>
              <h3 className="text-2xl font-black text-black tracking-tight">
                {selectedDriverName}'s Delivered Invoices
              </h3>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                Confirmed office handovers
              </p>
            </div>

            {sortedInvoices.length > 0 && (
              <div className="flex items-center gap-6">
                <div className="text-center md:text-right">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Value</span>
                  <p className="text-2xl font-black text-[#D4AF37]">
                    AED {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="px-5 py-3 bg-gray-50 text-black border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                  {sortedInvoices.length} Confirmed
                </div>
              </div>
            )}
          </div>

          {isInvoicesLoading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading Invoices...</p>
            </div>
          ) : sortedInvoices.length === 0 ? (
            <NoData title="NO CONFIRMED INVOICES" />
          ) : (
            <div className="overflow-x-auto rounded-[2.5rem] border border-gray-50">
              <table className="w-full text-center border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-6 px-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Invoice Date</th>
                    <th className="py-6 px-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Handover Date</th>
                    <th className="py-6 px-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Invoice / Order ID</th>
                    <th className="py-6 px-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer Name</th>
                    <th className="py-6 px-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedInvoices.map((inv) => {
                    const formattedDate = inv.ORDER_DATE
                      ? new Date(inv.ORDER_DATE).toLocaleDateString('en-GB')
                      : (inv.CREATED_AT ? new Date(inv.CREATED_AT).toLocaleDateString('en-GB') : '-');

                    const driverRecord = inv.app_lpos_DRIVERS?.[0];
                    const handoverDateStr = driverRecord?.OFFICE_HANDOVER_TIME;
                    const formattedHandoverDate = handoverDateStr
                      ? new Date(handoverDateStr).toLocaleDateString('en-GB')
                      : '-';

                    return (
                      <tr key={inv.ID} className="group hover:bg-gray-50/50 transition-all duration-200">
                        <td className="py-6 px-6">
                          <span className="text-sm font-bold text-gray-600">{formattedDate}</span>
                        </td>
                        <td className="py-6 px-6">
                          <span className="text-sm font-bold text-gray-600">{formattedHandoverDate}</span>
                        </td>
                        <td className="py-6 px-6">
                          <span className="text-sm font-black text-black">{inv.INVOICE_ID || inv.ORDER_ID || '-'}</span>
                        </td>
                        <td className="py-6 px-6 text-center">
                          <span className="text-sm font-black text-black group-hover:text-[#D4AF37] transition-colors">
                            {inv.app_lpos_CUSTOMERS?.['CUSTOMER NAME'] || 'Unknown Customer'}
                          </span>
                        </td>
                        <td className="py-6 px-6 text-center">
                          <span className="text-sm font-black text-[#D4AF37]">
                            AED {(parseFloat(inv.AMOUNT) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {currentAdmin && (
        <SignatureModal
          isOpen={isSignatureModalOpen}
          onClose={() => setIsSignatureModalOpen(false)}
          currentAdminId={currentAdmin.id}
          currentAdminName={currentAdmin.name}
        />
      )}
    </div>
  );
}
