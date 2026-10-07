'use client';

import { useState, useEffect, useMemo } from 'react';
import { bhs_supabas } from '@/lib/supabase';
import { useLpoData } from '../Context/LpoDataContext';
import {
  Search,
  Eye,
  CheckCircle2,
  FileSpreadsheet,
  XCircle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabLoader from '@/app/Components/Loading/TabLoader';
import { toast } from '@/app/Components/Notification';
import { usePermissions } from '../Hooks/usePermissions';
import OrdersFilterMenu, { FilterCriteria } from '../OrderDetails/Components/OrdersFilterMenu';
import { ConfirmModal } from '../Components/ConfirmModal';
import { exportLPOsExcel } from '../Export/ExcelExport';

function canConfirmInvoiceHandover(driver: any, currentUserProfile: any): boolean {
  if (!driver) return false;

  const handoverStatus = driver.OFFICE_HANDOVER_STATUS;
  if (handoverStatus === 'Confirmed' || handoverStatus === 'Rejected') return false;

  const hasHandoverAction =
    Boolean(driver.OFFICE_HANDOVER_ID) || driver.TRACKING_NOTES === 'SYSTEM_CANCELLED';
  if (!hasHandoverAction) return false;

  if (!currentUserProfile?.ID) return false;

  if (driver.TRACKING_NOTES === 'SYSTEM_CANCELLED') {
    return (
      currentUserProfile.CANCEL_AUTHORITY === true ||
      currentUserProfile.CANCEL_AUTHORITY === 'TRUE'
    );
  }

  return String(currentUserProfile.ID) === String(driver.OFFICE_HANDOVER_ID);
}

function resolveCurrentUserProfile(users: any[]) {
  const mainUserStr = localStorage.getItem('currentUser');
  if (!mainUserStr) return null;

  try {
    const parsed = JSON.parse(mainUserStr);
    const name = parsed.name || parsed.NAME;
    if (!name) return null;

    const cleanName = name.trim().toLowerCase();
    const matchedUser = users.find(
      (u: any) => String(u.NAME || '').trim().toLowerCase() === cleanName,
    );
    if (matchedUser) return matchedUser;

    return {
      ID: parsed.id || parsed.ID || 'R-0001',
      NAME: name,
      ROLE: parsed.role || 'user',
    };
  } catch (error) {
    console.error('Error resolving current user:', error);
    return null;
  }
}


export default function OrdersPage() {
  const { canEdit } = usePermissions();
  const { orders, users, loading, refresh } = useLpoData();
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const staffList = users;
  const [advancedFilters, setAdvancedFilters] = useState<FilterCriteria>({
    invoiceStatus: 'All',
    driverId: 'All'
  });
  const [isFiltersLoaded, setIsFiltersLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkConfirmModalOpen, setIsBulkConfirmModalOpen] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Clear selected checkbox state when filters, pagination, or search change
  useEffect(() => {
    setSelectedOrderIds([]);
  }, [searchTerm, statusFilter, advancedFilters, currentPage]);

  useEffect(() => {
    setCurrentUserProfile(resolveCurrentUserProfile(users));
  }, [users]);

  // Load saved filters from sessionStorage on mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSearch = sessionStorage.getItem('orders_searchTerm');
      if (savedSearch !== null) setSearchTerm(savedSearch);

      const savedStatus = sessionStorage.getItem('orders_statusFilter');
      if (savedStatus !== null) setStatusFilter(savedStatus);

      const savedAdvanced = sessionStorage.getItem('orders_advancedFilters');
      if (savedAdvanced !== null) {
        try {
          setAdvancedFilters(JSON.parse(savedAdvanced));
        } catch (e) {
          console.error('Error parsing stored advanced filters:', e);
        }
      }
      setIsFiltersLoaded(true);
    }
  }, []);

  // Save filters to sessionStorage ONLY after they have been loaded on mount
  useEffect(() => {
    if (isFiltersLoaded) {
      sessionStorage.setItem('orders_searchTerm', searchTerm);
    }
  }, [searchTerm, isFiltersLoaded]);

  useEffect(() => {
    if (isFiltersLoaded) {
      sessionStorage.setItem('orders_statusFilter', statusFilter);
    }
  }, [statusFilter, isFiltersLoaded]);

  useEffect(() => {
    if (isFiltersLoaded) {
      sessionStorage.setItem('orders_advancedFilters', JSON.stringify(advancedFilters));
    }
  }, [advancedFilters, isFiltersLoaded]);

  // Reset pagination to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, advancedFilters]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    const order = processedOrders.find((o) => o.ID === orderId);
    if (!order) return;
    const driverData = order.app_lpos_DRIVERS?.[0];
    if (!driverData) return;

    const userProfile = currentUserProfile || resolveCurrentUserProfile(users);
    if (!userProfile?.ID) {
      toast.error('Could not resolve the current user profile.');
      return;
    }

    setUpdatingOrderId(order.ID);
    try {
      const isRegularHandover = Boolean(driverData.OFFICE_HANDOVER_ID) || driverData.TRACKING_NOTES === 'SYSTEM_CANCELLED';
      const isBypassNote = driverData.TRACKING_NOTES === 'SYSTEM_ALREADY_RECEIVED' ||
        driverData.TRACKING_NOTES === 'SYSTEM_CANCELLED';

      let updatePayload: any = {};

      if (isRegularHandover) {
        updatePayload = {
          OFFICE_HANDOVER_STATUS: newStatus,
          OFFICE_HANDOVER_TIME: new Date().toISOString()
        };

        if (newStatus === 'Confirmed') {
          updatePayload.OFFICE_HANDOVER_ID = userProfile.ID || 'R-0001';
        }

        if (newStatus === 'Rejected') {
          if (isBypassNote) {
            updatePayload = {
              STATUS: 'Assigned',
              DELIVERY_TIME: null,
              IS_CUSTOMER_SIGNED: false,
              OFFICE_HANDOVER_ID: null,
              OFFICE_HANDOVER_STATUS: null,
              OFFICE_HANDOVER_TIME: null,
              TRACKING_NOTES: null
            };
          } else {
            updatePayload = {
              STATUS: 'Delivered',
              IS_CUSTOMER_SIGNED: false,
              OFFICE_HANDOVER_ID: null,
              OFFICE_HANDOVER_STATUS: null,
              OFFICE_HANDOVER_TIME: null,
              TRACKING_NOTES: null
            };
          }
        }
      } else {
        if (newStatus === 'Confirmed') {
          updatePayload = {
            STATUS: 'Delivered',
            DELIVERY_TIME: new Date().toISOString(),
            IS_CUSTOMER_SIGNED: true,
            OFFICE_HANDOVER_ID: userProfile.ID || 'R-0001',
            OFFICE_HANDOVER_STATUS: 'Confirmed',
            OFFICE_HANDOVER_TIME: new Date().toISOString(),
            TRACKING_NOTES: 'DIRECT_OFFICE_RECEIPT'
          };
        } else if (newStatus === 'Rejected') {
          updatePayload = {
            STATUS: 'Delivered',
            DELIVERY_TIME: new Date().toISOString(),
            IS_CUSTOMER_SIGNED: false,
            OFFICE_HANDOVER_ID: userProfile.ID || 'R-0001',
            OFFICE_HANDOVER_STATUS: 'Confirmed',
            OFFICE_HANDOVER_TIME: new Date().toISOString(),
            TRACKING_NOTES: 'SYSTEM_CANCELLED'
          };
        }
      }

      const { error } = await bhs_supabas
        .from('app_lpos_DRIVERS')
        .update(updatePayload)
        .eq('ID', driverData.ID);

      if (error) throw error;
      toast.success(newStatus === 'Confirmed' ? 'Invoice confirmed successfully.' : 'Invoice rejected.');
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleBulkConfirmReceipt = async () => {
    if (selectedOrderIds.length === 0) return;

    const userProfile = currentUserProfile || resolveCurrentUserProfile(users);
    if (!userProfile?.ID) {
      toast.error('Could not resolve the current user profile.');
      return;
    }

    setIsBulkSaving(true);
    try {
      const confirmableOrders = selectedOrderIds
        .map((orderId) => processedOrders.find((order) => order.ID === orderId))
        .filter((order): order is NonNullable<typeof order> => Boolean(order))
        .filter((order) => canConfirmInvoiceHandover(order.app_lpos_DRIVERS?.[0], userProfile));

      if (confirmableOrders.length === 0) {
        toast.error('None of the selected invoices can be confirmed by you.');
        return;
      }

      const now = new Date().toISOString();
      const updates = confirmableOrders.map((order) => {
        const driver = order.app_lpos_DRIVERS[0];
        return bhs_supabas
          .from('app_lpos_DRIVERS')
          .update({
            OFFICE_HANDOVER_STATUS: 'Confirmed',
            OFFICE_HANDOVER_TIME: now,
            OFFICE_HANDOVER_ID: userProfile.ID || 'R-0001',
          })
          .eq('ID', driver.ID);
      });

      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      const skippedCount = selectedOrderIds.length - confirmableOrders.length;
      if (skippedCount > 0) {
        toast.success(
          `Confirmed ${confirmableOrders.length} invoice(s). Skipped ${skippedCount} not eligible for your account.`,
        );
      } else {
        toast.success(`Confirmed ${confirmableOrders.length} invoice(s).`);
      }

      await refresh();
      setSelectedOrderIds([]);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to confirm selected invoices.');
    } finally {
      setIsBulkSaving(false);
      setIsBulkConfirmModalOpen(false);
    }
  };

  const processedOrders = useMemo(() => {
    return orders.map(o => {
      const drv = o.app_lpos_DRIVERS?.[0];
      const driverUserId = drv?.DRIVERS_NAME;
      return {
        ...o,
        source: 'standard',
        driver_id: driverUserId,
        driver_name: staffList.find(s => s.ID === driverUserId)?.NAME || '',
        handover_status: drv?.OFFICE_HANDOVER_STATUS || 'Not Handed Over',
        tracking_notes: drv?.TRACKING_NOTES || '',
        driver_status: drv?.STATUS || ''
      };
    }).sort((a, b) => {
      const dateA = new Date(a.ORDER_DATE || a.CREATED_AT || 0).getTime();
      const dateB = new Date(b.ORDER_DATE || b.CREATED_AT || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;

      return (b.INVOICE_ID || '').localeCompare(a.INVOICE_ID || '', undefined, { numeric: true });
    });
  }, [orders, staffList]);

  const selectedConfirmableCount = useMemo(() => {
    return selectedOrderIds.filter((orderId) => {
      const order = processedOrders.find((item) => item.ID === orderId);
      return canConfirmInvoiceHandover(order?.app_lpos_DRIVERS?.[0], currentUserProfile);
    }).length;
  }, [selectedOrderIds, processedOrders, currentUserProfile]);

  const filteredOrders = useMemo(() => {
    return processedOrders.filter(order => {
      // 1. Search Filter
      const matchesSearch =
        order.ORDER_ID?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.INVOICE_ID?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.LPO_ID?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.bhs_CUSTOMERS?.["CUSTOMER NAME"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.driver_name?.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Tab Status Filter
      let matchesStatus = true;
      if (statusFilter !== 'All') {
        const isCancelled = order.tracking_notes === 'SYSTEM_CANCELLED';
        const isDelivered = order.driver_status === 'Delivered' && !isCancelled;
        const isPending = order.driver_status !== 'Delivered' && !isCancelled;

        if (statusFilter === 'Cancelled') matchesStatus = isCancelled;
        else if (statusFilter === 'Received') matchesStatus = isDelivered;
        else if (statusFilter === 'Pending') matchesStatus = isPending;
      }

      // 3. Advanced Filters
      let matchesAdvanced = true;

      if (advancedFilters.invoiceStatus !== 'All') {
        const status = order.handover_status;
        const notes = order.tracking_notes;
        if (advancedFilters.invoiceStatus === 'Handed Over') {
          matchesAdvanced = (status === 'Handed Over' || status === 'Pending Confirmation' || status === 'Pending') &&
            notes !== 'SYSTEM_ALREADY_RECEIVED' &&
            notes !== 'SYSTEM_CANCELLED';
        } else if (advancedFilters.invoiceStatus === 'Confirmed') {
          matchesAdvanced = status === 'Confirmed' &&
            notes !== 'SYSTEM_ALREADY_RECEIVED' &&
            notes !== 'SYSTEM_CANCELLED';
        } else if (advancedFilters.invoiceStatus === 'Pending') {
          matchesAdvanced = (!status || status === 'Not Handed Over' || status === 'Pending Handover') &&
            notes !== 'SYSTEM_ALREADY_RECEIVED' &&
            notes !== 'SYSTEM_CANCELLED';
        } else if (advancedFilters.invoiceStatus === 'Returned') {
          matchesAdvanced = notes === 'SYSTEM_CANCELLED';
        } else if (advancedFilters.invoiceStatus === 'ReturnedUnconfirmed') {
          matchesAdvanced = notes === 'SYSTEM_CANCELLED' && status !== 'Confirmed';
        }
      }

      if (matchesAdvanced && advancedFilters.driverId !== 'All') {
        matchesAdvanced = order.driver_id === advancedFilters.driverId;
      }

      return matchesSearch && matchesStatus && matchesAdvanced;
    });
  }, [processedOrders, searchTerm, statusFilter, advancedFilters]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  }, [filteredOrders]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const exportToExcel = async () => {
    const dataToExport = filteredOrders.map(order => ({
      "Order ID": order.ORDER_ID,
      "Order Date": order.ORDER_DATE ? new Date(order.ORDER_DATE).toLocaleDateString('en-GB') : new Date(order.CREATED_AT).toLocaleDateString('en-GB'),
      "LPO ID": order.LPO_ID || '',
      "Invoice ID": order.INVOICE_ID || '',
      "Driver": order.driver_name || '',
      "Customer Name": order.bhs_CUSTOMERS?.["CUSTOMER NAME"] || '',
      "Customer City": order.bhs_CUSTOMERS?.["CUSTOMER CITY"] || '',
      "Amount": order.AMOUNT || 0,
      "Status": order.STATUS || 'Pending',
      "Handover Status": order.handover_status || 'Not Handed Over',
      "Tracking Notes": order.tracking_notes || ''
    }));

    await exportLPOsExcel(
      dataToExport,
      `Orders_Export_${new Date().toISOString().split('T')[0]}`,
      {
        sheetName: 'Orders',
        numericColumns: ['Amount'],
      }
    );
  };

  if (loading) {
    return <TabLoader />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-normal text-black tracking-tighter">Orders</h1>
          <div className="flex items-center gap-3">
            <OrdersFilterMenu
              activeFilters={advancedFilters}
              onFilterChange={setAdvancedFilters}
              staffList={staffList}
            />
            <div className="px-4 py-2 bg-[#D4AF37]/10 text-black border border-[#D4AF37]/20 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-[#D4AF37] rounded-full animate-pulse" />
              {filteredOrders.length} {filteredOrders.length === 1 ? 'Order' : 'Orders'}
            </div>
            <button
              onClick={exportToExcel}
              className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 hover:text-black hover:border-black hover:bg-gray-50 transition-all shadow-sm group"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {selectedOrderIds.length > 0 && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-[1.25rem] p-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="text-xs font-black text-gray-500 uppercase tracking-wider px-3">
              {selectedOrderIds.length} Selected
              {selectedConfirmableCount > 0 && selectedConfirmableCount !== selectedOrderIds.length
                ? ` · ${selectedConfirmableCount} confirmable`
                : ''}
            </span>
            {canEdit && (
              <button
                onClick={() => setIsBulkConfirmModalOpen(true)}
                disabled={selectedConfirmableCount === 0}
                className="w-10 h-10 flex items-center justify-center bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all shadow-md shadow-emerald-500/10 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
                title="Confirm Office Receipt"
              >
                <CheckCircle2 className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Order ID, Invoice ID, LPO ID, Customer or Driver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
          {['All', 'Received', 'Pending', 'Cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-6 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap uppercase tracking-wider ${statusFilter === status
                ? 'bg-black text-[#D4AF37] shadow-lg shadow-black/10'
                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      {paginatedOrders.length === 0 ? (
        <NoData title="NO ORDERS FOUND" />
      ) : (
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse min-w-[1100px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-6 w-[60px] text-center">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-[#D4AF37] rounded-lg border-gray-300 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    checked={paginatedOrders.every(o => selectedOrderIds.includes(o.ID))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const pageIds = paginatedOrders.map(o => o.ID);
                        setSelectedOrderIds(prev => Array.from(new Set([...prev, ...pageIds])));
                      } else {
                        const pageIds = paginatedOrders.map(o => o.ID);
                        setSelectedOrderIds(prev => prev.filter(id => !pageIds.includes(id)));
                      }
                    }}
                  />
                </th>
                <th className="px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] min-w-[120px]">Order Date</th>
                <th className="px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] min-w-[140px]">LPO ID</th>
                <th className="px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] min-w-[140px]">Invoice ID</th>
                <th className="px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] min-w-[120px]">Driver</th>
                <th className="px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] min-w-[250px] w-[30%]">Customer</th>
                <th className="px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] min-w-[120px]">Amount</th>
                <th className="px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] min-w-[70px]">Status</th>
                <th className="px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] min-w-[180px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
                {paginatedOrders.map((order) => (
                  <tr key={order.ID} className="group hover:bg-gray-50/50 transition-all">
                    {/* Checkbox */}
                    <td className="px-6 py-6 text-center whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-[#D4AF37] rounded-lg border-gray-300 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        checked={selectedOrderIds.includes(order.ID)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrderIds(prev => [...prev, order.ID]);
                          } else {
                            setSelectedOrderIds(prev => prev.filter(id => id !== order.ID));
                          }
                        }}
                      />
                    </td>
                    {/* Date */}
                    <td className="px-6 py-6 whitespace-nowrap">
                      <p className="text-sm text-gray-500 font-bold">
                        {new Date(order.ORDER_DATE || order.CREATED_AT).toLocaleDateString('en-GB')}
                      </p>
                    </td>

                    {/* 3. LPO ID */}
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className="font-bold text-gray-400 text-sm">{order.LPO_ID || '-'}</span>
                    </td>

                    {/* 4. Invoice ID */}
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className="font-bold text-gray-400 text-sm">{order.INVOICE_ID || '-'}</span>
                    </td>

                    {/* 5. Driver */}
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className="text-sm font-bold text-gray-700">{order.driver_name || '-'}</span>
                    </td>

                    {/* 6. Customer */}
                    <td className="px-6 py-6">
                      <div className="flex flex-col items-center">
                        <p className="font-black text-black text-sm whitespace-normal leading-tight break-words text-center" title={order.bhs_CUSTOMERS?.["CUSTOMER NAME"]}>
                          {order.bhs_CUSTOMERS?.["CUSTOMER NAME"]}
                        </p>
                      </div>
                    </td>

                    {/* 7. Amount */}
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className="font-black text-black text-sm">{order.AMOUNT?.toLocaleString() || '0'} AED</span>
                    </td>

                    {/* 8. Status */}
                    <td className="px-6 py-6 whitespace-nowrap">
                      {(() => {
                        const isCancelled = order.tracking_notes === 'SYSTEM_CANCELLED';
                        const isDelivered = order.driver_status === 'Delivered' && !isCancelled;
                        const isPending = order.driver_status !== 'Delivered' && !isCancelled;

                        const isConfirmed = order.handover_status === 'Confirmed';

                        return (
                          <div className={`inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider ${isCancelled ? 'bg-red-50 text-red-600' :
                            isDelivered ? 'bg-emerald-50 text-emerald-600' :
                              'bg-orange-50 text-orange-600'
                            }`}>
                            {isCancelled 
                                ? (isConfirmed ? 'Cancelled' : 'Ask to Cancel') 
                                : isDelivered 
                                    ? (isConfirmed ? 'Delivered' : 'Ask to Deliver') 
                                    : order.driver_status || 'Pending'}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/LPOs/OrderDetails?id=${order.ORDER_ID || order.ID}`}
                          className="flex items-center justify-center w-10 h-10 bg-black text-[#D4AF37] rounded-xl hover:bg-gray-900 hover:scale-110 transition-all shadow-lg shadow-black/10"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                        {order.app_lpos_DRIVERS?.[0] && !['Confirmed', 'Rejected'].includes(order.app_lpos_DRIVERS[0].OFFICE_HANDOVER_STATUS) && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(order.ID, 'Confirmed')}
                              disabled={updatingOrderId === order.ID}
                              className="flex items-center justify-center w-10 h-10 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 hover:scale-110 transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                              title="Confirm Receipt"
                            >
                              {updatingOrderId === order.ID ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(order.ID, 'Rejected')}
                              disabled={updatingOrderId === order.ID}
                              className="flex items-center justify-center w-10 h-10 bg-white border border-red-100 text-red-500 rounded-xl hover:bg-red-50 hover:scale-110 transition-all shadow-sm disabled:opacity-50"
                              title="Reject Receipt"
                            >
                              {updatingOrderId === order.ID ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-t border-gray-100 bg-gray-50/50">
            <div className="text-xs font-bold text-gray-500">
              Showing <span className="text-black font-black">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="text-black font-black">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)}
              </span>{' '}
              of <span className="text-black font-black">{filteredOrders.length}</span> orders
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-gray-100 hover:bg-gray-50 text-xs font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-black shadow-sm"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    );
                  })
                  .map((page, index, array) => {
                    const showDots = index > 0 && page - array[index - 1] > 1;
                    return (
                      <div key={page} className="flex items-center gap-1">
                        {showDots && <span className="px-1 text-gray-400 text-xs font-bold">...</span>}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${currentPage === page
                            ? 'bg-black text-[#D4AF37] shadow-lg shadow-black/10'
                            : 'bg-white hover:bg-gray-50 text-gray-500 border border-gray-100 shadow-sm'
                            }`}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-gray-100 hover:bg-gray-50 text-xs font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-black shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      <ConfirmModal
        isOpen={isBulkConfirmModalOpen}
        onConfirm={handleBulkConfirmReceipt}
        onCancel={() => setIsBulkConfirmModalOpen(false)}
        isLoading={isBulkSaving}
        title="Confirm Office Receipt"
        message={`Confirm office receipt for ${selectedConfirmableCount} of ${selectedOrderIds.length} selected invoice(s)? This uses the same confirmation as Invoices Status.`}
      />
    </div>
  );
}
