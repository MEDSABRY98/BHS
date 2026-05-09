'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import { 
  Search, 
  Eye, 
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import NoData from '@/components/01-Unified/NoDataTab';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      const { data, error } = await app_lpos_supabase
        .from('app_lpos_ORDERS')
        .select(`
          *,
          app_lpos_CUSTOMERS ( "CUSTOMER NAME", "CUSTOMER CITY" ),
          app_lpos_USERS ( "NAME" )
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

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.ORDER_ID?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.app_lpos_CUSTOMERS?.["CUSTOMER NAME"]?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || order.STATUS === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">Orders</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by Order ID or Customer..." 
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
              className={`px-6 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap uppercase tracking-wider ${
                statusFilter === status 
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
                <th className="w-[15%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Order ID</th>
                <th className="w-[15%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Date</th>
                <th className="w-[20%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Sales Rep</th>
                <th className="w-[25%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer</th>
                <th className="w-[15%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</th>
                <th className="w-[10%] px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6}>
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
                        {new Date(order.CREATED_AT).toLocaleDateString('en-GB')}
                      </p>
                    </td>

                    {/* 3. Sales Rep */}
                    <td className="px-6 py-6 overflow-hidden">
                      <div className="flex items-center justify-center">
                        <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-black/10 shrink-0">
                          <span className="text-[10px] font-black text-[#D4AF37]">
                            {order.app_lpos_USERS?.NAME?.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-gray-700 truncate">{order.app_lpos_USERS?.NAME}</span>
                      </div>
                    </td>

                    {/* 4. Customer */}
                    <td className="px-6 py-6 overflow-hidden">
                      <div className="flex flex-col items-center">
                        <p className="font-black text-black text-sm truncate w-full" title={order.app_lpos_CUSTOMERS?.["CUSTOMER NAME"]}>
                          {order.app_lpos_CUSTOMERS?.["CUSTOMER NAME"]}
                        </p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1 truncate w-full">
                          {order.app_lpos_CUSTOMERS?.["CUSTOMER CITY"]}
                        </p>
                      </div>
                    </td>
                    
                    {/* 5. Status */}
                    <td className="px-6 py-6">
                      <div className={`inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                        order.STATUS === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                        order.STATUS === 'Partially Approved' ? 'bg-orange-50 text-orange-600' :
                        order.STATUS === 'Pending' ? 'bg-blue-50 text-blue-600' :
                        'bg-red-50 text-red-600'
                      }`}>
                        {order.STATUS}
                      </div>
                    </td>

                    {/* 6. Action (Icon Only) */}
                    <td className="px-6 py-6">
                      <div className="flex justify-center">
                        <Link 
                          href={`/app_lpos_dashboard/orders/${order.ID}`}
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
