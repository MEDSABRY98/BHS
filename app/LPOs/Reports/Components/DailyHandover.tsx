'use client';

import { useState, useEffect, useMemo } from 'react';
import { app_lpos_supabase } from '@/lib/supabase';
import SearchSelect from '../../Components/DropDownList';
import { FileText, Loader2, Download, Printer, AlertCircle } from 'lucide-react';
import { generateDailyHandoverPDF } from '@/lib/pdf/DailyHandoverPdf';
import NoData from '@/components/01-Unified/NoDataTab';

interface HandoverGroup {
  key: string;
  driverId: string;
  driverName: string;
  handoverDate: string;
  invoices: any[];
  totalAmount: number;
}

export default function HandoverReports() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [allConfirmedOrders, setAllConfirmedOrders] = useState<any[]>([]);
  const [isDriversLoading, setIsDriversLoading] = useState(true);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
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
    fetchDrivers();
    fetchConfirmedOrders();
  }, []);

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

  async function fetchConfirmedOrders() {
    setIsOrdersLoading(true);
    try {
      const { data, error } = await app_lpos_supabase
        .from('app_lpos_ORDERS')
        .select(`
          *,
          bhs_CUSTOMERS ( "CUSTOMER NAME":"CUSTOMER SUB NAME" ),
          app_lpos_DRIVERS!inner (
            DRIVERS_NAME,
            STATUS,
            OFFICE_HANDOVER_STATUS,
            OFFICE_HANDOVER_TIME,
            DELIVERY_TIME
          )
        `)
        .eq('app_lpos_DRIVERS.OFFICE_HANDOVER_STATUS', 'Confirmed');

      if (error) throw error;
      setAllConfirmedOrders(data || []);
    } catch (err) {
      console.error('Error fetching confirmed handover orders:', err);
    } finally {
      setIsOrdersLoading(false);
    }
  }

  // Group confirmed orders by driver and handover date
  const groupedHandovers = useMemo(() => {
    const groupsMap: { [key: string]: HandoverGroup } = {};

    allConfirmedOrders.forEach((order: any) => {
      const driverRecord = order.app_lpos_DRIVERS?.[0];
      if (!driverRecord || driverRecord.OFFICE_HANDOVER_STATUS !== 'Confirmed' || !driverRecord.OFFICE_HANDOVER_TIME) {
        return;
      }
      const driverId = driverRecord.DRIVERS_NAME;
      const handoverTime = driverRecord.OFFICE_HANDOVER_TIME;
      const handoverDate = handoverTime.includes('T') ? handoverTime.split('T')[0] : handoverTime;

      const key = `${driverId}_${handoverDate}`;

      if (!groupsMap[key]) {
        const drv = drivers.find(d => d.ID === driverId);
        const driverName = drv ? drv.NAME : 'Unknown Driver';

        groupsMap[key] = {
          key,
          driverId,
          driverName,
          handoverDate,
          invoices: [],
          totalAmount: 0
        };
      }

      groupsMap[key].invoices.push(order);
      groupsMap[key].totalAmount += parseFloat(order.AMOUNT) || 0;
    });

    // Convert map to array and sort:
    // 1st: by Date descending (newest first)
    // 2nd: by Driver Name alphabetically
    return Object.values(groupsMap).sort((a, b) => {
      if (a.handoverDate !== b.handoverDate) {
        return b.handoverDate.localeCompare(a.handoverDate);
      }
      return a.driverName.localeCompare(b.driverName);
    });
  }, [allConfirmedOrders, drivers]);

  // Apply filters on grouped handovers
  const filteredHandovers = useMemo(() => {
    return groupedHandovers.filter(group => {
      // Driver filter
      if (selectedDriverId && group.driverId !== selectedDriverId) {
        return false;
      }

      // Date range filters
      if (fromDate && group.handoverDate < fromDate) return false;
      if (toDate && group.handoverDate > toDate) return false;

      return true;
    });
  }, [groupedHandovers, selectedDriverId, fromDate, toDate]);

  // Totals of currently filtered groups
  const grandTotalAmount = useMemo(() => {
    return filteredHandovers.reduce((sum, g) => sum + g.totalAmount, 0);
  }, [filteredHandovers]);

  const grandTotalInvoices = useMemo(() => {
    return filteredHandovers.reduce((sum, g) => sum + g.invoices.length, 0);
  }, [filteredHandovers]);

  const handlePdfAction = async (group: HandoverGroup, action: 'download' | 'print') => {
    setIsGeneratingPdf(true);
    try {
      // Fetch driver signature from database
      let driverSignature = '';
      const { data: driverData, error: driverErr } = await app_lpos_supabase
        .from('bhs_USERS')
        .select('SIGNATURE')
        .eq('ID', group.driverId)
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

      // Sort invoices of the group by invoice date, then invoice id for consistency
      const sortedInvoices = [...group.invoices].sort((a, b) => {
        const dateA = a.ORDER_DATE ? new Date(a.ORDER_DATE).getTime() : (a.CREATED_AT ? new Date(a.CREATED_AT).getTime() : 0);
        const dateB = b.ORDER_DATE ? new Date(b.ORDER_DATE).getTime() : (b.CREATED_AT ? new Date(b.CREATED_AT).getTime() : 0);
        if (dateA !== dateB) return dateA - dateB;
        const invA = a.INVOICE_ID || a.ORDER_ID || '';
        const invB = b.INVOICE_ID || b.ORDER_ID || '';
        return invA.localeCompare(invB);
      });

      await generateDailyHandoverPDF(
        group.driverName,
        group.handoverDate,
        sortedInvoices,
        action,
        driverSignature,
        adminSignature
      );
    } catch (err) {
      console.error('PDF Handover generation failed:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Search & Filters card */}
      <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-end gap-6">

          {/* Driver Select Filter */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between ml-1 mb-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block">
                Select Driver
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
              options={drivers.map(d => ({ id: d.ID, label: d.NAME }))}
              value={selectedDriverId}
              onChange={setSelectedDriverId}
              isLoading={isDriversLoading}
              heightClass="h-[56px]"
            />
          </div>



          {/* From Date Filter */}
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

          {/* To Date Filter */}
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

      {/* Handover List Section */}
      <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xl font-normal text-black tracking-tight flex items-center gap-3">
              <FileText className="w-5 h-5 text-[#D4AF37]" />
              Daily Confirmed Handovers
            </h2>
          </div>

          {filteredHandovers.length > 0 && (
            <div className="flex items-center gap-6">
              <div className="text-center md:text-right">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Value</span>
                <p className="text-2xl font-black text-[#D4AF37]">
                  AED {grandTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="px-5 py-3 bg-gray-50 text-black border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                {grandTotalInvoices} Invoices
              </div>
            </div>
          )}
        </div>

        {isOrdersLoading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading Handover Records...</p>
          </div>
        ) : filteredHandovers.length === 0 ? (
          <NoData title="NO HANDOVER RECORDS FOUND" />
        ) : (
          <div className="overflow-x-auto rounded-[2.5rem] border border-gray-50">
            <table className="w-full text-center border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-6 px-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Handover Date</th>
                  <th className="py-6 px-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Driver Name</th>
                  <th className="py-6 px-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Invoices</th>
                  <th className="py-6 px-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Value</th>
                  <th className="py-6 px-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">PDF Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredHandovers.map((group) => {
                  const formattedDate = group.handoverDate
                    ? new Date(group.handoverDate).toLocaleDateString('en-GB')
                    : '-';

                  return (
                    <tr key={group.key} className="group hover:bg-gray-50/50 transition-all duration-200">
                      <td className="py-6 px-6">
                        <span className="text-sm font-bold text-gray-600">{formattedDate}</span>
                      </td>
                      <td className="py-6 px-6">
                        <span className="text-sm font-black text-black">{group.driverName}</span>
                      </td>
                      <td className="py-6 px-6 text-center">
                        <span className="text-sm font-bold text-gray-600">{group.invoices.length}</span>
                      </td>
                      <td className="py-6 px-6 text-center">
                        <span className="text-sm font-black text-[#D4AF37]">
                          AED {group.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-6 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            disabled={isGeneratingPdf}
                            onClick={() => handlePdfAction(group, 'print')}
                            title="Print Report"
                            className="p-2.5 bg-gray-50 border border-gray-100 hover:border-black hover:bg-gray-100 text-black rounded-xl transition-all inline-flex items-center justify-center cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            disabled={isGeneratingPdf}
                            onClick={() => handlePdfAction(group, 'download')}
                            title="Download Report"
                            className="p-2.5 bg-gray-50 border border-gray-100 hover:border-black hover:bg-gray-100 text-black rounded-xl transition-all inline-flex items-center justify-center cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
