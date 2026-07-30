'use client';

import { useState, useEffect } from 'react';
import { bhs_supabas, fetchAllData } from '@/lib/supabase';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Users,
  ArrowUpRight,
  Activity,
  Calendar,
  User,
  AlertCircle,
  XCircle,
  Package,
  Trophy,
  Truck,
  FileCheck,
  FileText
} from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';
import TabLoader from '@/app/Components/TabLoader';

interface Stats {
  total: number;
  delivered: number;
  officeConfirmed: number;
  pending: number;
  cancelled: number;
}

interface DriverPerformance {
  id: string;
  name: string;
  total: number;
  delivered: number;
  officeConfirmed: number;
  pending: number;
  cancelled: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, delivered: 0, officeConfirmed: 0, pending: 0, cancelled: 0 });
  const [driverPerformance, setDriverPerformance] = useState<DriverPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const drivers = await fetchAllData(() =>
        bhs_supabas.from('app_lpos_DRIVERS').select('*').order('ID', { ascending: false })
      );

      let total = 0;
      let delivered = 0;
      let officeConfirmed = 0;
      let pending = 0;
      let cancelled = 0;

      const performanceMap: Record<string, DriverPerformance> = {};

      const allUsers = await fetchAllData(() => bhs_supabas.from('bhs_USERS').select('*'));

      drivers.forEach((driver: any) => {
        total++;
        const isCancelled = driver.TRACKING_NOTES === 'SYSTEM_CANCELLED';
        const isDelivered = driver.STATUS === 'Delivered' && !isCancelled;
        const isOfficeConfirmed = driver.OFFICE_HANDOVER_STATUS === 'Confirmed' && !isCancelled;
        const isPending = driver.STATUS !== 'Delivered' && !isCancelled;

        if (isCancelled) cancelled++;
        else if (isDelivered) delivered++;

        if (isOfficeConfirmed) officeConfirmed++;
        if (isPending) pending++;

        const driverId = driver.DRIVERS_NAME;
        if (!driverId) return; // Skip unassigned

        if (!performanceMap[driverId]) {
          const userObj = allUsers.find(u => u.ID === driverId);
          performanceMap[driverId] = {
            id: driverId,
            name: userObj?.NAME || driverId,
            total: 0,
            delivered: 0,
            officeConfirmed: 0,
            pending: 0,
            cancelled: 0
          };
        }

        performanceMap[driverId].total++;
        if (isCancelled) performanceMap[driverId].cancelled++;
        else if (isDelivered) performanceMap[driverId].delivered++;
        if (isOfficeConfirmed) performanceMap[driverId].officeConfirmed++;
        if (isPending) performanceMap[driverId].pending++;
      });

      setStats({
        total,
        delivered,
        officeConfirmed,
        pending,
        cancelled
      });

      const performanceArray = Object.values(performanceMap)
        .sort((a, b) => b.total - a.total) as DriverPerformance[];

      setDriverPerformance(performanceArray);

    } catch (err) {
      console.error('Dashboard Data Fetch Error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <TabLoader />;
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">Invoices Dashboard</h1>
        </div>
        <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
          <Calendar className="w-5 h-5 text-[#D4AF37]" />
          <span className="text-sm font-bold text-gray-700">{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Total Invoices"
          value={stats.total.toString()}
          icon={FileText}
          color="bg-black"
          subtitle="All Dispatched Invoices"
        />
        <StatCard
          title="Delivered"
          value={stats.delivered.toString()}
          icon={CheckCircle2}
          color="bg-emerald-500"
          subtitle="Customer Received"
        />
        <StatCard
          title="Office Confirmed"
          value={stats.officeConfirmed.toString()}
          icon={FileCheck}
          color="bg-blue-500"
          subtitle="Returned to Office"
        />
        <StatCard
          title="Pending"
          value={stats.pending.toString()}
          icon={Clock}
          color="bg-orange-500"
          subtitle="Waiting for Delivery"
        />
        <StatCard
          title="Cancelled"
          value={stats.cancelled.toString()}
          icon={XCircle}
          color="bg-red-500"
          subtitle="Returned & Cancelled"
        />
      </div>

      {/* Drivers Performance Table */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-black text-black flex items-center gap-3">
            <Truck className="w-6 h-6 text-[#D4AF37]" />
            Drivers Performance
          </h3>
          <Activity className="w-6 h-6 text-gray-200" />
        </div>

        {driverPerformance.length === 0 ? (
          <NoData title="NO DRIVERS FOUND" />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-center">
                <th className="pb-5 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Driver Name</th>
                <th className="pb-5 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Invoices</th>
                <th className="pb-5 px-4 text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Delivered</th>
                <th className="pb-5 px-4 text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Office Confirmed</th>
                <th className="pb-5 px-4 text-[10px] font-black text-orange-500 uppercase tracking-[0.2em]">Pending</th>
                <th className="pb-5 px-4 text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Cancelled</th>
                <th className="pb-5 px-4 text-[10px] font-black text-black uppercase tracking-[0.2em]">Success Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {driverPerformance.map((d) => {
                const successRate = d.total > 0 ? Math.round((d.delivered / d.total) * 100) : 0;
                return (
                  <tr key={d.id} className="group hover:bg-gray-50/50 transition-all text-center">
                    <td className="py-6 px-4 text-center">
                      <div className="flex items-center justify-center gap-4">
                        <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center text-xs text-[#D4AF37] font-black shadow-lg shadow-black/10">
                          {d.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-black">{d.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{d.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-6 px-4">
                      <span className="text-lg font-black text-black">{d.total}</span>
                    </td>
                    <td className="py-6 px-4">
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-sm">{d.delivered}</span>
                    </td>
                    <td className="py-6 px-4">
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg font-black text-sm">{d.officeConfirmed}</span>
                    </td>
                    <td className="py-6 px-4">
                      <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-lg font-black text-sm">{d.pending}</span>
                    </td>
                    <td className="py-6 px-4">
                      <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg font-black text-sm">{d.cancelled}</span>
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
        )}
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
