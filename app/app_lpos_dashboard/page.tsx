'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Users,
  ArrowUpRight,
  Activity,
  Calendar,
  ChevronRight,
  User,
  AlertCircle,
  XCircle,
  Package,
  Trophy,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import NoData from '@/components/01-Unified/NoDataTab';

interface Stats {
  total: number;
  approved: number;
  partiallyApproved: number;
  pending: number;
  rejected: number;
}

interface UserPerformance {
  id: string;
  name: string;
  total: number;
  approved: number;
  partiallyApproved: number;
  rejected: number;
  pending: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, approved: 0, partiallyApproved: 0, pending: 0, rejected: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [userPerformance, setUserPerformance] = useState<UserPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const [
        totalRes,
        approvedRes,
        partialRes,
        pendingRes,
        rejectedRes,
        allOrdersRes,
        allUsersRes
      ] = await Promise.all([
        app_lpos_supabase.from('app_lpos_ORDERS').select('*', { count: 'exact', head: true }),
        app_lpos_supabase.from('app_lpos_ORDERS').select('*', { count: 'exact', head: true }).eq('STATUS', 'Approved'),
        app_lpos_supabase.from('app_lpos_ORDERS').select('*', { count: 'exact', head: true }).eq('STATUS', 'Partially Approved'),
        app_lpos_supabase.from('app_lpos_ORDERS').select('*', { count: 'exact', head: true }).eq('STATUS', 'Pending'),
        app_lpos_supabase.from('app_lpos_ORDERS').select('*', { count: 'exact', head: true }).eq('STATUS', 'Rejected'),
        app_lpos_supabase.from('app_lpos_ORDERS')
          .select(`
            *,
            app_lpos_CUSTOMERS ( "CUSTOMER NAME" ),
            app_lpos_USERS ( "NAME" )
          `)
          .order('CREATED_AT', { ascending: false }),
        app_lpos_supabase.from('app_lpos_USERS').select('*')
      ]);

      setStats({
        total: totalRes.count || 0,
        approved: approvedRes.count || 0,
        partiallyApproved: partialRes.count || 0,
        pending: pendingRes.count || 0,
        rejected: rejectedRes.count || 0,
      });

      setRecentOrders((allOrdersRes.data || []).slice(0, 10));

      const users = allUsersRes.data || [];
      const orders = allOrdersRes.data || [];

      const performanceMap: Record<string, UserPerformance> = users.reduce((acc: any, user: any) => {
        acc[user.ID] = {
          id: user.ID,
          name: user.NAME,
          total: 0,
          approved: 0,
          partiallyApproved: 0,
          rejected: 0,
          pending: 0
        };
        return acc;
      }, {});

      orders.forEach((order: any) => {
        const userId = order.CREATED_BY;
        if (performanceMap[userId]) {
          performanceMap[userId].total++;
          if (order.STATUS === 'Approved') performanceMap[userId].approved++;
          else if (order.STATUS === 'Partially Approved') performanceMap[userId].partiallyApproved++;
          else if (order.STATUS === 'Rejected') performanceMap[userId].rejected++;
          else if (order.STATUS === 'Pending') performanceMap[userId].pending++;
        }
      });

      const performanceArray = Object.values(performanceMap)
        .filter(u => u.total > 0)
        .sort((a, b) => b.total - a.total) as UserPerformance[];

      setUserPerformance(performanceArray);

    } catch (err) {
      console.error('Dashboard Data Fetch Error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">Dashboard</h1>
        </div>
        <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
          <Calendar className="w-5 h-5 text-[#D4AF37]" />
          <span className="text-sm font-bold text-gray-700">{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Total LPO's"
          value={stats.total.toString()}
          icon={Package}
          color="bg-black"
          subtitle="All Time Volume"
        />
        <StatCard
          title="Approved LPOs"
          value={stats.approved.toString()}
          icon={CheckCircle2}
          color="bg-emerald-500"
          subtitle="Finalized Orders"
        />
        <StatCard
          title="Partial Approval"
          value={stats.partiallyApproved.toString()}
          icon={AlertCircle}
          color="bg-orange-500"
          subtitle="Incomplete Orders"
        />
        <StatCard
          title="Pending LPOs"
          value={stats.pending.toString()}
          icon={Clock}
          color="bg-blue-500"
          subtitle="Waiting for Review"
        />
        <StatCard
          title="Rejected LPOs"
          value={stats.rejected.toString()}
          icon={XCircle}
          color="bg-red-500"
          subtitle="Cancelled/Invalid"
        />
      </div>

      {/* Staff Performance Table */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-black text-black flex items-center gap-3">
            <Trophy className="w-6 h-6 text-[#D4AF37]" />
            Staff Performance
          </h3>
          <Activity className="w-6 h-6 text-gray-200" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-center">
                <th className="pb-5 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-left">Sales Representative</th>
                <th className="pb-5 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total LPOs</th>
                <th className="pb-5 px-4 text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Approved</th>
                <th className="pb-5 px-4 text-[10px] font-black text-orange-500 uppercase tracking-[0.2em]">Partial</th>
                <th className="pb-5 px-4 text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Rejected</th>
                <th className="pb-5 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pending</th>
                <th className="pb-5 px-4 text-[10px] font-black text-black uppercase tracking-[0.2em]">Success Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {userPerformance.map((u) => {
                const successRate = u.total > 0 ? Math.round((u.approved / u.total) * 100) : 0;
                return (
                  <tr key={u.id} className="group hover:bg-gray-50/50 transition-all text-center">
                    <td className="py-6 px-4 text-left">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center text-xs text-[#D4AF37] font-black shadow-lg shadow-black/10">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-black">{u.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{u.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-6 px-4">
                      <span className="text-lg font-black text-black">{u.total}</span>
                    </td>
                    <td className="py-6 px-4">
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-sm">{u.approved}</span>
                    </td>
                    <td className="py-6 px-4">
                      <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-lg font-black text-sm">{u.partiallyApproved}</span>
                    </td>
                    <td className="py-6 px-4">
                      <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg font-black text-sm">{u.rejected}</span>
                    </td>
                    <td className="py-6 px-4">
                      <span className="px-3 py-1 bg-gray-100 text-gray-400 rounded-lg font-black text-sm">{u.pending}</span>
                    </td>
                    <td className="py-6 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#D4AF37]"
                            style={{ width: `${successRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-black text-black w-10">{successRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-black text-black flex items-center gap-3">
            <Activity className="w-6 h-6 text-[#D4AF37]" />
            Recent Activity
          </h3>
          <Link href="/app_lpos_dashboard/orders" className="bg-black text-white px-5 py-2.5 rounded-2xl text-xs font-black hover:bg-gray-800 transition-all flex items-center gap-2">
            VIEW ALL ORDERS <ChevronRight className="w-4 h-4 text-[#D4AF37]" />
          </Link>
        </div>

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
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <NoData title="NO RECENT ACTIVITY FOUND" />
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
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
                      <div className={`inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider ${order.STATUS === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
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

function StatCard({ title, value, icon: Icon, color, subtitle }: any) {
  return (
    <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-gray-100 group hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-start justify-between mb-6">
        <div className={`p-4 rounded-2xl ${color} shadow-lg shadow-black/5 group-hover:scale-110 transition-transform`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <ArrowUpRight className="w-5 h-5 text-gray-200 group-hover:text-black transition-colors" />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase mb-1">{title}</p>
        <p className="text-4xl font-black text-black tracking-tighter">{value}</p>
        <p className="text-xs text-gray-400 mt-2 font-medium">{subtitle}</p>
      </div>
    </div>
  );
}
