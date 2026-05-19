'use client';

import { useState, useEffect, useMemo } from 'react';
import { app_lpos_supabase } from '@/lib/supabase';
import {
  Search,
  Eye,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import NoData from '@/components/01-Unified/NoDataTab';
import { usePermissions } from '../hooks/usePermissions';
import OrdersFilterMenu, { FilterCriteria } from './components/OrdersFilterMenu';


export default function OrdersPage() {
  const { canEdit, isLoaded } = usePermissions();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<FilterCriteria>({
    invoiceStatus: 'All',
    driverId: 'All',
    prepStaffName: 'All'
  });
  const [isFiltersLoaded, setIsFiltersLoaded] = useState(false);

  useEffect(() => {
    fetchStaff();
    fetchOrders();
  }, []);

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

  async function fetchStaff() {
    const { data } = await app_lpos_supabase
      .from('bhs_USERS')
      .select('ID, NAME')
      .order('NAME');
    if (data) setStaffList(data);
  }

  async function fetchOrders() {
    try {
      const { data, error } = await app_lpos_supabase
        .from('app_lpos_ORDERS')
        .select(`
          *,
          app_lpos_CUSTOMERS ( "CUSTOMER NAME", "CUSTOMER CITY" ),
          bhs_USERS ( "NAME" ),
          app_lpos_DRIVERS ( 
            ID,
            DRIVERS_NAME, 
            OFFICE_HANDOVER_STATUS,
            TRACKING_NOTES
          ),
          app_lpos_PREPARATION (
            PREPARATION_NAME
          )
        `)
        .order('CREATED_AT', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const processedOrders = useMemo(() => {
    return orders.map(o => {
      const drv = o.app_lpos_DRIVERS?.[0];
      return {
        ...o,
        source: o.ORDER_ID?.startsWith('ONI-') ? 'no-items' : 'standard',
        driver_id: drv?.DRIVERS_NAME,
        handover_status: drv?.OFFICE_HANDOVER_STATUS || 'Not Handed Over',
        tracking_notes: drv?.TRACKING_NOTES || '',
        prep_staff_ids: o.app_lpos_PREPARATION?.map((p: any) => p.PREPARATION_NAME) || []
      };
    }).sort((a, b) => {
      const getNum = (id: string) => parseInt(id.split('-')[1] || '0');
      const numA = getNum(a.ORDER_ID || '');
      const numB = getNum(b.ORDER_ID || '');
      if (numB !== numA) return numB - numA;
      return (a.ORDER_ID || '').localeCompare(b.ORDER_ID || '');
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return processedOrders.filter(order => {
      // 1. Search Filter
      const matchesSearch =
        order.ORDER_ID?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.INVOICE_ID?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.app_lpos_CUSTOMERS?.["CUSTOMER NAME"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.bhs_USERS?.NAME?.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Tab Status Filter
      const matchesStatus = statusFilter === 'All' || order.STATUS === statusFilter;

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
        }
      }

      if (matchesAdvanced && advancedFilters.driverId !== 'All') {
        matchesAdvanced = order.driver_id === advancedFilters.driverId;
      }

      if (matchesAdvanced && advancedFilters.prepStaffName !== 'All') {
        matchesAdvanced = order.prep_staff_ids.includes(advancedFilters.prepStaffName);
      }

      return matchesSearch && matchesStatus && matchesAdvanced;
    });
  }, [processedOrders, searchTerm, statusFilter, advancedFilters]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Order ID, Invoice ID, Customer or Staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
          {['All', 'Approved', 'Pending', 'Partially Approved', 'Rejected'].map((status) => (
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
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse table-fixed">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-[8%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Order ID</th>
                <th className="w-[10%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Order Date</th>
                <th className="w-[10%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">LPO ID</th>
                <th className="w-[10%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Invoice ID</th>
                <th className="w-[12%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Sales Rep</th>
                <th className="w-[22%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer</th>
                <th className="w-[10%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Amount</th>
                <th className="w-[10%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</th>
                <th className="w-[10%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <NoData title="NO ORDERS FOUND" />
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.ID} className="group hover:bg-gray-50/50 transition-all">
                    {/* 1. Order ID */}
                    <td className="px-6 py-6 truncate">
                      <span className="font-black text-black text-sm">{order.ORDER_ID}</span>
                    </td>

                    {/* 2. Date */}
                    <td className="px-6 py-6">
                      <p className="text-sm text-gray-500 font-bold">
                        {new Date(order.ORDER_DATE || order.CREATED_AT).toLocaleDateString('en-GB')}
                      </p>
                    </td>

                    {/* 3. LPO ID */}
                    <td className="px-6 py-6 truncate">
                      <span className="font-bold text-gray-400 text-sm">{order.LPO_ID || '-'}</span>
                    </td>

                    {/* 4. Invoice ID */}
                    <td className="px-6 py-6 truncate">
                      <span className="font-bold text-gray-400 text-sm">{order.INVOICE_ID || '-'}</span>
                    </td>

                    {/* 5. Sales Rep */}
                    <td className="px-6 py-6 overflow-hidden">
                      <div className="flex items-center justify-center">
                        <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-black/10 shrink-0">
                          <span className="text-[10px] font-black text-[#D4AF37]">
                            {order.bhs_USERS?.NAME?.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-gray-700 truncate">{order.bhs_USERS?.NAME}</span>
                      </div>
                    </td>

                    {/* 6. Customer */}
                    <td className="px-6 py-6 overflow-hidden">
                      <div className="flex flex-col items-center">
                        <p className="font-black text-black text-sm whitespace-normal leading-tight" title={order.app_lpos_CUSTOMERS?.["CUSTOMER NAME"]}>
                          {order.app_lpos_CUSTOMERS?.["CUSTOMER NAME"]}
                        </p>
                      </div>
                    </td>

                    {/* 7. Amount */}
                    <td className="px-6 py-6">
                      <span className="font-black text-black text-sm">{order.AMOUNT?.toLocaleString() || '0'} AED</span>
                    </td>

                    {/* 7. Status */}
                    <td className="px-6 py-6">
                      <div className={`inline-flex items-center px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${order.STATUS === 'Approved' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                        order.STATUS === 'Partially Approved' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' :
                          order.STATUS === 'Rejected' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' :
                            'bg-gray-100 text-gray-400'
                        }`}>
                        {order.STATUS || 'Pending'}
                      </div>
                    </td>

                    {/* 7. Action (Icon Only) */}
                    <td className="px-6 py-6">
                      <div className="flex justify-center">
                        <Link
                          href={`/app_lpos_dashboard/orders/${order.ORDER_ID || order.ID}`}
                          className="flex items-center justify-center w-10 h-10 bg-black text-[#D4AF37] rounded-xl hover:bg-gray-900 hover:scale-110 transition-all shadow-lg shadow-black/10"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
